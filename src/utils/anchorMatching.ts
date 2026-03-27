/**
 * 锚点匹配算法 - 通过找最长连续匹配的单词序列来定位文本
 */

// 同音词/常见语音识别错误映射表
const HOMOPHONES: Record<string, string[]> = {
  'its': ["it's"], "it's": ['its'],
  'there': ['their', "they're"], 'their': ['there', "they're"], "they're": ['there', 'their'],
  'your': ['you\'re'], 'you\'re': ['your'],
  'villages': ['villagers'], 'villagers': ['villages'],
  'stayed': ['stood'], 'stood': ['stayed'],
};

/**
 * 分词
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * 计算编辑距离
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * 检查两个单词是否匹配
 */
export function wordsMatch(w1: string, w2: string): boolean {
  if (w1 === w2) return true;
  
  // 同音词检查
  for (const [key, values] of Object.entries(HOMOPHONES)) {
    const group = [key, ...values];
    if (group.includes(w1) && group.includes(w2)) return true;
  }
  
  // 编辑距离检查（允许1个字符差异）
  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen <= 3) {
    // 短词必须完全匹配
    return w1 === w2;
  }
  
  const distance = levenshteinDistance(w1, w2);
  return distance <= 1;
}

/**
 * 锚点接口
 */
interface Anchor {
  transStart: number;   // 在识别文本中的起始位置
  contentStart: number; // 在原文中的起始位置
  length: number;       // 连续匹配的单词数
}

/**
 * 匹配结果接口
 */
export interface AnchorMatchResult {
  text: string;         // 匹配到的原文文本
  startIndex: number;   // 在原文单词数组中的起始位置
  endIndex: number;     // 在原文单词数组中的结束位置
  coverage: number;     // 识别文本的覆盖率 (0-1)
  anchorLength: number; // 锚点长度（连续匹配的单词数）
  matchedWords: number; // 总共匹配的单词数
}

/**
 * 找出所有锚点（连续匹配的单词序列）
 */
function findAllAnchors(
  transWords: string[],
  contentWords: string[],
  minLength: number
): Anchor[] {
  const anchors: Anchor[] = [];
  
  for (let t = 0; t < transWords.length; t++) {
    for (let c = 0; c < contentWords.length; c++) {
      // 检查从当前位置开始的连续匹配
      let length = 0;
      while (
        t + length < transWords.length &&
        c + length < contentWords.length &&
        wordsMatch(transWords[t + length], contentWords[c + length])
      ) {
        length++;
      }
      
      if (length >= minLength) {
        anchors.push({
          transStart: t,
          contentStart: c,
          length
        });
      }
    }
  }
  
  return anchors;
}

/**
 * 选择最佳锚点（最长、位置最靠前）
 */
function selectBestAnchor(anchors: Anchor[]): Anchor | null {
  if (anchors.length === 0) return null;
  
  // 先按长度降序，再按位置升序
  return anchors.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.contentStart - b.contentStart;
  })[0];
}

/**
 * 向锚点两边扩展，收集更多匹配的单词
 */
function extendAnchor(
  anchor: Anchor,
  transWords: string[],
  contentWords: string[]
): { start: number; end: number; matchedWords: number } {
  let matchedWords = anchor.length;
  
  // 向前扩展
  let startOffset = 1;
  while (
    anchor.transStart - startOffset >= 0 &&
    anchor.contentStart - startOffset >= 0 &&
    wordsMatch(
      transWords[anchor.transStart - startOffset],
      contentWords[anchor.contentStart - startOffset]
    )
  ) {
    matchedWords++;
    startOffset++;
  }
  
  // 向后扩展
  let endOffset = anchor.length;
  while (
    anchor.transStart + endOffset < transWords.length &&
    anchor.contentStart + endOffset < contentWords.length &&
    wordsMatch(
      transWords[anchor.transStart + endOffset],
      contentWords[anchor.contentStart + endOffset]
    )
  ) {
    matchedWords++;
    endOffset++;
  }
  
  return {
    start: anchor.contentStart - startOffset + 1,
    end: anchor.contentStart + endOffset,
    matchedWords
  };
}

/**
 * 从原文中提取指定单词范围的实际文本（保留大小写和格式）
 */
function extractOriginalText(
  contentText: string,
  startWordIndex: number,
  endWordIndex: number
): string {
  const wordRegex = /[\w']+/g;
  const words: { word: string; index: number }[] = [];
  let match;
  
  while ((match = wordRegex.exec(contentText)) !== null) {
    words.push({ word: match[0], index: match.index });
  }
  
  if (startWordIndex >= words.length) {
    return '';
  }
  
  const startPos = words[startWordIndex].index;
  const endPos = endWordIndex < words.length 
    ? words[endWordIndex].index 
    : contentText.length;
  
  return contentText.slice(startPos, endPos).trim();
}

/**
 * 使用锚点定位算法查找匹配
 * @param transcription 识别文本
 * @param contentText 原文内容
 * @param minAnchorLength 最小锚点长度（默认3个单词）
 * @param minCoverage 最小覆盖率（默认0.3，即30%）
 */
export function findMatchByAnchorPoint(
  transcription: string,
  contentText: string,
  minAnchorLength: number = 3,
  minCoverage: number = 0.3
): AnchorMatchResult | null {
  const transWords = tokenize(transcription);
  const contentWords = tokenize(contentText);
  
  if (transWords.length === 0 || contentWords.length === 0) {
    return null;
  }
  
  // 步骤1：找出所有锚点
  const anchors = findAllAnchors(transWords, contentWords, minAnchorLength);
  
  // 步骤2：选择最佳锚点
  const bestAnchor = selectBestAnchor(anchors);
  if (!bestAnchor) return null;
  
  // 步骤3：向两边扩展
  const { start, end, matchedWords } = extendAnchor(bestAnchor, transWords, contentWords);
  
  // 步骤4：计算覆盖率
  const coverage = matchedWords / transWords.length;
  
  // 检查覆盖率是否满足要求
  if (coverage < minCoverage) {
    return null;
  }
  
  // 步骤5：提取原文
  const matchedText = extractOriginalText(contentText, start, end);
  
  return {
    text: matchedText,
    startIndex: start,
    endIndex: end,
    coverage,
    anchorLength: bestAnchor.length,
    matchedWords
  };
}

/**
 * 查找多个可能的匹配（用于调试）
 */
export function findAllMatchesByAnchor(
  transcription: string,
  contentText: string,
  minAnchorLength: number = 3,
  topK: number = 5
): AnchorMatchResult[] {
  const transWords = tokenize(transcription);
  const contentWords = tokenize(contentText);
  
  if (transWords.length === 0 || contentWords.length === 0) {
    return [];
  }
  
  const anchors = findAllAnchors(transWords, contentWords, minAnchorLength);
  const matches: AnchorMatchResult[] = [];
  const usedRanges = new Set<string>();
  
  // 对每个锚点进行扩展
  for (const anchor of anchors) {
    const { start, end, matchedWords } = extendAnchor(anchor, transWords, contentWords);
    const rangeKey = `${start}-${end}`;
    
    // 避免重复的范围
    if (usedRanges.has(rangeKey)) continue;
    usedRanges.add(rangeKey);
    
    const coverage = matchedWords / transWords.length;
    const matchedText = extractOriginalText(contentText, start, end);
    
    matches.push({
      text: matchedText,
      startIndex: start,
      endIndex: end,
      coverage,
      anchorLength: anchor.length,
      matchedWords
    });
  }
  
  // 按覆盖率和锚点长度排序
  return matches
    .sort((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return b.anchorLength - a.anchorLength;
    })
    .slice(0, topK);
}

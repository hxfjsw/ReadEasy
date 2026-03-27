/**
 * 文本匹配工具 - 用于语音识别结果与原文的模糊匹配
 */

/**
 * 分词 - 将文本分割成单词数组
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')  // 保留撇号（如 it's）
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Levenshtein 距离 - 计算两个字符串的编辑距离
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
 * 同音词/常见语音识别错误映射表
 */
const HOMOPHONES: Record<string, string[]> = {
  'its': ["it's", 'its'],
  "it's": ['its', "it's"],
  'there': ['their', "they're", 'there'],
  'their': ['there', "they're", 'their'],
  "they're": ['there', 'their', "they're"],
  'your': ['you\'re', 'your'],
  'you\'re': ['your', 'you\'re'],
  'villages': ['villagers', 'villages'],
  'villagers': ['villages', 'villagers'],
  'stayed': ['stood', 'stayed'],
  'stood': ['stayed', 'stood'],
  'still': ['stood', 'still'],
};

/**
 * 计算两个单词的相似度
 * @returns 0-1 之间的相似度分数
 */
export function wordSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1;
  
  // 检查同音词表
  for (const [_, group] of Object.entries(HOMOPHONES)) {
    if (group.includes(w1) && group.includes(w2)) {
      return 0.9;
    }
  }
  
  // 编辑距离（处理单复数、时态变化）
  const distance = levenshteinDistance(w1, w2);
  const maxLen = Math.max(w1.length, w2.length);
  
  if (maxLen <= 3) {
    // 短词要求更精确
    return distance === 0 ? 1 : distance === 1 ? 0.6 : 0;
  }
  
  if (distance === 0) return 1;
  if (distance === 1) return 0.85;  // 单字符差异（如 called/calls）
  if (distance === 2) return 0.7;   // 双字符差异（如 villages/villagers）
  
  return 0;
}

/**
 * 使用动态规划计算两组单词的最佳匹配得分
 * 类似序列对齐算法
 */
export function calculateMatchScore(
  transWords: string[], 
  candidateWords: string[],
  skipPenalty: number = 0.15
): number {
  const dp: number[][] = [];
  
  for (let i = 0; i <= transWords.length; i++) {
    dp[i] = new Array(candidateWords.length + 1).fill(0);
  }
  
  for (let i = 1; i <= transWords.length; i++) {
    for (let j = 1; j <= candidateWords.length; j++) {
      const matchScore = wordSimilarity(transWords[i-1], candidateWords[j-1]);
      
      dp[i][j] = Math.max(
        dp[i-1][j-1] + matchScore,           // 匹配/替换
        dp[i-1][j] - skipPenalty,            // 跳过识别词
        dp[i][j-1] - skipPenalty             // 跳过候选词
      );
    }
  }
  
  // 归一化得分
  const maxPossibleScore = transWords.length;
  return dp[transWords.length][candidateWords.length] / maxPossibleScore;
}

/**
 * 匹配结果接口
 */
export interface MatchResult {
  text: string;
  similarity: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 使用滑动窗口查找最佳匹配
 * @param transcription 识别文本
 * @param contentText 原文内容
 * @param similarityThreshold 相似度阈值
 * @param windowTolerance 窗口大小容忍度（允许原文比识别多多少词）
 */
export function findBestMatch(
  transcription: string,
  contentText: string,
  similarityThreshold: number = 0.5,
  windowTolerance: number = 5
): MatchResult | null {
  const transWords = tokenize(transcription);
  const contentWords = tokenize(contentText);
  
  if (transWords.length === 0 || contentWords.length === 0) {
    return null;
  }
  
  const tLen = transWords.length;
  let bestMatch: MatchResult | null = null;
  let bestScore = similarityThreshold;
  
  // 窗口范围：允许原文比识别少一些词（跳过）或多一些词（扩展）
  const minWindowSize = Math.max(1, tLen - 2);
  const maxWindowSize = Math.min(contentWords.length, tLen + windowTolerance);
  
  for (let windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize++) {
    for (let i = 0; i <= contentWords.length - windowSize; i++) {
      const candidate = contentWords.slice(i, i + windowSize);
      const score = calculateMatchScore(transWords, candidate);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          text: candidate.join(' '),
          similarity: score,
          startIndex: i,
          endIndex: i + windowSize
        };
      }
    }
  }
  
  return bestMatch;
}

/**
 * 查找所有可能的匹配（用于调试）
 */
export function findAllMatches(
  transcription: string,
  contentText: string,
  similarityThreshold: number = 0.5,
  topK: number = 5
): MatchResult[] {
  const transWords = tokenize(transcription);
  const contentWords = tokenize(contentText);
  
  if (transWords.length === 0 || contentWords.length === 0) {
    return [];
  }
  
  const tLen = transWords.length;
  const matches: MatchResult[] = [];
  
  const minWindowSize = Math.max(1, tLen - 2);
  const maxWindowSize = Math.min(contentWords.length, tLen + 5);
  
  for (let windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize++) {
    for (let i = 0; i <= contentWords.length - windowSize; i++) {
      const candidate = contentWords.slice(i, i + windowSize);
      const score = calculateMatchScore(transWords, candidate);
      
      if (score >= similarityThreshold) {
        matches.push({
          text: candidate.join(' '),
          similarity: score,
          startIndex: i,
          endIndex: i + windowSize
        });
      }
    }
  }
  
  // 按相似度排序并返回前 K 个
  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// Reader page helper functions

// 目标每页单词数（大约）
const TARGET_WORDS_PER_PAGE = 500;
// 最小单词数（至少这么多单词才分页）
const MIN_WORDS_PER_PAGE = 400;
// 最大单词数（最多这么多单词）
const MAX_WORDS_PER_PAGE = 600;

// 计算文本中的单词数
const countWords = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
};

// 将内容分割成页面（按单词数）
export const splitContentIntoPages = (content: string, _pageSize?: number): string[] => {
  if (!content || content.trim().length === 0) {
    return [''];
  }
  
  const totalWords = countWords(content);
  
  // 如果总单词数少于目标，直接作为一页
  if (totalWords <= TARGET_WORDS_PER_PAGE) {
    return [content];
  }
  
  const pages: string[] = [];
  let remainingContent = content;
  
  while (remainingContent.length > 0) {
    const page = extractNextPage(remainingContent);
    if (!page || page.length === 0) {
      // 防止无限循环
      if (remainingContent.length > 0) {
        pages.push(remainingContent);
      }
      break;
    }
    
    pages.push(page);
    remainingContent = remainingContent.slice(page.length).trimStart();
  }
  
  return pages.length > 0 ? pages : [content];
};

// 提取下一页内容
const extractNextPage = (content: string): string => {
  if (!content || content.trim().length === 0) {
    return '';
  }
  
  // 按单词分割
  const words = content.trim().split(/\s+/);
  
  if (words.length <= TARGET_WORDS_PER_PAGE) {
    return content.trim();
  }
  
  // 尝试在 TARGET_WORDS_PER_PAGE 附近找一个好的分割点
  let targetIndex = findWordBoundary(content, words, TARGET_WORDS_PER_PAGE);
  
  // 如果单词数太少，尝试找更少的位置
  if (targetIndex < MIN_WORDS_PER_PAGE * 2) {
    targetIndex = findWordBoundary(content, words, MIN_WORDS_PER_PAGE);
  }
  
  // 将单词索引转换为字符位置
  let charEndIndex = 0;
  let wordCount = 0;
  
  for (let i = 0; i < content.length && wordCount < targetIndex; i++) {
    if (content[i].match(/\s/)) {
      // 跳过空白字符
      if (i > 0 && !content[i - 1].match(/\s/)) {
        wordCount++;
      }
    }
    charEndIndex = i + 1;
  }
  
  // 确保不在单词中间切分，找到下一个单词边界
  while (charEndIndex < content.length && !content[charEndIndex].match(/\s/)) {
    charEndIndex++;
  }
  
  return content.slice(0, charEndIndex).trim();
};

// 查找合适的单词边界（优先段落，其次句子，最后单词）
const findWordBoundary = (content: string, words: string[], targetWordCount: number): number => {
  // 计算目标位置的近似字符位置
  let approxCharIndex = 0;
  let wordCount = 0;
  
  for (let i = 0; i < content.length && wordCount < targetWordCount; i++) {
    approxCharIndex = i;
    if (content[i].match(/\s/) && i > 0 && !content[i - 1].match(/\s/)) {
      wordCount++;
    }
  }
  
  // 搜索范围：目标位置前后20%
  const searchStart = Math.max(0, approxCharIndex - Math.floor(approxCharIndex * 0.2));
  const searchEnd = Math.min(content.length, approxCharIndex + Math.floor(approxCharIndex * 0.2));
  const searchRange = content.slice(searchStart, searchEnd);
  
  // 1. 优先找段落边界（两个换行符）
  const paragraphMatch = searchRange.match(/\n\s*\n/);
  if (paragraphMatch && paragraphMatch.index !== undefined) {
    const paragraphPos = searchStart + paragraphMatch.index + paragraphMatch[0].length;
    // 计算这是第几个单词
    let count = 0;
    for (let i = 0; i < paragraphPos && i < content.length; i++) {
      if (content[i].match(/\s/) && i > 0 && !content[i - 1].match(/\s/)) {
        count++;
      }
    }
    if (count >= MIN_WORDS_PER_PAGE && count <= MAX_WORDS_PER_PAGE) {
      return count;
    }
  }
  
  // 2. 其次找句子边界（句号、问号、感叹号后接空格或换行）
  const sentenceMatch = searchRange.match(/[.!?。！？]['""]*\s+/);
  if (sentenceMatch && sentenceMatch.index !== undefined) {
    const sentencePos = searchStart + sentenceMatch.index + sentenceMatch[0].length;
    let count = 0;
    for (let i = 0; i < sentencePos && i < content.length; i++) {
      if (content[i].match(/\s/) && i > 0 && !content[i - 1].match(/\s/)) {
        count++;
      }
    }
    if (count >= MIN_WORDS_PER_PAGE && count <= MAX_WORDS_PER_PAGE) {
      return count;
    }
  }
  
  // 3. 最后找单词边界（空格）
  const wordMatch = searchRange.match(/\s+/);
  if (wordMatch && wordMatch.index !== undefined) {
    const wordPos = searchStart + wordMatch.index;
    let count = 0;
    for (let i = 0; i < wordPos && i < content.length; i++) {
      if (content[i].match(/\s/) && i > 0 && !content[i - 1].match(/\s/)) {
        count++;
      }
    }
    if (count >= MIN_WORDS_PER_PAGE && count <= MAX_WORDS_PER_PAGE) {
      return count;
    }
  }
  
  // 默认返回目标单词数
  return targetWordCount;
};

// 判断单词是否是生词
export const checkIsUnknownWord = (
  word: string,
  knownWords: Set<string>,
  customWords: string[],
  vocabularyAnalysis: Map<string, string>,
  userVocabularyLevel: string,
  levelOrder: string[]
): boolean => {
  const lowerWord = word.toLowerCase();
  
  // 如果在已掌握列表中，不是生词
  if (knownWords.has(lowerWord) || customWords.includes(lowerWord)) {
    return false;
  }
  
  // 获取单词等级
  const wordLevel = vocabularyAnalysis.get(lowerWord);
  if (!wordLevel) return false; // 未知等级的单词不标记
  
  // 获取用户等级索引
  const userLevelIndex = levelOrder.indexOf(userVocabularyLevel);
  const wordLevelIndex = levelOrder.indexOf(wordLevel);
  
  // 如果单词等级高于用户等级，则是生词
  return wordLevelIndex > userLevelIndex;
};

// 获取单词等级颜色
export const getWordLevelColor = (word: string, vocabularyAnalysis: Map<string, string>): string => {
  const level = vocabularyAnalysis.get(word.toLowerCase());
  const colors: Record<string, string> = {
    elementary: '#52c41a',
    middle: '#13c2c2',
    high: '#1890ff',
    cet4: '#2f54eb',
    cet6: '#722ed1',
    postgraduate: '#eb2f96',
    ielts: '#fa8c16',
    toefl: '#faad14',
    gre: '#f5222d',
    tem8: '#cf1322',
  };
  return colors[level || ''] || '';
};

// 获取主题样式
export const getThemeStyles = (theme: 'light' | 'dark' | 'sepia') => {
  switch (theme) {
    case 'dark':
      return {
        bg: 'bg-gray-900',
        text: 'text-gray-200',
        container: 'bg-gray-800',
      };
    case 'sepia':
      return {
        bg: 'bg-[#f4ecd8]',
        text: 'text-[#5b4636]',
        container: 'bg-[#fdf6e3]',
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        container: 'bg-white',
      };
  }
};

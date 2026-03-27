// Reader page helper functions

// 将内容分割成页面
export const splitContentIntoPages = (content: string, pageSize: number): string[] => {
  if (!content || content.length <= pageSize) {
    return [content];
  }
  
  const pages: string[] = [];
  let startIndex = 0;
  
  while (startIndex < content.length) {
    // 尝试在句子结尾处分割（查找句号、问号、感叹号后的空格或换行）
    let endIndex = startIndex + pageSize;
    
    if (endIndex >= content.length) {
      // 剩余内容不足一页，直接添加
      pages.push(content.slice(startIndex));
      break;
    }
    
    // 查找合适的分割点（优先在段落或句子边界）
    let splitIndex = endIndex;
    
    // 先尝试找段落边界（两个换行符）
    const paragraphMatch = content.slice(startIndex, endIndex + 200).match(/\n\s*\n/);
    if (paragraphMatch && paragraphMatch.index) {
      const paragraphEnd = startIndex + paragraphMatch.index + paragraphMatch[0].length;
      if (paragraphEnd > startIndex + pageSize * 0.7 && paragraphEnd <= endIndex + 200) {
        splitIndex = paragraphEnd;
      }
    }
    
    // 如果没有找到段落边界，尝试在句子边界分割
    if (splitIndex === endIndex) {
      const sentenceMatch = content.slice(startIndex, endIndex + 100).match(/[.!?。！？]\s+/);
      if (sentenceMatch && sentenceMatch.index) {
        const sentenceEnd = startIndex + sentenceMatch.index + sentenceMatch[0].length;
        if (sentenceEnd > startIndex + pageSize * 0.7 && sentenceEnd <= endIndex + 100) {
          splitIndex = sentenceEnd;
        }
      }
    }
    
    pages.push(content.slice(startIndex, splitIndex));
    startIndex = splitIndex;
  }
  
  return pages;
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

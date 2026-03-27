// Reader page helper functions

// 将内容分割成页面（整章显示，不分页）
export const splitContentIntoPages = (content: string, _pageSize?: number): string[] => {
  if (!content || content.trim().length === 0) {
    return [''];
  }
  
  // 直接返回整个章节作为一页
  return [content];
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

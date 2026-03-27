import { useState, useCallback } from 'react';

export function useReaderVocabulary() {
  const [vocabularyAnalysis, setVocabularyAnalysis] = useState<Map<string, string>>(new Map());
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());

  const analyzeVocabulary = useCallback(async (text: string) => {
    try {
      const maxLength = 5000;
      const truncatedText = text.slice(0, maxLength);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('词汇分析超时')), 10000);
      });
      
      const result = await Promise.race([
        window.electron.ipcRenderer.invoke('ai:analyzeVocabulary', { text: truncatedText }),
        timeoutPromise,
      ]) as any;
      
      let words: { word: string; level: string }[] = [];
      
      if (result?.words && Array.isArray(result.words)) {
        words = result.words;
      } else if (result?.data?.words && Array.isArray(result.data.words)) {
        words = result.data.words;
      } else if (result?.success === false) {
        return;
      }
      
      if (words.length > 0) {
        const analysis = new Map<string, string>();
        words.forEach((item) => {
          if (item.word && item.level) {
            analysis.set(item.word.toLowerCase(), item.level);
          }
        });
        setVocabularyAnalysis(analysis);
      }
    } catch (error) {
      console.error('词汇分析失败:', error);
    }
  }, []);

  const isUnknownWord = useCallback((
    word: string,
    vocabularyLevel: string,
    levelOrder: string[]
  ): boolean => {
    const lowerWord = word.toLowerCase();
    
    // 如果在已掌握列表中，不是生词
    if (knownWords.has(lowerWord)) {
      return false;
    }
    
    // 获取单词等级
    const wordLevel = vocabularyAnalysis.get(lowerWord);
    if (!wordLevel) return false;
    
    // 获取用户等级索引
    const userLevelIndex = levelOrder.indexOf(vocabularyLevel);
    const wordLevelIndex = levelOrder.indexOf(wordLevel);
    
    // 如果单词等级高于用户等级，则是生词
    return wordLevelIndex > userLevelIndex;
  }, [knownWords, vocabularyAnalysis]);

  const getWordLevelColor = useCallback((word: string): string => {
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
  }, [vocabularyAnalysis]);

  const updateKnownWords = useCallback((word: string, isMastered: boolean) => {
    setKnownWords(prev => {
      const newSet = new Set(prev);
      if (isMastered) {
        newSet.add(word.toLowerCase());
      } else {
        newSet.delete(word.toLowerCase());
      }
      return newSet;
    });
  }, []);

  return {
    vocabularyAnalysis,
    knownWords,
    analyzeVocabulary,
    isUnknownWord,
    getWordLevelColor,
    updateKnownWords,
    setKnownWords,
  };
}

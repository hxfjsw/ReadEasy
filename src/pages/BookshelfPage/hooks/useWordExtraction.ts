import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import type { BookshelfItem, ExtractedWord } from '../types';
import { extractWordsFromText } from '../utils';

export const useWordExtraction = (selectedBook: BookshelfItem | null) => {
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractedWords, setExtractedWords] = useState<ExtractedWord[]>([]);
  const [originalExtractedWords, setOriginalExtractedWords] = useState<ExtractedWord[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [extractPageSize, setExtractPageSize] = useState(50);
  const [extractSortOrder, setExtractSortOrder] = useState<'original' | 'alphabetical' | 'frequency'>('original');
  const [loadingDefinitions, setLoadingDefinitions] = useState(false);
  const [ignoringInvalidWords, setIgnoringInvalidWords] = useState(false);
  const [ignoredInvalidCount, setIgnoredInvalidCount] = useState(0);

  // 批量加载释义
  const batchLoadDefinitions = useCallback(async (words: ExtractedWord[]) => {
    setLoadingDefinitions(true);
    try {
      const updatedWords = [...words];
      const wordList = words.map(w => w.word.toLowerCase());

      // ECDICT 批量查询
      try {
        const ecdictResult = await window.electron.ipcRenderer.invoke('ecdict:batchLookup', wordList);
        if (ecdictResult?.success && ecdictResult.data) {
          const ecdictData = ecdictResult.data;
          for (let i = 0; i < updatedWords.length; i++) {
            const word = updatedWords[i].word.toLowerCase();
            if (ecdictData[word]?.definitionCn) {
              updatedWords[i] = { ...updatedWords[i], definitionCn: ecdictData[word].definitionCn };
            }
          }
          setExtractedWords([...updatedWords]);
          setOriginalExtractedWords([...updatedWords]);
        }
      } catch (error) {
        console.log('ECDICT 查询失败:', error);
      }

      // 查询本地数据库和 AI
      const missingWords = updatedWords.filter(w => !w.definitionCn);
      if (missingWords.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < missingWords.length; i += batchSize) {
          const batch = missingWords.slice(i, i + batchSize);
          const promises = batch.map(async (item) => {
            try {
              const wordFromDB = await window.electron.ipcRenderer.invoke('db:getWord', item.word.toLowerCase());
              if (wordFromDB?.definitionCn) {
                return { word: item.word, definitionCn: wordFromDB.definitionCn };
              }
              const result = await window.electron.ipcRenderer.invoke('ai:defineWordBasic', { word: item.word });
              if (result?.success && result.data?.definitions?.[0]?.meaningCn) {
                return { word: item.word, definitionCn: result.data.definitions[0].meaningCn };
              }
              return null;
            } catch {
              return null;
            }
          });
          
          const results = await Promise.all(promises);
          for (const result of results) {
            if (result) {
              const index = updatedWords.findIndex(w => w.word === result.word);
              if (index !== -1) {
                updatedWords[index] = { ...updatedWords[index], definitionCn: result.definitionCn };
              }
            }
          }
          setExtractedWords([...updatedWords]);
          setOriginalExtractedWords([...updatedWords]);
        }
      }
    } catch (error) {
      console.error('批量加载释义失败:', error);
    } finally {
      setLoadingDefinitions(false);
    }
  }, []);

  // 打开提取对话框
  const openExtractWordsModal = useCallback(async (book: BookshelfItem) => {
    setExtractModalOpen(true);
    setExtractLoading(true);
    setSelectedWords([]);
    
    try {
      const masteredWords = await window.electron.ipcRenderer.invoke('db:getMasteredWords');
      const masteredSet = new Set(masteredWords.map((w: string) => w.toLowerCase()));
      
      const fileResult = await window.electron.ipcRenderer.invoke('file:read', book.filePath, { maxContentSize: 100 * 1024 * 1024 });
      if (fileResult.success) {
        const content = fileResult.data || '';
        const wordData = extractWordsFromText(content);
        const allWords: ExtractedWord[] = Array.from(wordData.entries())
          .map(([word, data]) => ({ word, count: data.count, example: data.example, definitionCn: undefined }));
        
        const filteredCount = allWords.filter(item => masteredSet.has(item.word)).length;
        setExcludedCount(filteredCount);
        
        let filteredWords = allWords.filter(item => !masteredSet.has(item.word));
        setOriginalExtractedWords(filteredWords);
        
        if (extractSortOrder === 'alphabetical') {
          filteredWords = filteredWords.sort((a, b) => a.word.localeCompare(b.word));
        } else if (extractSortOrder === 'frequency') {
          filteredWords = filteredWords.sort((a, b) => b.count - a.count);
        }
        setExtractedWords(filteredWords);
        
        if (filteredWords.length > 0) {
          setTimeout(() => batchLoadDefinitions(filteredWords.slice(0, 50)), 100);
        }
      } else {
        message.error('读取文件失败');
      }
    } catch (error) {
      console.error('提取单词失败:', error);
      message.error('提取单词失败');
    } finally {
      setExtractLoading(false);
    }
  }, [extractSortOrder, batchLoadDefinitions]);

  // 排序变化
  useEffect(() => {
    if (originalExtractedWords.length > 0) {
      let sortedWords = [...originalExtractedWords];
      if (extractSortOrder === 'alphabetical') {
        sortedWords = sortedWords.sort((a, b) => a.word.localeCompare(b.word));
      } else if (extractSortOrder === 'frequency') {
        sortedWords = sortedWords.sort((a, b) => b.count - a.count);
      }
      setExtractedWords(sortedWords);
    }
  }, [extractSortOrder, originalExtractedWords]);

  // 排除无效词
  const handleIgnoreInvalidWords = useCallback(async () => {
    if (extractedWords.length === 0) return;
    
    setIgnoringInvalidWords(true);
    try {
      const allWords = extractedWords.map(w => w.word.toLowerCase());
      const ecdictResult = await window.electron.ipcRenderer.invoke('ecdict:batchLookup', allWords);
      
      if (ecdictResult?.success) {
        const foundWords = new Set(Object.keys(ecdictResult.data || {}));
        const invalidWords = extractedWords.filter(w => !foundWords.has(w.word.toLowerCase()));
        
        if (invalidWords.length === 0) {
          message.info('没有发现无效词');
          return;
        }
        
        const invalidWordStrings = invalidWords.map(w => w.word);
        const result = await window.electron.ipcRenderer.invoke(
          'db:batchAddIgnoredWords', 
          invalidWordStrings, 
          selectedBook?.bookName
        );
        
        if (result.success) {
          const validWords = extractedWords.filter(w => foundWords.has(w.word.toLowerCase()));
          setExtractedWords(validWords);
          setOriginalExtractedWords(validWords);
          setIgnoredInvalidCount(invalidWords.length);
          message.success(`已排除 ${invalidWords.length} 个无效词`);
        }
      }
    } catch (error) {
      console.error('排除无效词失败:', error);
      message.error('排除无效词失败');
    } finally {
      setIgnoringInvalidWords(false);
    }
  }, [extractedWords, selectedBook]);

  // 添加到熟词本
  const handleAddSelectedWords = useCallback(async () => {
    if (selectedWords.length === 0) {
      message.warning('请先选择单词');
      return;
    }
    
    let addedCount = 0;
    let existedCount = 0;
    
    for (const word of selectedWords) {
      try {
        const result = await window.electron.ipcRenderer.invoke('db:addMasteredWord', word);
        if (result.success) {
          if (result.existed) existedCount++;
          else addedCount++;
        }
      } catch (error) {
        console.error(`添加单词 ${word} 失败:`, error);
      }
    }
    
    message.success(`添加完成：新增 ${addedCount} 个，已存在 ${existedCount} 个`);
    
    if (selectedBook) {
      openExtractWordsModal(selectedBook);
    }
    setSelectedWords([]);
    window.dispatchEvent(new CustomEvent('masteredWordsUpdated'));
  }, [selectedWords, selectedBook, openExtractWordsModal]);

  return {
    extractModalOpen,
    setExtractModalOpen,
    extractLoading,
    extractedWords,
    selectedWords,
    setSelectedWords,
    excludedCount,
    extractPageSize,
    setExtractPageSize,
    extractSortOrder,
    setExtractSortOrder,
    loadingDefinitions,
    ignoringInvalidWords,
    ignoredInvalidCount,
    openExtractWordsModal,
    batchLoadDefinitions,
    handleIgnoreInvalidWords,
    handleAddSelectedWords,
  };
};

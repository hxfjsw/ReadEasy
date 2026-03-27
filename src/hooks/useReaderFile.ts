import { useState, useCallback } from 'react';
import { message } from 'antd';
import { splitContentIntoPages } from '../utils/readerHelpers';
import type { Chapter, LoadingState } from '../types/reader';

export function useReaderFile() {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    stage: 'reading',
    progress: 0,
    message: '',
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<number>(0);
  const [chapterStartPages, setChapterStartPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageContents, setPageContents] = useState<string[]>([]);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 3000;

  const handleFileSelect = useCallback(async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('file:open');
      if (!result.canceled && result.filePaths.length > 0) {
        await loadFile(result.filePaths[0]);
      }
    } catch (error) {
      message.error('选择文件失败');
    }
  }, []);

  const loadFile = useCallback(async (path: string) => {
    const fileNameFromPath = path.split(/[\\/]/).pop() || '';
    
    setLoadingState({ isLoading: true, stage: 'reading', progress: 0, message: '正在读取文件...' });
    setFilePath(path);
    
    try {
      const result = await window.electron.ipcRenderer.invoke('file:read', path);
      
      if (!result.success) {
        message.error('读取文件失败: ' + result.error);
        setLoadingState({ isLoading: false, stage: 'complete', progress: 0, message: '' });
        return;
      }
      
      setLoadingState({ isLoading: true, stage: 'rendering', progress: 60, message: '正在处理分页...' });
      setFileName(fileNameFromPath);
      
      let pages: string[] = [];
      let startPages: number[] = [];
      
      if (result.metadata?.chapters && result.metadata.chapters.length > 0) {
        const epubChapters = result.metadata.chapters.map((c: any) => ({
          id: c.id,
          title: c.title,
          content: c.content || '',
        }));
        
        let currentPageIndex = 0;
        const allPages: string[] = [];
        
        for (const chapter of epubChapters) {
          startPages.push(currentPageIndex);
          const chapterPages = splitContentIntoPages(chapter.content, PAGE_SIZE);
          allPages.push(...chapterPages);
          currentPageIndex += chapterPages.length;
        }
        
        pages = allPages;
        setChapters(epubChapters);
      } else {
        const fullContent = result.data || '';
        pages = splitContentIntoPages(fullContent, PAGE_SIZE);
        setChapters([{ id: '1', title: fileNameFromPath, content: fullContent }]);
        startPages = [0];
      }
      
      setChapterStartPages(startPages);
      setPageContents(pages);
      setTotalPages(pages.length);
      setCurrentPage(0);
      setCurrentChapter(0);
      setFileContent(pages[0] || '');
      
      setLoadingState({ isLoading: false, stage: 'complete', progress: 100, message: '加载完成' });
      message.success(`文件加载成功，共 ${pages.length} 页`);
      
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: result.metadata?.title || fileNameFromPath,
        filePath: path,
        format: path.split('.').pop() || '',
        progress: 0,
        currentPosition: '0',
        bookmarks: '[]',
        lastReadAt: new Date().toISOString(),
      });
      
      const masteredWords = await window.electron.ipcRenderer.invoke('db:getMasteredWords');
      if (masteredWords && masteredWords.length > 0) {
        setKnownWords(new Set(masteredWords.map((w: string) => w.toLowerCase())));
      }
      
    } catch (error) {
      message.error('读取文件失败');
      setLoadingState({ isLoading: false, stage: 'complete', progress: 0, message: '' });
    }
  }, []);

  const goToPage = useCallback((pageNum: number) => {
    if (pageNum >= 0 && pageNum < totalPages) {
      setCurrentPage(pageNum);
      setFileContent(pageContents[pageNum]);
      
      for (let i = chapterStartPages.length - 1; i >= 0; i--) {
        if (pageNum >= chapterStartPages[i]) {
          setCurrentChapter(i);
          break;
        }
      }
      
      saveReadingProgressForPage(pageNum, totalPages, filePath, fileName);
    }
  }, [totalPages, pageContents, chapterStartPages, filePath, fileName]);

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 0) goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) goToPage(currentPage + 1);
  }, [currentPage, totalPages, goToPage]);

  const jumpToChapter = useCallback((index: number) => {
    if (index >= 0 && index < chapterStartPages.length) {
      goToPage(chapterStartPages[index]);
    }
  }, [chapterStartPages, goToPage]);

  return {
    fileContent,
    fileName,
    filePath,
    loadingState,
    chapters,
    currentChapter,
    chapterStartPages,
    currentPage,
    totalPages,
    pageContents,
    knownWords,
    handleFileSelect,
    loadFile,
    goToPage,
    goToPreviousPage,
    goToNextPage,
    jumpToChapter,
  };
}

async function saveReadingProgressForPage(pageNum: number, totalPages: number, filePath: string, fileName: string) {
  if (!filePath || !fileName) return;
  
  try {
    const progress = totalPages > 0 ? Math.round((pageNum / totalPages) * 100) : 0;
    
    await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
      bookName: fileName,
      filePath: filePath,
      format: filePath.split('.').pop() || '',
      progress: progress,
      currentPosition: pageNum.toString(),
      lastReadAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('保存阅读进度失败:', error);
  }
}

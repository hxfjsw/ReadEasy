import { useState, useCallback } from 'react';
import { message } from 'antd';
import { splitContentIntoPages } from '../utils/readerHelpers';
import type { Chapter, LoadingState } from '../types/reader';

// 路径标准化：统一转换为小写并使用正斜杠
function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\\/g, '/');
}

export function useReaderFile() {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [bookName, setBookName] = useState<string>('');
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

  // 分页参数已改为按单词数（约500词/页），不再使用字符数

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
    console.log('[useReaderFile] ========== 开始加载文件 ==========');
    console.log('[useReaderFile] 文件路径:', path);
    console.log('[useReaderFile] 标准化路径:', normalizePath(path));
    
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
      
      // 使用元数据标题或清理后的文件名作为书名（用于单词本）
      const cleanBookName = result.metadata?.title || fileNameFromPath.replace(/\.[^/.]+$/, '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      setBookName(cleanBookName);
      
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
          // 在章节内容开头添加标题
          const contentWithTitle = chapter.title 
            ? `# ${chapter.title}\n\n${chapter.content}` 
            : chapter.content;
          const chapterPages = splitContentIntoPages(contentWithTitle);
          allPages.push(...chapterPages);
          currentPageIndex += chapterPages.length;
        }
        
        pages = allPages;
        setChapters(epubChapters);
      } else {
        const fullContent = result.data || '';
        pages = splitContentIntoPages(fullContent);
        setChapters([{ id: '1', title: fileNameFromPath, content: fullContent }]);
        startPages = [0];
      }
      
      console.log('[useReaderFile] 分页完成，总页数:', pages.length);
      setChapterStartPages(startPages);
      setPageContents(pages);
      setTotalPages(pages.length);
      
      // 查询上次阅读进度
      let savedPage = 0;
      try {
        console.log('[useReaderFile] ---------- 查询阅读记录 ----------');
        const records = await window.electron.ipcRenderer.invoke('db:getReadingRecords');
        console.log('[useReaderFile] 获取到记录数:', records?.length || 0);
        
        const normalizedTargetPath = normalizePath(path);
        console.log('[useReaderFile] 目标路径(标准化):', normalizedTargetPath);
        
        // 打印所有记录用于调试
        if (records && records.length > 0) {
          console.log('[useReaderFile] --- 所有记录 ---');
          records.forEach((r: any, i: number) => {
            const recordPath = r.filePath || r.file_path || '';
            const normalizedRecordPath = normalizePath(recordPath);
            console.log(`[useReaderFile] [${i}] id=${r.id}, path="${recordPath}"`);
            console.log(`[useReaderFile] [${i}] normalized="${normalizedRecordPath}"`);
            console.log(`[useReaderFile] [${i}] currentPosition=${r.currentPosition || r.current_position}`);
          });
        }
        
        const record = records?.find((r: any) => {
          const recordPath = r.filePath || r.file_path || '';
          const normalizedRecordPath = normalizePath(recordPath);
          const match = normalizedRecordPath === normalizedTargetPath;
          console.log(`[useReaderFile] 对比: "${normalizedRecordPath}" === "${normalizedTargetPath}" ? ${match}`);
          return match;
        });
        
        console.log('[useReaderFile] 找到匹配记录:', record ? '是' : '否');
        
        if (record) {
          console.log('[useReaderFile] 记录详情:', {
            id: record.id,
            filePath: record.filePath || record.file_path,
            currentPosition: record.currentPosition || record.current_position,
            progress: record.progress,
          });
          
          const positionValue = record.currentPosition || record.current_position;
          console.log('[useReaderFile] positionValue:', positionValue);
          
          if (positionValue) {
            const pageNum = parseInt(String(positionValue), 10);
            console.log('[useReaderFile] 解析页码:', pageNum, '类型:', typeof pageNum);
            console.log('[useReaderFile] 有效范围: 0 -', pages.length - 1);
            
            if (!isNaN(pageNum) && pageNum >= 0 && pageNum < pages.length) {
              savedPage = pageNum;
              console.log('[useReaderFile] ✓ 使用保存的页码:', savedPage);
            } else {
              console.log('[useReaderFile] ✗ 页码无效，使用第0页');
            }
          } else {
            console.log('[useReaderFile] ✗ 记录中没有 currentPosition，使用第0页');
          }
        } else {
          console.log('[useReaderFile] ✗ 未找到匹配记录，使用第0页');
        }
      } catch (e) {
        console.error('[useReaderFile] 获取阅读进度失败:', e);
      }
      
      console.log('[useReaderFile] ---------- 设置页面状态 ----------');
      console.log('[useReaderFile] 最终页码:', savedPage);
      setCurrentPage(savedPage);
      setFileContent(pages[savedPage] || '');
      console.log('[useReaderFile] 已设置 currentPage =', savedPage);
      
      // 设置当前章节
      let foundChapter = 0;
      for (let i = startPages.length - 1; i >= 0; i--) {
        if (savedPage >= startPages[i]) {
          foundChapter = i;
          break;
        }
      }
      console.log('[useReaderFile] 设置当前章节:', foundChapter);
      setCurrentChapter(foundChapter);
      
      setLoadingState({ isLoading: false, stage: 'complete', progress: 100, message: '加载完成' });
      message.success(`文件加载成功，共 ${pages.length} 页${savedPage > 0 ? `，已恢复至第 ${savedPage + 1} 页` : ''}`);
      
      // 更新阅读记录
      console.log('[useReaderFile] 更新阅读记录...');
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: result.metadata?.title || fileNameFromPath,
        filePath: path,
        format: path.split('.').pop() || '',
        progress: Math.round((savedPage / pages.length) * 100),
        currentPosition: savedPage.toString(),
        bookmarks: '[]',
        lastReadAt: new Date().toISOString(),
      });
      
      const masteredWords = await window.electron.ipcRenderer.invoke('db:getMasteredWords');
      if (masteredWords && masteredWords.length > 0) {
        setKnownWords(new Set(masteredWords.map((w: string) => w.toLowerCase())));
      }
      
      console.log('[useReaderFile] ========== 加载完成 ==========');
      
    } catch (error) {
      console.error('[useReaderFile] 加载文件失败:', error);
      message.error('读取文件失败');
      setLoadingState({ isLoading: false, stage: 'complete', progress: 0, message: '' });
    }
  }, []);

  const goToPage = useCallback((pageNum: number) => {
    console.log('[useReaderFile] goToPage:', pageNum);
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
    bookName,
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
    console.log('[useReaderFile] 保存阅读进度:', { pageNum, progress, filePath });
    
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

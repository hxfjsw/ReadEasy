import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import type { BookshelfItem } from '../types';

export const useBookshelf = () => {
  const [books, setBooks] = useState<BookshelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookshelfItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const loadBooks = useCallback(async () => {
    console.log('[Bookshelf] loadBooks 开始...');
    setLoading(true);
    try {
      const records = await window.electron.ipcRenderer.invoke('db:getReadingRecords');
      
      const validRecords = (records || [])
        .filter((record: BookshelfItem) => {
          const path = record.filePath || record.file_path;
          return path && path.trim() !== '';
        })
        .map((record: BookshelfItem): BookshelfItem => {
          const rawDate = record.lastReadAt || record.last_read_at;
          let parsedDate: Date;
          if (typeof rawDate === 'number') {
            parsedDate = rawDate < 1e10 ? new Date(rawDate * 1000) : new Date(rawDate);
          } else if (typeof rawDate === 'string') {
            parsedDate = new Date(rawDate);
          } else {
            parsedDate = new Date();
          }
          
          return {
            ...record,
            filePath: (record.filePath || record.file_path) as string,
            lastReadAt: parsedDate,
          };
        })
        .sort((a: BookshelfItem, b: BookshelfItem) => 
          new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime()
        );
      
      setBooks(validRecords);
    } catch (error) {
      console.error('[Bookshelf] 加载书架失败:', error);
      message.error('加载书架失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleDeleteBook = useCallback(async (id: number) => {
    try {
      await window.electron.ipcRenderer.invoke('db:deleteReadingRecord', id);
      message.success('已从书架移除');
      loadBooks();
    } catch (error) {
      message.error('删除失败');
    }
  }, [loadBooks]);

  const handleAddBook = useCallback(async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('file:open');
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileResult = await window.electron.ipcRenderer.invoke('file:read', filePath);
        
        if (fileResult.success) {
          const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
          const bookData = {
            bookName: fileResult.metadata?.title || fileName,
            filePath: filePath,
            format: filePath.split('.').pop() || '',
            progress: 0,
            currentPosition: '0',
            bookmarks: '[]',
          };
          
          const addResult = await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', bookData);
          
          if (addResult) {
            message.success('已添加到书架');
            await loadBooks();
          } else {
            message.error('添加到书架失败');
          }
        } else {
          message.error('读取文件失败: ' + (fileResult.error || '未知错误'));
        }
      }
    } catch (error) {
      console.error('[Bookshelf] 添加书籍失败:', error);
      message.error('添加书籍失败');
    }
  }, [loadBooks]);

  const handleOpenBook = useCallback(async (book: BookshelfItem, onOpenBook?: (filePath: string) => void) => {
    if (!book.filePath) {
      message.error('文件路径不存在');
      return;
    }
    
    try {
      const result = await window.electron.ipcRenderer.invoke('file:read', book.filePath);
      if (result.success) {
        if (onOpenBook) {
          onOpenBook(book.filePath);
        } else {
          window.dispatchEvent(new CustomEvent('openBookFromBookshelf', { 
            detail: { filePath: book.filePath } 
          }));
        }
      } else {
        message.error('文件不存在或已被移动');
      }
    } catch (error) {
      message.error('打开文件失败');
    }
  }, []);

  const showBookDetail = useCallback((book: BookshelfItem) => {
    setSelectedBook(book);
    setDetailModalOpen(true);
  }, []);

  return {
    books,
    loading,
    selectedBook,
    detailModalOpen,
    setDetailModalOpen,
    loadBooks,
    handleDeleteBook,
    handleAddBook,
    handleOpenBook,
    showBookDetail,
  };
};

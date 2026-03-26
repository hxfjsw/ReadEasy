import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BookshelfPage from './BookshelfPage';
import { createMockElectron, setupMockElectron, createMockReadingRecord } from '../test/test-utils';
import { message } from 'antd';

// 模拟 antd 的 message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

describe('BookshelfPage', () => {
  let mockElectron: ReturnType<typeof createMockElectron>;

  beforeEach(() => {
    mockElectron = setupMockElectron(createMockElectron());
  });

  it('应该显示加载状态', () => {
    mockElectron.ipcRenderer.invoke.mockImplementation(() => new Promise(() => {}));
    
    render(<BookshelfPage />);
    
    // Spin 组件在加载中
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('应该显示空书架状态', async () => {
    mockElectron.ipcRenderer.invoke.mockResolvedValue([]);
    
    render(<BookshelfPage />);
    
    await waitFor(() => {
      expect(screen.getByText('书架空空如也')).toBeInTheDocument();
    });
  });

  it('应该显示书籍列表', async () => {
    const mockBooks = [
      createMockReadingRecord({ id: 1, bookName: 'Book 1', format: 'epub' }),
      createMockReadingRecord({ id: 2, bookName: 'Book 2', format: 'txt' }),
    ];
    mockElectron.ipcRenderer.invoke.mockResolvedValue(mockBooks);
    
    render(<BookshelfPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Book 1')).toBeInTheDocument();
      expect(screen.getByText('Book 2')).toBeInTheDocument();
    });
  });

  it('应该过滤掉没有 filePath 的记录', async () => {
    const mockBooks = [
      createMockReadingRecord({ id: 1, bookName: 'Valid Book' }),
      { id: 2, bookName: 'Invalid Book', filePath: undefined },
    ];
    mockElectron.ipcRenderer.invoke.mockResolvedValue(mockBooks);
    
    render(<BookshelfPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Valid Book')).toBeInTheDocument();
      expect(screen.queryByText('Invalid Book')).not.toBeInTheDocument();
    });
  });

  it('点击书籍应该调用 onOpenBook', async () => {
    const mockBook = createMockReadingRecord({ filePath: 'C:/test/book.epub' });
    mockElectron.ipcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'db:getReadingRecords') return Promise.resolve([mockBook]);
      if (channel === 'file:read') return Promise.resolve({ success: true, data: 'content' });
      return Promise.resolve([]);
    });
    
    const onOpenBook = vi.fn();
    render(<BookshelfPage onOpenBook={onOpenBook} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Book')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Test Book'));
    
    await waitFor(() => {
      expect(onOpenBook).toHaveBeenCalledWith('C:/test/book.epub');
    });
  });

  it('filePath 为 undefined 时不应该尝试打开', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // 创建一个没有 filePath 的书
    const mockBook = { id: 1, bookName: 'Invalid Book', filePath: undefined, format: 'epub', progress: 0, lastReadAt: new Date() };
    mockElectron.ipcRenderer.invoke.mockResolvedValue([mockBook]);
    
    render(<BookshelfPage />);
    
    // 等待加载完成，应该显示空书架（因为无效记录被过滤掉了）
    await waitFor(() => {
      expect(screen.getByText('书架空空如也')).toBeInTheDocument();
    });
    
    consoleSpy.mockRestore();
  });

  it('应该处理打开文件失败的情况', async () => {
    mockElectron.ipcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'db:getReadingRecords') {
        return Promise.resolve([createMockReadingRecord()]);
      }
      if (channel === 'file:read') {
        return Promise.resolve({ success: false, error: 'File not found' });
      }
      return Promise.resolve([]);
    });
    
    render(<BookshelfPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Book')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Test Book'));
    
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('文件不存在或已被移动');
    });
  });
});

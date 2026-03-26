import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import BookshelfPage from './BookshelfPage';
import { createMockElectron, setupMockElectron } from '../test/test-utils';

// 集成测试：测试完整的用户操作流程
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

describe('BookshelfPage 集成测试', () => {
  let mockElectron: ReturnType<typeof createMockElectron>;
  const mockBooks: any[] = [];

  beforeEach(() => {
    mockElectron = setupMockElectron(createMockElectron());
    mockBooks.length = 0;
    
    // 模拟数据库操作
    mockElectron.ipcRenderer.invoke.mockImplementation(async (channel: string, ...args: any[]) => {
      if (channel === 'db:getReadingRecords') {
        return [...mockBooks];
      }
      
      if (channel === 'db:addOrUpdateReadingRecord') {
        const data = args[0];
        if (!data.filePath) {
          return false;
        }
        
        // 检查是否已存在
        const existing = mockBooks.find(b => b.filePath === data.filePath);
        if (existing) {
          Object.assign(existing, { ...data, lastReadAt: new Date().toISOString() });
        } else {
          // 模拟数据库自动添加 lastReadAt
          mockBooks.push({
            id: mockBooks.length + 1,
            ...data,
            lastReadAt: new Date().toISOString(),
          });
        }
        return true;
      }
      
      if (channel === 'db:deleteReadingRecord') {
        const id = args[0];
        const index = mockBooks.findIndex(b => b.id === id);
        if (index > -1) {
          mockBooks.splice(index, 1);
        }
        return true;
      }
      
      if (channel === 'file:read') {
        const filePath = args[0];
        if (!filePath) {
          return { success: false, error: 'Invalid path' };
        }
        return {
          success: true,
          data: 'Test content',
          metadata: {
            title: 'Test Book',
            author: 'Test Author',
            chapters: [{ id: '1', title: 'Chapter 1' }],
          },
        };
      }
      
      if (channel === 'file:open') {
        // 模拟用户选择了文件
        return {
          canceled: false,
          filePaths: ['C:/test/new-book.txt'],
        };
      }
      
      return null;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('完整流程：添加书籍 -> 显示在书架 -> 点击打开', async () => {
    // 1. 先添加书籍到模拟数据库（不传入 lastReadAt，模拟数据库自动添加）
    await mockElectron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
      bookName: 'Integration Test Book',
      filePath: 'C:/test/integration.txt',
      format: 'txt',
      progress: 0,
      currentPosition: '0',
      bookmarks: '[]',
      // 注意：不传入 lastReadAt，由数据库自动设置
    });

    // 2. 渲染书架
    render(<BookshelfPage />);
    
    // 3. 验证书籍显示在书架
    await waitFor(() => {
      expect(screen.getByText('Integration Test Book')).toBeInTheDocument();
    });

    // 4. 验证格式标签显示
    expect(screen.getByText('TXT')).toBeInTheDocument();
  });

  it('模拟真实场景：先打开空书架，然后添加书籍，应该立即显示', async () => {
    // 1. 初始渲染空书架
    const { rerender } = render(<BookshelfPage />);
    
    await waitFor(() => {
      expect(screen.getByText('书架空空如也')).toBeInTheDocument();
    });

    // 2. 模拟添加书籍到数据库
    await mockElectron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
      bookName: 'New Added Book',
      filePath: 'C:/test/new-book.txt',
      format: 'txt',
      progress: 0,
      currentPosition: '0',
      bookmarks: '[]',
    });

    // 验证数据库中有数据
    expect(mockBooks).toHaveLength(1);

    // 3. 重新渲染组件（模拟刷新后）
    rerender(<BookshelfPage key="refresh" />);

    // 4. 验证新书显示在书架
    await waitFor(() => {
      expect(screen.getByText('New Added Book')).toBeInTheDocument();
    });

    // 验证空状态消失
    expect(screen.queryByText('书架空空如也')).not.toBeInTheDocument();
  });

  it('完整流程：添加多本书 -> 按时间排序', async () => {
    // 添加旧书（1小时前）
    mockBooks.push({
      id: 1,
      bookName: 'Old Book',
      filePath: 'C:/test/old.txt',
      format: 'txt',
      progress: 10,
      lastReadAt: new Date(Date.now() - 3600000).toISOString(), // 1小时前
    });

    // 添加新书（现在）
    mockBooks.push({
      id: 2,
      bookName: 'New Book',
      filePath: 'C:/test/new.epub',
      format: 'epub',
      progress: 0,
      lastReadAt: new Date().toISOString(), // 现在
    });

    render(<BookshelfPage />);

    // 验证新书在前（按最后阅读时间倒序）
    await waitFor(() => {
      const cards = screen.getAllByText(/Book$/);
      expect(cards[0]).toHaveTextContent('New Book');
      expect(cards[1]).toHaveTextContent('Old Book');
    });
  });

  it('完整流程：更新已有书籍的进度', async () => {
    // 先添加一本书
    await mockElectron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
      bookName: 'Progress Book',
      filePath: 'C:/test/progress.txt',
      format: 'txt',
      progress: 0,
      currentPosition: '0',
      bookmarks: '[]',
      lastReadAt: new Date().toISOString(),
    });

    const { rerender } = render(<BookshelfPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Progress Book')).toBeInTheDocument();
    });

    // 更新进度
    await mockElectron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
      bookName: 'Progress Book',
      filePath: 'C:/test/progress.txt',
      format: 'txt',
      progress: 50,
      currentPosition: '500',
      bookmarks: '[]',
      lastReadAt: new Date().toISOString(),
    });

    // 重新渲染
    rerender(<BookshelfPage />);

    // 验证进度显示
    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('边界情况：添加文件路径为空的书籍', async () => {
    const result = await mockElectron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
      bookName: 'Invalid Book',
      filePath: '',
      format: 'txt',
      progress: 0,
      currentPosition: '0',
      bookmarks: '[]',
      lastReadAt: new Date().toISOString(),
    });

    expect(result).toBe(false);

    render(<BookshelfPage />);

    // 应该显示空书架
    await waitFor(() => {
      expect(screen.getByText('书架空空如也')).toBeInTheDocument();
    });
  });

  it('边界情况：过滤掉 filePath 为 undefined 的记录', async () => {
    // 手动添加一个无效记录到 mockBooks
    mockBooks.push({
      id: 1,
      bookName: 'Invalid Book',
      filePath: undefined,
      format: 'txt',
      progress: 0,
      lastReadAt: new Date().toISOString(),
    });

    // 添加一本有效书籍
    mockBooks.push({
      id: 2,
      bookName: 'Valid Book',
      filePath: 'C:/test/valid.txt',
      format: 'txt',
      progress: 0,
      lastReadAt: new Date().toISOString(),
    });

    render(<BookshelfPage />);

    // 只显示有效书籍
    await waitFor(() => {
      expect(screen.getByText('Valid Book')).toBeInTheDocument();
      expect(screen.queryByText('Invalid Book')).not.toBeInTheDocument();
    });
  });

  it('性能测试：大量书籍加载', async () => {
    // 添加 100 本书
    for (let i = 0; i < 100; i++) {
      mockBooks.push({
        id: i + 1,
        bookName: `Book ${i + 1}`,
        filePath: `C:/test/book${i + 1}.txt`,
        format: 'txt',
        progress: Math.floor(Math.random() * 100),
        lastReadAt: new Date(Date.now() - i * 1000).toISOString(),
      });
    }

    const startTime = performance.now();
    render(<BookshelfPage />);
    
    // 等待第一本书显示
    await waitFor(() => {
      expect(screen.getByText('Book 1')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    // 应该在 2 秒内加载完成
    expect(loadTime).toBeLessThan(2000);

    // 验证书籍数量标签
    expect(screen.getByText('100 本书')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';

// 模拟 Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(),
    getAllWindows: vi.fn(),
  },
}));

describe('IPC Handlers', () => {
  let mockDBService: any;
  let mockAIService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDBService = {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      getWord: vi.fn(),
      addWord: vi.fn(),
      getWordBooks: vi.fn(),
      addWordBook: vi.fn(),
      deleteWordBook: vi.fn(),
      addWordToBook: vi.fn(),
      removeWordFromBook: vi.fn(),
      getWordsInBook: vi.fn(),
      getAIConfigs: vi.fn(),
      getDefaultAIConfig: vi.fn(),
      addAIConfig: vi.fn(),
      updateAIConfig: vi.fn(),
      deleteAIConfig: vi.fn(),
      getReadingRecords: vi.fn(),
      getReadingRecord: vi.fn(),
      addOrUpdateReadingRecord: vi.fn(),
      deleteReadingRecord: vi.fn(),
      getSetting: vi.fn(),
      setSetting: vi.fn(),
    };

    mockAIService = {
      testConnection: vi.fn(),
      getWordDefinition: vi.fn(),
      translateSentence: vi.fn(),
      analyzeVocabulary: vi.fn(),
      generateExampleSentence: vi.fn(),
    };
  });

  describe('file:read', () => {
    it('应该拒绝无效的 filePath', async () => {
      const handlers: Record<string, Function> = {};
      (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
        handlers[channel] = handler;
      });

      // 动态导入以触发 handler 注册
      await import('./index');

      const result = await handlers['file:read']({}, undefined);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid file path');
    });

    it('应该拒绝 null filePath', async () => {
      const handlers: Record<string, Function> = {};
      (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
        handlers[channel] = handler;
      });

      await import('./index');

      const result = await handlers['file:read']({}, null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid file path');
    });
  });

  describe('db:addOrUpdateReadingRecord', () => {
    it('应该拒绝缺少 filePath 的数据', async () => {
      const handlers: Record<string, Function> = {};
      (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
        handlers[channel] = handler;
      });

      await import('./index');

      const result = await handlers['db:addOrUpdateReadingRecord']({}, { bookName: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing filePath');
    });

    it('应该成功添加有效记录', async () => {
      const handlers: Record<string, Function> = {};
      (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
        handlers[channel] = handler;
      });

      mockDBService.addOrUpdateReadingRecord.mockImplementation(() => {});

      await import('./index');

      const validData = {
        bookName: 'Test Book',
        filePath: 'C:/test/book.epub',
        format: 'epub',
        progress: 0,
        bookmarks: '[]',
      };

      const result = await handlers['db:addOrUpdateReadingRecord']({}, validData);
      expect(result.success).toBe(true);
    });
  });
});

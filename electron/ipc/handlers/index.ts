import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../../services/database';
import { AIService } from '../../services/ai';
import { ParserService } from '../../services/parser';

export function registerIPCHandlers(
  dbService: DatabaseService,
  aiService: AIService
): void {
  const parserService = new ParserService();
  
  console.log('[IPC] Registering IPC handlers...');
  
  // 获取主窗口的辅助函数
  const getMainWindow = (): BrowserWindow | undefined => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) return win;
    
    const allWindows = BrowserWindow.getAllWindows();
    return allWindows.length > 0 ? allWindows[0] : undefined;
  };
  
  // 文件操作
  ipcMain.handle('file:open', async () => {
    console.log('[IPC] file:open called');
    try {
      const parentWindow = getMainWindow();
      console.log('[IPC] file:open parent window:', parentWindow ? 'found' : 'not found');
      
      const result = await dialog.showOpenDialog(parentWindow as any, {
        properties: ['openFile'],
        filters: [
          { name: 'Ebooks', extensions: ['epub', 'mobi', 'txt'] },
          { name: 'EPUB', extensions: ['epub'] },
          { name: 'MOBI', extensions: ['mobi'] },
          { name: 'Text', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      console.log('[IPC] file:open result:', result);
      return result;
    } catch (error) {
      console.error('[IPC] file:open error:', error);
      throw error;
    }
  });

  ipcMain.handle('file:read', async (_, filePath: string) => {
    console.log('[IPC] file:read called with path:', filePath);
    try {
      const ext = path.extname(filePath).toLowerCase();
      console.log('[IPC] file:read extension:', ext);
      
      if (ext === '.epub') {
        console.log('[IPC] file:read parsing EPUB...');
        const book = await parserService.parseEpub(filePath);
        console.log('[IPC] file:read EPUB parsed, title:', book.title, 'chapters:', book.chapters.length);
        return { 
          success: true, 
          data: book.content,
          metadata: {
            title: book.title,
            author: book.author,
            chapters: book.chapters.map(c => ({ id: c.id, title: c.title })),
          }
        };
      } else if (ext === '.txt') {
        console.log('[IPC] file:read parsing TXT...');
        const book = await parserService.parseTxt(filePath);
        console.log('[IPC] file:read TXT parsed, title:', book.title);
        return { 
          success: true, 
          data: book.content,
          metadata: {
            title: book.title,
            author: book.author,
            chapters: book.chapters.map(c => ({ id: c.id, title: c.title })),
          }
        };
      } else {
        console.log('[IPC] file:read reading as plain text...');
        const data = fs.readFileSync(filePath, 'utf-8');
        console.log('[IPC] file:read plain text read, length:', data.length);
        return { success: true, data };
      }
    } catch (error: any) {
      console.error('[IPC] file:read error:', error);
      return { success: false, error: error.message };
    }
  });

  // 数据库操作 - 用户
  ipcMain.handle('db:getUser', async () => {
    console.log('[IPC] db:getUser called');
    return dbService.getUser();
  });

  ipcMain.handle('db:updateUser', async (_, id: number, data: any) => {
    console.log('[IPC] db:updateUser called');
    dbService.updateUser(id, data);
    return true;
  });

  // 数据库操作 - 单词
  ipcMain.handle('db:getWord', async (_, word: string) => {
    console.log('[IPC] db:getWord called:', word);
    return dbService.getWord(word);
  });

  ipcMain.handle('db:addWord', async (_, data: any) => {
    console.log('[IPC] db:addWord called');
    return dbService.addWord(data);
  });

  // 数据库操作 - 单词本
  ipcMain.handle('db:getWordBooks', async () => {
    console.log('[IPC] db:getWordBooks called');
    return dbService.getWordBooks();
  });

  ipcMain.handle('db:addWordBook', async (_, data: any) => {
    console.log('[IPC] db:addWordBook called');
    return dbService.addWordBook(data);
  });

  ipcMain.handle('db:deleteWordBook', async (_, id: number) => {
    console.log('[IPC] db:deleteWordBook called');
    dbService.deleteWordBook(id);
    return true;
  });

  ipcMain.handle('db:addWordToBook', async (_, wordBookId: number, wordId: number, context?: string) => {
    console.log('[IPC] db:addWordToBook called');
    dbService.addWordToBook(wordBookId, wordId, context);
    return true;
  });

  ipcMain.handle('db:removeWordFromBook', async (_, wordBookId: number, wordId: number) => {
    console.log('[IPC] db:removeWordFromBook called');
    dbService.removeWordFromBook(wordBookId, wordId);
    return true;
  });

  ipcMain.handle('db:getWordsInBook', async (_, wordBookId: number) => {
    console.log('[IPC] db:getWordsInBook called');
    return dbService.getWordsInBook(wordBookId);
  });

  // 数据库操作 - AI配置
  ipcMain.handle('db:getAIConfigs', async () => {
    console.log('[IPC] db:getAIConfigs called');
    return dbService.getAIConfigs();
  });

  ipcMain.handle('db:getDefaultAIConfig', async () => {
    console.log('[IPC] db:getDefaultAIConfig called');
    return dbService.getDefaultAIConfig();
  });

  ipcMain.handle('db:addAIConfig', async (_, data: any) => {
    console.log('[IPC] db:addAIConfig called');
    return dbService.addAIConfig(data);
  });

  ipcMain.handle('db:updateAIConfig', async (_, id: number, data: any) => {
    console.log('[IPC] db:updateAIConfig called');
    dbService.updateAIConfig(id, data);
    return true;
  });

  ipcMain.handle('db:deleteAIConfig', async (_, id: number) => {
    console.log('[IPC] db:deleteAIConfig called');
    dbService.deleteAIConfig(id);
    return true;
  });

  // 数据库操作 - 阅读记录
  ipcMain.handle('db:getReadingRecords', async () => {
    console.log('[IPC] db:getReadingRecords called');
    return dbService.getReadingRecords();
  });

  ipcMain.handle('db:getReadingRecord', async (_, filePath: string) => {
    console.log('[IPC] db:getReadingRecord called');
    return dbService.getReadingRecord(filePath);
  });

  ipcMain.handle('db:addOrUpdateReadingRecord', async (_, data: any) => {
    console.log('[IPC] db:addOrUpdateReadingRecord called');
    dbService.addOrUpdateReadingRecord(data);
    return true;
  });

  ipcMain.handle('db:deleteReadingRecord', async (_, id: number) => {
    console.log('[IPC] db:deleteReadingRecord called');
    dbService.deleteReadingRecord(id);
    return true;
  });

  // 数据库操作 - 设置
  ipcMain.handle('db:getSetting', async (_, key: string) => {
    console.log('[IPC] db:getSetting called:', key);
    return dbService.getSetting(key);
  });

  ipcMain.handle('db:setSetting', async (_, key: string, value: string) => {
    console.log('[IPC] db:setSetting called:', key);
    dbService.setSetting(key, value);
    return true;
  });

  // AI服务
  ipcMain.handle('ai:testConnection', async (_, config: any) => {
    console.log('[IPC] ai:testConnection called');
    return aiService.testConnection(config);
  });

  ipcMain.handle('ai:defineWord', async (_, params: { word: string; context?: string; configId?: number }) => {
    console.log('[IPC] ai:defineWord called:', params.word);
    return aiService.getWordDefinition(params.word, params.context, params.configId);
  });

  ipcMain.handle('ai:translate', async (_, params: { text: string; configId?: number }) => {
    console.log('[IPC] ai:translate called');
    return aiService.translateSentence(params.text, params.configId);
  });

  ipcMain.handle('ai:analyzeVocabulary', async (_, params: { text: string; configId?: number }) => {
    console.log('[IPC] ai:analyzeVocabulary called');
    return aiService.analyzeVocabulary(params.text, params.configId);
  });

  ipcMain.handle('ai:generateExample', async (_, params: { word: string; level: string; configId?: number }) => {
    console.log('[IPC] ai:generateExample called:', params.word);
    return aiService.generateExampleSentence(params.word, params.level, params.configId);
  });

  // 窗口控制
  ipcMain.handle('window:minimize', async () => {
    console.log('[IPC] window:minimize called');
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
  });

  ipcMain.handle('window:maximize', async () => {
    console.log('[IPC] window:maximize called');
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle('window:close', async () => {
    console.log('[IPC] window:close called');
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
  });
  
  console.log('[IPC] All IPC handlers registered');
}

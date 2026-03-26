import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import { DatabaseService } from '../../services/database';
import { AIService } from '../../services/ai';

export function registerIPCHandlers(
  dbService: DatabaseService,
  aiService: AIService
): void {
  // 文件操作
  ipcMain.handle('file:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Ebooks', extensions: ['epub', 'mobi', 'txt'] },
        { name: 'EPUB', extensions: ['epub'] },
        { name: 'MOBI', extensions: ['mobi'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result;
  });

  ipcMain.handle('file:read', async (_, filePath: string) => {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 数据库操作 - 用户
  ipcMain.handle('db:getUser', async () => {
    return dbService.getUser();
  });

  ipcMain.handle('db:updateUser', async (_, id: number, data: any) => {
    dbService.updateUser(id, data);
    return true;
  });

  // 数据库操作 - 单词
  ipcMain.handle('db:getWord', async (_, word: string) => {
    return dbService.getWord(word);
  });

  ipcMain.handle('db:addWord', async (_, data: any) => {
    return dbService.addWord(data);
  });

  // 数据库操作 - 单词本
  ipcMain.handle('db:getWordBooks', async () => {
    return dbService.getWordBooks();
  });

  ipcMain.handle('db:addWordBook', async (_, data: any) => {
    return dbService.addWordBook(data);
  });

  ipcMain.handle('db:deleteWordBook', async (_, id: number) => {
    dbService.deleteWordBook(id);
    return true;
  });

  ipcMain.handle('db:addWordToBook', async (_, wordBookId: number, wordId: number, context?: string) => {
    dbService.addWordToBook(wordBookId, wordId, context);
    return true;
  });

  ipcMain.handle('db:removeWordFromBook', async (_, wordBookId: number, wordId: number) => {
    dbService.removeWordFromBook(wordBookId, wordId);
    return true;
  });

  ipcMain.handle('db:getWordsInBook', async (_, wordBookId: number) => {
    return dbService.getWordsInBook(wordBookId);
  });

  // 数据库操作 - AI配置
  ipcMain.handle('db:getAIConfigs', async () => {
    return dbService.getAIConfigs();
  });

  ipcMain.handle('db:getDefaultAIConfig', async () => {
    return dbService.getDefaultAIConfig();
  });

  ipcMain.handle('db:addAIConfig', async (_, data: any) => {
    return dbService.addAIConfig(data);
  });

  ipcMain.handle('db:updateAIConfig', async (_, id: number, data: any) => {
    dbService.updateAIConfig(id, data);
    return true;
  });

  ipcMain.handle('db:deleteAIConfig', async (_, id: number) => {
    dbService.deleteAIConfig(id);
    return true;
  });

  // 数据库操作 - 阅读记录
  ipcMain.handle('db:getReadingRecords', async () => {
    return dbService.getReadingRecords();
  });

  ipcMain.handle('db:getReadingRecord', async (_, filePath: string) => {
    return dbService.getReadingRecord(filePath);
  });

  ipcMain.handle('db:addOrUpdateReadingRecord', async (_, data: any) => {
    dbService.addOrUpdateReadingRecord(data);
    return true;
  });

  ipcMain.handle('db:deleteReadingRecord', async (_, id: number) => {
    dbService.deleteReadingRecord(id);
    return true;
  });

  // 数据库操作 - 设置
  ipcMain.handle('db:getSetting', async (_, key: string) => {
    return dbService.getSetting(key);
  });

  ipcMain.handle('db:setSetting', async (_, key: string, value: string) => {
    dbService.setSetting(key, value);
    return true;
  });

  // AI服务
  ipcMain.handle('ai:testConnection', async (_, config: any) => {
    return aiService.testConnection(config);
  });

  ipcMain.handle('ai:defineWord', async (_, params: { word: string; context?: string; configId?: number }) => {
    return aiService.getWordDefinition(params.word, params.context, params.configId);
  });

  ipcMain.handle('ai:translate', async (_, params: { text: string; configId?: number }) => {
    return aiService.translateSentence(params.text, params.configId);
  });

  ipcMain.handle('ai:analyzeVocabulary', async (_, params: { text: string; configId?: number }) => {
    return aiService.analyzeVocabulary(params.text, params.configId);
  });

  ipcMain.handle('ai:generateExample', async (_, params: { word: string; level: string; configId?: number }) => {
    return aiService.generateExampleSentence(params.word, params.level, params.configId);
  });

  // 窗口控制
  ipcMain.handle('window:minimize', async () => {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
  });

  ipcMain.handle('window:maximize', async () => {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle('window:close', async () => {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
  });
}

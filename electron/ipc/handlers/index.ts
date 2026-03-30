import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../../services/database';
import { AIService } from '../../services/ai';
import { ParserService } from '../../services/parser';
import { GoogleTranslationService } from '../../services/translation';
import { YoudaoDictionaryService } from '../../services/youdao-dict';
import { ecdictService } from '../../services/ecdict';
import { WordExtractionService } from '../../services/word-extraction';
import { registerPracticeHandlers } from './practice';

export function registerIPCHandlers(
  dbService: DatabaseService,
  aiService: AIService
): void {
  const parserService = new ParserService();
  const googleTranslateService = new GoogleTranslationService();
  const youdaoDictionaryService = new YoudaoDictionaryService();
  
  // 初始化 ECDICT 服务 - 从设置中读取路径
  const ecdictPath = dbService.getSetting('ecdict.path');
  if (ecdictPath) {
    ecdictService.setDatabasePath(ecdictPath);
  }
  
  console.log('[IPC] Registering IPC handlers...');
  
  // 文件操作
  ipcMain.handle('file:open', async (_, options?: { filters?: any[] }) => {
    console.log('[IPC] ===========================================');
    console.log('[IPC] file:open called - START');
    console.log('[IPC] ===========================================');
    
    try {
      // 获取主窗口
      const allWindows = BrowserWindow.getAllWindows();
      console.log('[IPC] file:open allWindows count:', allWindows.length);
      
      // 在 Ubuntu/Linux 上，dialog 可能需要在主进程中同步调用
      // 尝试不使用父窗口
      console.log('[IPC] file:open calling dialog.showOpenDialog without parent...');
      
      const dialogOptions: any = {
        properties: ['openFile'],
        filters: options?.filters || [
          { name: 'Ebooks', extensions: ['epub', 'mobi', 'txt'] },
          { name: 'EPUB', extensions: ['epub'] },
          { name: 'MOBI', extensions: ['mobi'] },
          { name: 'Text', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      };
      
      console.log('[IPC] file:open options:', JSON.stringify(dialogOptions));
      
      // 使用 try-catch 包裹，防止卡住
      const result = await Promise.race([
        dialog.showOpenDialog(dialogOptions),
        new Promise<{ canceled: boolean; filePaths: string[] }>((_, reject) => {
          setTimeout(() => reject(new Error('Dialog timeout')), 30000);
        }),
      ]);
      
      console.log('[IPC] file:open dialog result:', JSON.stringify(result));
      console.log('[IPC] file:open - END');
      return result;
    } catch (error) {
      console.error('[IPC] file:open ERROR:', error);
      console.error('[IPC] file:open stack:', (error as Error).stack);
      // 返回取消状态而不是抛出错误
      return { canceled: true, filePaths: [] };
    }
  });

  ipcMain.handle('file:read', async (_, filePath: string, options?: { maxContentSize?: number }) => {
    console.log('[IPC] file:read called with path:', filePath);
    
    // 参数校验
    if (!filePath || typeof filePath !== 'string') {
      console.error('[IPC] file:read error: Invalid filePath:', filePath);
      return { success: false, error: 'Invalid file path' };
    }
    
    try {
      const ext = path.extname(filePath).toLowerCase();
      console.log('[IPC] file:read extension:', ext);
      
      // 解析选项：默认最大10MB内容
      const maxContentSize = options?.maxContentSize || 10 * 1024 * 1024;
      const parseOptions = { maxContentSize };
      console.log('[IPC] file:read parseOptions:', { maxContentSize: `${(maxContentSize / 1024 / 1024).toFixed(0)}MB` });
      
      if (ext === '.epub') {
        console.log('[IPC] file:read parsing EPUB...');
        const book = await parserService.parseEpub(filePath, parseOptions);
        console.log('[IPC] file:read EPUB parsed, title:', book.title, 'chapters:', book.chapters.length);
        return { 
          success: true, 
          data: book.content,
          metadata: {
            title: book.title,
            author: book.author,
            chapters: book.chapters.map(c => ({ id: c.id, title: c.title, content: c.content })),
          }
        };
      } else if (ext === '.txt') {
        console.log('[IPC] file:read parsing TXT...');
        const book = await parserService.parseTxt(filePath, parseOptions);
        console.log('[IPC] file:read TXT parsed, title:', book.title);
        return { 
          success: true, 
          data: book.content,
          metadata: {
            title: book.title,
            author: book.author,
            chapters: book.chapters.map(c => ({ id: c.id, title: c.title, content: c.content })),
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
    console.log('[IPC] db:addWord called with:', data?.word);
    try {
      const id = dbService.addWord(data);
      console.log('[IPC] db:addWord success, id:', id);
      return { success: true, id };
    } catch (error: any) {
      console.error('[IPC] db:addWord error:', error);
      return { success: false, message: error.message };
    }
  });

  // 数据库操作 - 单词本
  ipcMain.handle('db:getWordBooks', async () => {
    console.log('[IPC] db:getWordBooks called');
    return dbService.getWordBooks();
  });

  ipcMain.handle('db:addWordBook', async (_, data: any) => {
    console.log('[IPC] db:addWordBook called with:', data);
    try {
      const id = dbService.addWordBook(data);
      console.log('[IPC] db:addWordBook success, id:', id);
      return { success: true, id };
    } catch (error: any) {
      console.error('[IPC] db:addWordBook error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteWordBook', async (_, id: number) => {
    console.log('[IPC] db:deleteWordBook called');
    dbService.deleteWordBook(id);
    return true;
  });

  ipcMain.handle('db:addWordToBook', async (_, wordBookId: number, wordId: number, context?: string, contextAnalysis?: string, contextTranslation?: string) => {
    console.log('[IPC] db:addWordToBook called:', { wordBookId, wordId, context, contextAnalysis, contextTranslation });
    try {
      dbService.addWordToBook(wordBookId, wordId, context, contextAnalysis, contextTranslation);
      console.log('[IPC] db:addWordToBook success');
      return true;
    } catch (error: any) {
      console.error('[IPC] db:addWordToBook error:', error);
      throw error;
    }
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

  ipcMain.handle('db:updateWordReview', async (_, itemId: number) => {
    console.log('[IPC] db:updateWordReview called');
    dbService.updateWordReview(itemId);
    return true;
  });

  ipcMain.handle('db:getWordsDueForReview', async () => {
    console.log('[IPC] db:getWordsDueForReview called');
    return dbService.getWordsDueForReview();
  });

  // 数据库操作 - 熟词本
  ipcMain.handle('db:addMasteredWord', async (_, word: string) => {
    console.log('[IPC] db:addMasteredWord called:', word);
    return dbService.addMasteredWord(word);
  });

  ipcMain.handle('db:removeMasteredWord', async (_, word: string) => {
    console.log('[IPC] db:removeMasteredWord called:', word);
    return dbService.removeMasteredWord(word);
  });

  ipcMain.handle('db:isMasteredWord', async (_, word: string) => {
    return dbService.isMasteredWord(word);
  });

  ipcMain.handle('db:getMasteredWords', async () => {
    console.log('[IPC] db:getMasteredWords called');
    return dbService.getMasteredWords();
  });

  // 数据库操作 - 废词本
  ipcMain.handle('db:addIgnoredWord', async (_, word: string, source?: string) => {
    console.log('[IPC] db:addIgnoredWord called:', word);
    return dbService.addIgnoredWord(word, source);
  });

  ipcMain.handle('db:batchAddIgnoredWords', async (_, words: string[], source?: string) => {
    console.log('[IPC] db:batchAddIgnoredWords called, count:', words.length);
    return dbService.batchAddIgnoredWords(words, source);
  });

  ipcMain.handle('db:removeIgnoredWord', async (_, word: string) => {
    console.log('[IPC] db:removeIgnoredWord called:', word);
    return dbService.removeIgnoredWord(word);
  });

  ipcMain.handle('db:isIgnoredWord', async (_, word: string) => {
    return dbService.isIgnoredWord(word);
  });

  ipcMain.handle('db:getIgnoredWords', async () => {
    console.log('[IPC] db:getIgnoredWords called');
    return dbService.getIgnoredWords();
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
    const records = dbService.getReadingRecords();
    console.log('[IPC] db:getReadingRecords returned', records?.length, 'records');
    return records;
  });

  ipcMain.handle('db:getReadingRecord', async (_, filePath: string) => {
    console.log('[IPC] db:getReadingRecord called');
    return dbService.getReadingRecord(filePath);
  });

  ipcMain.handle('db:addOrUpdateReadingRecord', async (_, data: any) => {
    console.log('[IPC] db:addOrUpdateReadingRecord called with:', data?.bookName, data?.filePath);
    
    // 参数校验
    if (!data || !data.filePath) {
      console.error('[IPC] db:addOrUpdateReadingRecord error: Missing filePath');
      return false;
    }
    
    try {
      dbService.addOrUpdateReadingRecord(data);
      console.log('[IPC] db:addOrUpdateReadingRecord success');
      return true;
    } catch (error: any) {
      console.error('[IPC] db:addOrUpdateReadingRecord error:', error);
      return false;
    }
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
    try {
      return await aiService.testConnection(config);
    } catch (error: any) {
      console.error('[IPC] ai:testConnection error:', error);
      return { success: false, message: error.message || '测试连接失败' };
    }
  });

  ipcMain.handle('ai:defineWord', async (_, params: { word: string; context?: string; configId?: number }) => {
    console.log('[IPC] ai:defineWord called:', params.word);
    
    // 第一步：优先尝试 ECDICT（如果已配置）
    if (ecdictService.isAvailable()) {
      try {
        console.log('[IPC] ai:defineWord trying ECDICT first...');
        const ecdictResult = ecdictService.lookup(params.word);
        if (ecdictResult) {
          console.log('[IPC] ai:defineWord ECDICT success');
          // 转换 ECDICT 格式为统一格式
          const dictResult = {
            word: ecdictResult.word,
            phoneticUs: ecdictResult.phoneticUs,
            phoneticUk: ecdictResult.phoneticUk,
            definitions: ecdictResult.definitionCn ? [{
              pos: ecdictResult.pos || '',
              meaningCn: ecdictResult.definitionCn,
              examples: [],
            }] : [],
            level: ecdictResult.level,
          };
          // 如果有上下文且已配置 AI，补充上下文分析
          if (params.context) {
            try {
              const detailedResult = await aiService.getWordDefinitionDetailed(params.word, params.context, params.configId);
              return { 
                success: true, 
                data: { ...dictResult, ...detailedResult },
                source: 'ecdict+ai'
              };
            } catch (aiError) {
              // AI 补充失败，返回基础词典结果
              console.log('[IPC] AI context analysis failed, returning ECDICT result only');
            }
          }
          return { success: true, data: dictResult, source: 'ecdict' };
        }
      } catch (ecdictError: any) {
        console.log('[IPC] ECDICT lookup failed:', ecdictError.message);
      }
    }
    
    // 第二步：ECDICT 未配置或未找到，尝试有道词典 API
    try {
      console.log('[IPC] ai:defineWord trying Youdao Dictionary API...');
      const dictResult = await youdaoDictionaryService.lookup(params.word);
      if (dictResult) {
        console.log('[IPC] ai:defineWord Youdao Dictionary API success');
        // 如果有上下文且已配置 AI，补充上下文分析
        if (params.context) {
          try {
            const detailedResult = await aiService.getWordDefinitionDetailed(params.word, params.context, params.configId);
            return { 
              success: true, 
              data: { ...dictResult, ...detailedResult },
              source: 'dictionary+ai'
            };
          } catch (aiError) {
            // AI 补充失败，返回基础词典结果
            console.log('[IPC] AI context analysis failed, returning dictionary result only');
          }
        }
        return { success: true, data: dictResult, source: 'dictionary' };
      }
    } catch (dictError: any) {
      console.log('[IPC] Youdao Dictionary API failed:', dictError.message);
    }
    
    // 第三步：有道词典 API 未找到，尝试 AI
    console.log('[IPC] ai:defineWord falling back to AI...');
    try {
      const result = await aiService.getWordDefinition(params.word, params.context, params.configId);
      return { success: true, data: result, source: 'ai' };
    } catch (error: any) {
      console.error('[IPC] ai:defineWord error:', error);
      // AI 未配置时，自动降级到 Google 翻译
      if (error.message?.includes('API key is not configured')) {
        console.log('[IPC] ai:defineWord falling back to Google Translate');
        try {
          const googleResult = await googleTranslateService.getWordDefinition(params.word);
          return { success: true, data: googleResult, source: 'google' };
        } catch (googleError: any) {
          console.error('[IPC] Google fallback error:', googleError);
          return { success: false, message: googleError.message || '获取单词释义失败' };
        }
      }
      return { success: false, message: error.message || '获取单词释义失败' };
    }
  });

  // 分步查询：基础定义（快速返回）
  ipcMain.handle('ai:defineWordBasic', async (_, params: { word: string; configId?: number }) => {
    console.log('[IPC] ai:defineWordBasic called:', params.word);
    
    // 第一步：优先尝试 ECDICT（如果已配置）
    if (ecdictService.isAvailable()) {
      try {
        console.log('[IPC] ai:defineWordBasic trying ECDICT first...');
        const ecdictResult = ecdictService.lookup(params.word);
        if (ecdictResult) {
          console.log('[IPC] ai:defineWordBasic ECDICT success');
          // 转换 ECDICT 格式为统一格式
          const dictResult = {
            word: ecdictResult.word,
            phoneticUs: ecdictResult.phoneticUs,
            phoneticUk: ecdictResult.phoneticUk,
            definitions: ecdictResult.definitionCn ? [{
              pos: ecdictResult.pos || '',
              meaningCn: ecdictResult.definitionCn,
              examples: [],
            }] : [],
            level: ecdictResult.level,
          };
          return { success: true, data: dictResult, source: 'ecdict' };
        }
      } catch (ecdictError: any) {
        console.log('[IPC] ECDICT lookup failed:', ecdictError.message);
      }
    }
    
    // 第二步：ECDICT 未配置或未找到，尝试有道词典 API
    try {
      console.log('[IPC] ai:defineWordBasic trying Youdao Dictionary API...');
      const dictResult = await youdaoDictionaryService.lookup(params.word);
      if (dictResult) {
        console.log('[IPC] ai:defineWordBasic Youdao Dictionary API success');
        return { success: true, data: dictResult, source: 'dictionary' };
      }
    } catch (dictError: any) {
      console.log('[IPC] Youdao Dictionary API failed:', dictError.message);
    }
    
    // 第三步：有道词典 API 未找到，尝试 AI
    console.log('[IPC] ai:defineWordBasic falling back to AI...');
    try {
      const result = await aiService.getWordDefinitionBasic(params.word, params.configId);
      return { success: true, data: result, source: 'ai' };
    } catch (error: any) {
      console.error('[IPC] ai:defineWordBasic error:', error);
      // AI 未配置时，自动降级到 Google 翻译
      if (error.message?.includes('API key is not configured')) {
        console.log('[IPC] ai:defineWordBasic falling back to Google Translate');
        try {
          const googleResult = await googleTranslateService.getWordDefinition(params.word);
          return { success: true, data: googleResult, source: 'google' };
        } catch (googleError: any) {
          console.error('[IPC] Google fallback error:', googleError);
          return { success: false, message: googleError.message || '获取单词释义失败' };
        }
      }
      return { success: false, message: error.message || '获取单词释义失败' };
    }
  });

  // 分步查询：详细定义（词源、词根、上下文分析）
  ipcMain.handle('ai:defineWordDetailed', async (_, params: { word: string; context?: string; configId?: number }) => {
    console.log('[IPC] ai:defineWordDetailed called:', params.word);
    try {
      const result = await aiService.getWordDefinitionDetailed(params.word, params.context, params.configId);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] ai:defineWordDetailed error:', error);
      return { success: false, message: error.message || '获取单词详细释义失败' };
    }
  });

  // Google 免费翻译服务（默认）
  ipcMain.handle('google:translate', async (_, params: { text: string; targetLang?: string }) => {
    console.log('[IPC] google:translate called');
    try {
      const result = await googleTranslateService.translate({
        text: params.text,
        targetLang: params.targetLang || 'zh-CN',
      });
      return { success: true, data: result.translatedText };
    } catch (error: any) {
      console.error('[IPC] google:translate error:', error);
      return { success: false, message: error.message || '翻译失败' };
    }
  });

  // 划句子翻译
  ipcMain.handle('translate:sentence', async (_, params: { text: string; targetLang?: string }) => {
    console.log('[IPC] translate:sentence called:', params.text?.substring(0, 50) + '...');
    try {
      const result = await googleTranslateService.translate({
        text: params.text,
        targetLang: params.targetLang || 'zh-CN',
      });
      console.log('[IPC] translate:sentence success');
      return { 
        success: true, 
        data: {
          originalText: params.text,
          translatedText: result.translatedText,
          detectedLanguage: result.detectedSourceLanguage,
        }
      };
    } catch (error: any) {
      console.error('[IPC] translate:sentence error:', error);
      return { success: false, message: error.message || '翻译失败' };
    }
  });

  ipcMain.handle('google:testConnection', async () => {
    console.log('[IPC] google:testConnection called');
    return googleTranslateService.testConnection();
  });

  // AI 翻译（需要配置 API key）
  ipcMain.handle('ai:translate', async (_, params: { text: string; configId?: number }) => {
    console.log('[IPC] ai:translate called');
    try {
      const result = await aiService.translateSentence(params.text, params.configId);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] ai:translate error:', error);
      return { success: false, message: error.message || '翻译失败' };
    }
  });

  ipcMain.handle('ai:analyzeVocabulary', async (_, params: { text: string; configId?: number }) => {
    console.log('[IPC] ai:analyzeVocabulary called');
    try {
      const result = await aiService.analyzeVocabulary(params.text, params.configId);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] ai:analyzeVocabulary error:', error);
      // 返回空数据而不是抛出错误，避免影响文件加载
      return { 
        success: false, 
        message: error.message || '词汇分析失败',
        data: { words: [], statistics: { totalWords: 0, uniqueWords: 0, byLevel: {} } }
      };
    }
  });

  ipcMain.handle('ai:generateExample', async (_, params: { word: string; level: string; configId?: number }) => {
    console.log('[IPC] ai:generateExample called:', params.word);
    try {
      const result = await aiService.generateExampleSentence(params.word, params.level, params.configId);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] ai:generateExample error:', error);
      return { success: false, message: error.message || '生成例句失败' };
    }
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

  // 音频文件管理
  ipcMain.handle('audio:getByBook', async (_, bookPath: string) => {
    console.log('[IPC] audio:getByBook called:', bookPath);
    try {
      const files = dbService.getAudioFilesByBook(bookPath);
      return { success: true, data: files };
    } catch (error: any) {
      console.error('[IPC] audio:getByBook error:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('audio:add', async (_, data: { bookPath: string; audioPath: string; audioName: string; duration?: number }) => {
    console.log('[IPC] audio:add called:', data.audioName);
    try {
      const id = dbService.addAudioFile(data);
      return { success: true, id };
    } catch (error: any) {
      console.error('[IPC] audio:add error:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('audio:delete', async (_, id: number) => {
    console.log('[IPC] audio:delete called:', id);
    try {
      dbService.deleteAudioFile(id);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] audio:delete error:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('audio:updateLastUsed', async (_, id: number) => {
    console.log('[IPC] audio:updateLastUsed called:', id);
    try {
      dbService.updateAudioFileLastUsed(id);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] audio:updateLastUsed error:', error);
      return { success: false, message: error.message };
    }
  });

  // 注册单词练习相关 handlers
  registerPracticeHandlers(dbService, aiService);

  // ===== ECDICT 词典服务 =====
  
  // 设置 ECDICT 数据库路径
  ipcMain.handle('ecdict:setPath', async (_, dbPath: string) => {
    console.log('[IPC] ecdict:setPath called:', dbPath);
    try {
      const success = ecdictService.setDatabasePath(dbPath);
      if (success) {
        // 保存到设置
        dbService.setSetting('ecdict.path', dbPath);
        dbService.setSetting('ecdict.enabled', 'true');
      }
      return { success, path: dbPath };
    } catch (error: any) {
      console.error('[IPC] ecdict:setPath error:', error);
      return { success: false, message: error.message };
    }
  });

  // 获取 ECDICT 数据库路径
  ipcMain.handle('ecdict:getPath', async () => {
    console.log('[IPC] ecdict:getPath called');
    return {
      path: ecdictService.getDatabasePath(),
      available: ecdictService.isAvailable(),
    };
  });

  // 测试 ECDICT 连接
  ipcMain.handle('ecdict:test', async () => {
    console.log('[IPC] ecdict:test called');
    return ecdictService.testConnection();
  });

  // 查询单个单词
  ipcMain.handle('ecdict:lookup', async (_, word: string) => {
    console.log('[IPC] ecdict:lookup called:', word);
    try {
      const result = ecdictService.lookup(word);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] ecdict:lookup error:', error);
      return { success: false, message: error.message };
    }
  });

  // 批量查询单词
  ipcMain.handle('ecdict:batchLookup', async (_, words: string[]) => {
    console.log('[IPC] ecdict:batchLookup called, words count:', words.length);
    try {
      const result = ecdictService.batchLookup(words);
      // 将 Map 转换为普通对象以便序列化
      const obj: Record<string, any> = {};
      result.forEach((value, key) => {
        obj[key] = value;
      });
      return { success: true, data: obj };
    } catch (error: any) {
      console.error('[IPC] ecdict:batchLookup error:', error);
      return { success: false, message: error.message };
    }
  });

  // 搜索单词
  ipcMain.handle('ecdict:search', async (_, query: string, limit?: number) => {
    console.log('[IPC] ecdict:search called:', query);
    try {
      const result = ecdictService.search(query, limit || 10);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] ecdict:search error:', error);
      return { success: false, message: error.message };
    }
  });

  // 获取 ECDICT 统计信息
  ipcMain.handle('ecdict:stats', async () => {
    console.log('[IPC] ecdict:stats called');
    try {
      const stats = ecdictService.getStats();
      return { success: true, data: stats };
    } catch (error: any) {
      console.error('[IPC] ecdict:stats error:', error);
      return { success: false, message: error.message };
    }
  });

  // ========== 单词提取服务 ==========
  const wordExtractionService = new WordExtractionService(
    dbService,
    parserService,
    ecdictService
  );

  // 从书籍中提取单词（完整的后端处理）
  ipcMain.handle('word:extract', async (_, filePath: string) => {
    console.log('[IPC] word:extract called:', filePath);
    try {
      const result = await wordExtractionService.extractWords(filePath);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] word:extract error:', error);
      return { success: false, message: error.message };
    }
  });
  
  console.log('[IPC] All IPC handlers registered');
}

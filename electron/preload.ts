import { contextBridge, ipcRenderer } from 'electron';

// 定义IPC通道类型
export interface IPCChannels {
  // 文件操作
  'file:open': () => Promise<{ canceled: boolean; filePaths: string[] }>;
  'file:read': (filePath: string) => Promise<{ success: boolean; data?: string; error?: string; metadata?: any }>;
  
  // 数据库操作 - 用户
  'db:getUser': () => Promise<any>;
  'db:updateUser': (id: number, data: any) => Promise<boolean>;
  
  // 数据库操作 - 单词
  'db:getWord': (word: string) => Promise<any>;
  'db:addWord': (data: any) => Promise<any>;
  
  // 数据库操作 - 单词本
  'db:getWordBooks': () => Promise<any[]>;
  'db:addWordBook': (data: any) => Promise<any>;
  'db:deleteWordBook': (id: number) => Promise<boolean>;
  'db:addWordToBook': (wordBookId: number, wordId: number, context?: string) => Promise<boolean>;
  'db:removeWordFromBook': (wordBookId: number, wordId: number) => Promise<boolean>;
  'db:getWordsInBook': (wordBookId: number) => Promise<any[]>;
  'db:updateWordReview': (itemId: number) => Promise<boolean>;
  'db:getWordsDueForReview': () => Promise<any[]>;
  
  // 数据库操作 - AI配置
  'db:getAIConfigs': () => Promise<any[]>;
  'db:getDefaultAIConfig': () => Promise<any>;
  'db:addAIConfig': (data: any) => Promise<any>;
  'db:updateAIConfig': (id: number, data: any) => Promise<boolean>;
  'db:deleteAIConfig': (id: number) => Promise<boolean>;
  
  // 数据库操作 - 阅读记录
  'db:getReadingRecords': () => Promise<any[]>;
  'db:getReadingRecord': (filePath: string) => Promise<any>;
  'db:addOrUpdateReadingRecord': (data: any) => Promise<boolean>;
  'db:deleteReadingRecord': (id: number) => Promise<boolean>;
  
  // 数据库操作 - 设置
  'db:getSetting': (key: string) => Promise<any>;
  'db:setSetting': (key: string, value: string) => Promise<boolean>;
  
  // AI服务
  'ai:testConnection': (config: any) => Promise<{ success: boolean; message: string }>;
  'ai:defineWord': (params: { word: string; context?: string; configId?: number }) => Promise<any>;
  'ai:translate': (params: { text: string; configId?: number }) => Promise<any>;
  'ai:analyzeVocabulary': (params: { text: string; configId?: number }) => Promise<any>;
  'ai:generateExample': (params: { word: string; level: string; configId?: number }) => Promise<any>;
  
  // 窗口控制
  'window:minimize': () => void;
  'window:maximize': () => void;
  'window:close': () => void;
}

// 暴露API到渲染进程
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: <K extends keyof IPCChannels>(
      channel: K,
      ...args: Parameters<IPCChannels[K]>
    ): Promise<ReturnType<IPCChannels[K]>> => {
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
  },
});

// 类型声明，供渲染进程使用
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: <K extends keyof IPCChannels>(
          channel: K,
          ...args: Parameters<IPCChannels[K]>
        ) => Promise<ReturnType<IPCChannels[K]>>;
        on: (channel: string, callback: (...args: any[]) => void) => void;
        removeAllListeners: (channel: string) => void;
      };
    };
  }
}

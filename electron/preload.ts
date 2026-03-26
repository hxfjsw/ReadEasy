import { contextBridge, ipcRenderer } from 'electron';

// 定义IPC通道类型
export interface IPCChannels {
  // 文件操作
  'file:open': () => Promise<{ canceled: boolean; filePaths: string[] }>;
  'file:read': (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  
  // 数据库操作
  'db:query': (sql: string, params?: any[]) => Promise<any>;
  'db:insert': (table: string, data: any) => Promise<number>;
  'db:update': (table: string, id: number, data: any) => Promise<boolean>;
  'db:delete': (table: string, id: number) => Promise<boolean>;
  
  // AI服务
  'ai:define-word': (params: { word: string; context?: string }) => Promise<any>;
  'ai:translate': (params: { text: string }) => Promise<string>;
  'ai:analyze-vocabulary': (params: { text: string }) => Promise<any>;
  'ai:generate-example': (params: { word: string; level: string }) => Promise<string>;
  'ai:get-config': () => Promise<any>;
  'ai:set-config': (config: any) => Promise<boolean>;
  'ai:test-connection': (config: any) => Promise<{ success: boolean; message: string }>;
  
  // 设置
  'settings:get': (key: string) => Promise<any>;
  'settings:set': (key: string, value: any) => Promise<boolean>;
  
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

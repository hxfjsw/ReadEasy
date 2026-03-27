import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { DatabaseService } from './services/database';
import { AIService } from './services/ai';
import { registerIPCHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;
let aiService: AIService;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 设置应用菜单（包含调试选项）
  const template = [
    {
      label: '调试',
      submenu: [
        {
          label: '打开开发者工具',
          accelerator: 'F12',
          click: () => {
            mainWindow?.webContents.openDevTools();
          }
        },
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.webContents.reload();
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// 初始化服务
const initializeServices = async () => {
  try {
    // 初始化数据库服务
    dbService = new DatabaseService();
    await dbService.initialize();
    console.log('Database service initialized');

    // 初始化AI服务
    aiService = new AIService(dbService);
    console.log('AI service initialized');

    // 注册IPC处理器
    registerIPCHandlers(dbService, aiService);
    console.log('IPC handlers registered');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw error;
  }
};

// Electron 应用生命周期
app.whenReady().then(async () => {
  await initializeServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 清理资源
  dbService?.close();
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

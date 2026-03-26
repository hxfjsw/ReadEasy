import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('书架功能 E2E 测试', () => {
  let electronApp: any;
  let tempDir: string;
  let testFile: string;

  test.beforeAll(async () => {
    // 创建临时测试文件
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readeasy-e2e-'));
    testFile = path.join(tempDir, 'test-book.txt');
    fs.writeFileSync(testFile, 'This is a test book content for E2E testing.');

    // 启动 Electron 应用
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });
  });

  test.afterAll(async () => {
    // 关闭应用
    await electronApp.close();
    
    // 清理临时文件
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test.beforeEach(async () => {
    // 每个测试前等待应用准备好
    await electronApp.waitForEvent('window');
  });

  test('书架页面应该正确加载', async () => {
    const page = await electronApp.firstWindow();
    
    // 等待书架页面加载
    await expect(page.getByText('我的书架')).toBeVisible();
    await expect(page.getByText('添加书籍')).toBeVisible();
  });

  test('添加书籍后应该显示在书架', async () => {
    const page = await electronApp.firstWindow();
    
    // 初始状态应该是空书架
    await expect(page.getByText('书架空空如也')).toBeVisible();
    
    // 模拟添加书籍（通过直接调用 IPC，因为文件对话框无法自动化）
    await page.evaluate(async (filePath) => {
      // 通过 IPC 直接添加书籍到书架
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: 'Test Book',
        filePath: filePath,
        format: 'txt',
        progress: 0,
        currentPosition: '0',
        bookmarks: '[]',
        lastReadAt: new Date().toISOString(),
      });
    }, testFile);

    // 刷新页面
    await page.reload();
    await page.waitForSelector('text=我的书架');

    // 等待书架数据加载
    await expect(page.getByText('Test Book')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('TXT')).toBeVisible();
  });

  test('书架应该按时间排序', async () => {
    const page = await electronApp.firstWindow();

    // 添加两本书
    const now = new Date();
    
    await page.evaluate(async (data) => {
      // 添加旧书
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: 'Old Book',
        filePath: data.oldFile,
        format: 'txt',
        progress: 10,
        currentPosition: '100',
        bookmarks: '[]',
        lastReadAt: new Date(data.now.getTime() - 3600000).toISOString(), // 1小时前
      });
      
      // 添加新书
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: 'New Book',
        filePath: data.newFile,
        format: 'epub',
        progress: 0,
        currentPosition: '0',
        bookmarks: '[]',
        lastReadAt: data.now.toISOString(),
      });
    }, { 
      oldFile: path.join(tempDir, 'old.txt'),
      newFile: path.join(tempDir, 'new.epub'),
      now
    });

    // 刷新页面
    await page.reload();
    await page.waitForSelector('text=我的书架');

    // 验证新书在前
    const books = await page.locator('.book-card .ant-card-meta-title').allTextContents();
    expect(books[0]).toBe('New Book');
    expect(books[1]).toBe('Old Book');
  });

  test('点击书籍应该跳转到阅读器', async () => {
    const page = await electronApp.firstWindow();

    // 添加测试书籍
    const testFilePath = path.join(tempDir, 'click-test.txt');
    fs.writeFileSync(testFilePath, 'Click test content');

    await page.evaluate(async (filePath) => {
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: 'Click Test Book',
        filePath: filePath,
        format: 'txt',
        progress: 0,
        currentPosition: '0',
        bookmarks: '[]',
        lastReadAt: new Date().toISOString(),
      });
    }, testFilePath);

    // 刷新页面
    await page.reload();
    await page.waitForSelector('text=Click Test Book');

    // 点击书籍
    await page.getByText('Click Test Book').click();

    // 应该跳转到阅读器页面
    await expect(page.getByText('Click test content')).toBeVisible({ timeout: 5000 });
  });

  test('从书架移除书籍', async () => {
    const page = await electronApp.firstWindow();

    // 添加并确认书籍存在
    await page.evaluate(async (filePath) => {
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: 'To Remove',
        filePath: filePath,
        format: 'txt',
        progress: 0,
        currentPosition: '0',
        bookmarks: '[]',
        lastReadAt: new Date().toISOString(),
      });
    }, path.join(tempDir, 'remove.txt'));

    // 刷新并确认书籍存在
    await page.reload();
    await page.waitForSelector('text=To Remove');

    // 获取书籍卡片
    const bookCard = page.locator('.book-card').filter({ hasText: 'To Remove' });
    
    // 悬停显示操作按钮
    await bookCard.hover();
    
    // 点击移除按钮
    await bookCard.getByText('移除').click();
    
    // 确认移除
    await page.getByRole('button', { name: '移除' }).click();

    // 等待确认消息
    await expect(page.getByText('已从书架移除')).toBeVisible();

    // 确认书籍已消失
    await expect(page.locator('.book-card').filter({ hasText: 'To Remove' })).not.toBeVisible();
  });
});

import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('阅读器功能 E2E 测试', () => {
  let electronApp: any;
  let tempDir: string;
  let testEpubFile: string;

  test.beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readeasy-reader-e2e-'));
    testEpubFile = path.join(tempDir, 'test-book.epub');
    
    // 创建一个简单的测试 EPUB 文件
    // 注意：这里只是创建一个文件，实际解析可能需要真实的 EPUB 结构
    fs.writeFileSync(testEpubFile, 'EPUB test content');

    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });
  });

  test.afterAll(async () => {
    await electronApp.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test.beforeEach(async () => {
    await electronApp.waitForEvent('window');
  });

  test('阅读器应该能加载 TXT 文件', async () => {
    const page = await electronApp.firstWindow();
    
    // 创建测试 TXT 文件
    const txtFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(txtFile, 'Hello World\nThis is a test document.');

    // 通过 IPC 直接加载文件
    await page.evaluate(async (filePath) => {
      const result = await window.electron.ipcRenderer.invoke('file:read', filePath);
      return result;
    }, txtFile);

    // 等待内容加载
    await expect(page.getByText('Hello World')).toBeVisible({ timeout: 5000 });
  });

  test('点击单词应该弹出单词详情', async () => {
    const page = await electronApp.firstWindow();
    
    // 先加载一个文件
    const txtFile = path.join(tempDir, 'word-test.txt');
    fs.writeFileSync(txtFile, 'Hello world test content.');

    await page.evaluate(async (filePath) => {
      await window.electron.ipcRenderer.invoke('file:read', filePath);
      // 添加到书架并打开
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: 'Word Test',
        filePath: filePath,
        format: 'txt',
        progress: 0,
        currentPosition: '0',
        bookmarks: '[]',
        lastReadAt: new Date().toISOString(),
      });
    }, txtFile);

    // 刷新页面
    await page.reload();
    
    // 等待单词加载
    await page.waitForSelector('text=Hello', { timeout: 5000 });

    // 点击单词
    await page.getByText('Hello').first().click();

    // 等待单词弹窗
    await expect(page.getByText('单词释义')).toBeVisible({ timeout: 3000 });
  });

  test('阅读进度应该被保存', async () => {
    const page = await electronApp.firstWindow();
    
    const txtFile = path.join(tempDir, 'progress-test.txt');
    fs.writeFileSync(txtFile, 'Line 1\nLine 2\nLine 3\n'.repeat(50));

    // 加载文件
    await page.evaluate(async (filePath) => {
      await window.electron.ipcRenderer.invoke('file:read', filePath);
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: 'Progress Test',
        filePath: filePath,
        format: 'txt',
        progress: 50,
        currentPosition: '100',
        bookmarks: '[]',
        lastReadAt: new Date().toISOString(),
      });
    }, txtFile);

    // 回到书架
    await page.getByText('书架').click();
    await page.waitForSelector('text=我的书架');

    // 验证进度显示
    const bookCard = page.locator('.book-card').filter({ hasText: 'Progress Test' });
    await expect(bookCard.getByText('50%')).toBeVisible();
  });

  test('主题切换应该生效', async () => {
    const page = await electronApp.firstWindow();
    
    // 导航到阅读器
    await page.getByText('阅读器').click();
    
    // 初始应该是浅色主题
    const content = page.locator('.reader-content');
    await expect(content).toHaveClass(/bg-white/);
    
    // 切换到深色主题
    await page.getByLabel('moon').click();
    
    // 验证深色主题
    await expect(content).toHaveClass(/bg-gray-800/);
  });
});

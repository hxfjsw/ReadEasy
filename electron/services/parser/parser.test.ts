import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParserService } from './index';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 注意：这些是集成测试，需要实际的文件系统
describe('ParserService', () => {
  let parserService: ParserService;
  let tempDir: string;

  beforeEach(async () => {
    parserService = new ParserService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readeasy-test-'));
  });

  afterEach(() => {
    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseTxt', () => {
    it('应该正确解析 TXT 文件', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const content = 'Hello World\nThis is a test.';
      fs.writeFileSync(testFile, content);

      const result = await parserService.parseTxt(testFile);

      expect(result.title).toBe('test');
      expect(result.author).toBe('');
      expect(result.content).toBe(content);
      expect(result.chapters).toHaveLength(1);
    });

    it('应该处理大 TXT 文件', async () => {
      const testFile = path.join(tempDir, 'large.txt');
      const largeContent = 'a'.repeat(20 * 1024 * 1024); // 20MB
      fs.writeFileSync(testFile, largeContent);

      const result = await parserService.parseTxt(testFile, { maxContentSize: 10 * 1024 * 1024 });

      expect(result.content.length).toBeLessThanOrEqual(10 * 1024 * 1024 + 100); // 允许一些额外字符
      expect(result.content).toContain('[文件内容过长，已截断...]');
    });

    it('应该抛出错误当文件不存在', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt');

      await expect(parserService.parseTxt(nonExistentFile)).rejects.toThrow('File not found');
    });
  });

  describe('parseChapter', () => {
    it('应该正确提取章节标题', () => {
      const html = '<html><head><title>Chapter Title</title></head><body>Content</body></html>';
      const result = (parserService as any).parseChapter(html);

      expect(result.title).toBe('Chapter Title');
      expect(result.content).toBe('Content');
    });

    it('应该移除 HTML 标签', () => {
      const html = '<p>This is <b>bold</b> and <i>italic</i> text.</p>';
      const result = (parserService as any).parseChapter(html);

      expect(result.content).toBe('This is bold and italic text.');
    });

    it('应该移除 script 和 style 标签', () => {
      const html = `
        <html>
          <head><style>body { color: red; }</style></head>
          <body>
            <script>alert('test');</script>
            <p>Real content</p>
          </body>
        </html>
      `;
      const result = (parserService as any).parseChapter(html);

      expect(result.content).not.toContain('script');
      expect(result.content).not.toContain('style');
      expect(result.content).toContain('Real content');
    });

    it('应该处理 HTML 实体', () => {
      const html = '<p>&amp; &lt; &gt; &quot; &#39;</p>';
      const result = (parserService as any).parseChapter(html);

      expect(result.content).toContain('&');
      expect(result.content).toContain('<');
      expect(result.content).toContain('>');
      expect(result.content).toContain('"');
      expect(result.content).toContain("'");
    });
  });

  describe('parseContentOpf', () => {
    it('应该正确解析 content.opf', () => {
      const contentOpf = `
        <?xml version="1.0"?>
        <package>
          <metadata>
            <dc:title>Test Book</dc:title>
            <dc:creator>Test Author</dc:creator>
          </metadata>
          <manifest>
            <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
          </manifest>
          <spine>
            <itemref idref="chapter1"/>
          </spine>
        </package>
      `;
      const result = (parserService as any).parseContentOpf(contentOpf, 'OEBPS/content.opf');

      expect(result.title).toBe('Test Book');
      expect(result.author).toBe('Test Author');
      expect(result.manifest.size).toBe(1);
      expect(result.manifest.get('chapter1')).toEqual({
        href: 'chapter1.xhtml',
        mediaType: 'application/xhtml+xml',
      });
      expect(result.spine).toEqual(['chapter1']);
      expect(result.basePath).toBe('OEBPS');
    });
  });
});

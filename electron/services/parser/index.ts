import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

export interface ParsedBook {
  title: string;
  author: string;
  content: string;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
}

export class ParserService {
  /**
   * 解析 EPUB 文件
   */
  async parseEpub(filePath: string): Promise<ParsedBook> {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    
    // 找到 container.xml
    const containerXml = await zip.file('META-INF/container.xml')?.async('text');
    if (!containerXml) {
      throw new Error('Invalid EPUB: container.xml not found');
    }
    
    // 解析 container.xml 获取 content.opf 路径
    const contentOpfPath = this.extractContentOpfPath(containerXml);
    if (!contentOpfPath) {
      throw new Error('Invalid EPUB: content.opf path not found');
    }
    
    // 读取 content.opf
    const contentOpf = await zip.file(contentOpfPath)?.async('text');
    if (!contentOpf) {
      throw new Error('Invalid EPUB: content.opf not found');
    }
    
    // 解析 content.opf 获取元数据和章节列表
    const { title, author, manifest, spine, basePath } = this.parseContentOpf(contentOpf, contentOpfPath);
    
    // 读取所有章节内容
    const chapters: Chapter[] = [];
    for (const spineItem of spine) {
      const item = manifest.get(spineItem);
      if (item && item.mediaType === 'application/xhtml+xml') {
        const chapterPath = basePath ? `${basePath}/${item.href}` : item.href;
        const chapterContent = await zip.file(chapterPath)?.async('text');
        if (chapterContent) {
          const { title: chapterTitle, content: cleanContent } = this.parseChapter(chapterContent);
          chapters.push({
            id: spineItem,
            title: chapterTitle || item.href,
            content: cleanContent,
          });
        }
      }
    }
    
    // 合并所有章节内容
    const fullContent = chapters.map(c => c.content).join('\n\n');
    
    return {
      title,
      author,
      content: fullContent,
      chapters,
    };
  }
  
  /**
   * 解析 TXT 文件
   */
  async parseTxt(filePath: string): Promise<ParsedBook> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.txt');
    
    return {
      title: fileName,
      author: '',
      content,
      chapters: [{
        id: '1',
        title: fileName,
        content,
      }],
    };
  }
  
  /**
   * 从 container.xml 中提取 content.opf 路径
   */
  private extractContentOpfPath(containerXml: string): string | null {
    const match = containerXml.match(/full-path="([^"]+)"/);
    return match ? match[1] : null;
  }
  
  /**
   * 解析 content.opf 文件
   */
  private parseContentOpf(contentOpf: string, contentOpfPath: string): {
    title: string;
    author: string;
    manifest: Map<string, { href: string; mediaType: string }>;
    spine: string[];
    basePath: string;
  } {
    const basePath = path.dirname(contentOpfPath);
    
    // 提取标题
    const titleMatch = contentOpf.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/i);
    const title = titleMatch ? titleMatch[1] : 'Unknown Title';
    
    // 提取作者
    const authorMatch = contentOpf.match(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/i);
    const author = authorMatch ? authorMatch[1] : '';
    
    // 解析 manifest
    const manifest = new Map<string, { href: string; mediaType: string }>();
    const manifestRegex = /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]+media-type="([^"]+)"[^>]*\/?>/gi;
    let match;
    while ((match = manifestRegex.exec(contentOpf)) !== null) {
      manifest.set(match[1], {
        href: match[2],
        mediaType: match[3],
      });
    }
    
    // 解析 spine
    const spine: string[] = [];
    const spineRegex = /<itemref[^>]+idref="([^"]+)"[^>]*\/?>/gi;
    while ((match = spineRegex.exec(contentOpf)) !== null) {
      spine.push(match[1]);
    }
    
    return { title, author, manifest, spine, basePath };
  }
  
  /**
   * 解析章节内容，提取标题和纯文本
   */
  private parseChapter(html: string): { title: string | null; content: string } {
    // 提取标题
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    
    // 移除 HTML 标签，保留文本内容
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    return { title, content: text };
  }
}

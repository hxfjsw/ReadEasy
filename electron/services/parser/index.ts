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
    console.log('[Parser] Starting EPUB parse:', filePath);
    
    try {
      console.log('[Parser] Reading file...');
      const data = fs.readFileSync(filePath);
      console.log('[Parser] File read, size:', data.length, 'bytes');
      
      console.log('[Parser] Loading ZIP...');
      const zip = await JSZip.loadAsync(data);
      console.log('[Parser] ZIP loaded, files:', Object.keys(zip.files));
      
      // 找到 container.xml
      console.log('[Parser] Looking for container.xml...');
      const containerXml = await zip.file('META-INF/container.xml')?.async('text');
      if (!containerXml) {
        console.error('[Parser] container.xml not found');
        throw new Error('Invalid EPUB: container.xml not found');
      }
      console.log('[Parser] container.xml found, length:', containerXml.length);
      
      // 解析 container.xml 获取 content.opf 路径
      console.log('[Parser] Extracting content.opf path...');
      const contentOpfPath = this.extractContentOpfPath(containerXml);
      if (!contentOpfPath) {
        console.error('[Parser] content.opf path not found in container.xml');
        throw new Error('Invalid EPUB: content.opf path not found');
      }
      console.log('[Parser] content.opf path:', contentOpfPath);
      
      // 读取 content.opf
      console.log('[Parser] Reading content.opf...');
      const contentOpf = await zip.file(contentOpfPath)?.async('text');
      if (!contentOpf) {
        console.error('[Parser] content.opf not found at path:', contentOpfPath);
        throw new Error('Invalid EPUB: content.opf not found');
      }
      console.log('[Parser] content.opf found, length:', contentOpf.length);
      
      // 解析 content.opf 获取元数据和章节列表
      console.log('[Parser] Parsing content.opf...');
      const { title, author, manifest, spine, basePath } = this.parseContentOpf(contentOpf, contentOpfPath);
      console.log('[Parser] content.opf parsed:', { title, author, manifestSize: manifest.size, spineLength: spine.length, basePath });
      
      // 读取所有章节内容
      console.log('[Parser] Reading chapters...');
      const chapters: Chapter[] = [];
      for (let i = 0; i < spine.length; i++) {
        const spineItem = spine[i];
        console.log(`[Parser] Processing spine item ${i + 1}/${spine.length}:`, spineItem);
        
        const item = manifest.get(spineItem);
        if (item && item.mediaType === 'application/xhtml+xml') {
          const chapterPath = basePath ? `${basePath}/${item.href}` : item.href;
          console.log('[Parser] Reading chapter from path:', chapterPath);
          
          const chapterContent = await zip.file(chapterPath)?.async('text');
          if (chapterContent) {
            console.log('[Parser] Chapter content read, length:', chapterContent.length);
            const { title: chapterTitle, content: cleanContent } = this.parseChapter(chapterContent);
            chapters.push({
              id: spineItem,
              title: chapterTitle || item.href,
              content: cleanContent,
            });
            console.log('[Parser] Chapter parsed:', { title: chapterTitle || item.href, contentLength: cleanContent.length });
          } else {
            console.warn('[Parser] Chapter content not found for path:', chapterPath);
          }
        } else {
          console.log('[Parser] Skipping non-XHTML item:', spineItem, 'mediaType:', item?.mediaType);
        }
      }
      
      console.log('[Parser] All chapters read, total:', chapters.length);
      
      // 合并所有章节内容
      console.log('[Parser] Merging chapter contents...');
      const fullContent = chapters.map(c => c.content).join('\n\n');
      console.log('[Parser] Content merged, total length:', fullContent.length);
      
      const result = {
        title,
        author,
        content: fullContent,
        chapters,
      };
      
      console.log('[Parser] EPUB parse complete:', { title, author, chapterCount: chapters.length, contentLength: fullContent.length });
      return result;
    } catch (error) {
      console.error('[Parser] EPUB parse failed:', error);
      throw error;
    }
  }
  
  /**
   * 解析 TXT 文件
   */
  async parseTxt(filePath: string): Promise<ParsedBook> {
    console.log('[Parser] Starting TXT parse:', filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log('[Parser] TXT file read, length:', content.length);
      
      const fileName = path.basename(filePath, '.txt');
      console.log('[Parser] TXT file name:', fileName);
      
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
    } catch (error) {
      console.error('[Parser] TXT parse failed:', error);
      throw error;
    }
  }
  
  /**
   * 从 container.xml 中提取 content.opf 路径
   */
  private extractContentOpfPath(containerXml: string): string | null {
    console.log('[Parser] Extracting content.opf path from container.xml...');
    const match = containerXml.match(/full-path="([^"]+)"/);
    const result = match ? match[1] : null;
    console.log('[Parser] Extracted path:', result);
    return result;
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
    console.log('[Parser] Parsing content.opf...');
    
    const basePath = path.dirname(contentOpfPath);
    console.log('[Parser] basePath:', basePath);
    
    // 提取标题
    const titleMatch = contentOpf.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/i);
    const title = titleMatch ? titleMatch[1] : 'Unknown Title';
    console.log('[Parser] Title:', title);
    
    // 提取作者
    const authorMatch = contentOpf.match(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/i);
    const author = authorMatch ? authorMatch[1] : '';
    console.log('[Parser] Author:', author);
    
    // 解析 manifest
    console.log('[Parser] Parsing manifest...');
    const manifest = new Map<string, { href: string; mediaType: string }>();
    const manifestRegex = /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]+media-type="([^"]+)"[^>]*\/?>/gi;
    let match;
    while ((match = manifestRegex.exec(contentOpf)) !== null) {
      manifest.set(match[1], {
        href: match[2],
        mediaType: match[3],
      });
    }
    console.log('[Parser] Manifest items:', manifest.size);
    
    // 解析 spine
    console.log('[Parser] Parsing spine...');
    const spine: string[] = [];
    const spineRegex = /<itemref[^>]+idref="([^"]+)"[^>]*\/?>/gi;
    while ((match = spineRegex.exec(contentOpf)) !== null) {
      spine.push(match[1]);
    }
    console.log('[Parser] Spine items:', spine.length);
    
    return { title, author, manifest, spine, basePath };
  }
  
  /**
   * 解析章节内容，提取标题和纯文本
   */
  private parseChapter(html: string): { title: string | null; content: string } {
    console.log('[Parser] Parsing chapter, HTML length:', html.length);
    
    // 提取标题
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    console.log('[Parser] Chapter title:', title);
    
    // 移除 HTML 标签，保留文本内容
    console.log('[Parser] Converting HTML to text...');
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
    
    console.log('[Parser] Text extracted, length:', text.length);
    
    return { title, content: text };
  }
}

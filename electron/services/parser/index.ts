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
    console.log('[Parser] ===========================================');
    console.log('[Parser] Starting EPUB parse:', filePath);
    console.log('[Parser] ===========================================');
    
    try {
      console.log('[Parser] Checking if file exists...');
      if (!fs.existsSync(filePath)) {
        console.error('[Parser] File does not exist:', filePath);
        throw new Error('File not found: ' + filePath);
      }
      
      console.log('[Parser] Reading file...');
      const data = fs.readFileSync(filePath);
      console.log('[Parser] File read, size:', data.length, 'bytes');
      
      console.log('[Parser] Loading ZIP...');
      const zip = await JSZip.loadAsync(data);
      const fileNames = Object.keys(zip.files);
      console.log('[Parser] ZIP loaded, total files:', fileNames.length);
      console.log('[Parser] ZIP files sample:', fileNames.slice(0, 20));
      
      // 找到 container.xml
      console.log('[Parser] Looking for META-INF/container.xml...');
      const containerFile = zip.file('META-INF/container.xml');
      if (!containerFile) {
        console.error('[Parser] META-INF/container.xml not found');
        console.log('[Parser] Available root files:', fileNames.filter(f => !f.includes('/')));
        throw new Error('Invalid EPUB: container.xml not found');
      }
      
      const containerXml = await containerFile.async('text');
      console.log('[Parser] container.xml found, length:', containerXml.length);
      console.log('[Parser] container.xml content preview:', containerXml.substring(0, 500));
      
      // 解析 container.xml 获取 content.opf 路径
      console.log('[Parser] Extracting content.opf path from container.xml...');
      const contentOpfPath = this.extractContentOpfPath(containerXml);
      console.log('[Parser] Extracted content.opf path:', contentOpfPath);
      
      if (!contentOpfPath) {
        console.error('[Parser] content.opf path not found in container.xml');
        throw new Error('Invalid EPUB: content.opf path not found');
      }
      
      // 尝试不同的路径格式
      let contentOpf = await zip.file(contentOpfPath)?.async('text');
      
      // 如果没找到，尝试其他可能的路径
      if (!contentOpf) {
        console.log('[Parser] content.opf not found at:', contentOpfPath);
        console.log('[Parser] Trying alternative paths...');
        
        // 尝试不带路径分隔符的版本
        const altPath1 = contentOpfPath.replace(/\\/g, '/');
        console.log('[Parser] Trying:', altPath1);
        contentOpf = await zip.file(altPath1)?.async('text');
        
        if (!contentOpf) {
          // 尝试查找任何 .opf 文件
          const opfFiles = fileNames.filter(f => f.endsWith('.opf'));
          console.log('[Parser] Found .opf files:', opfFiles);
          
          if (opfFiles.length > 0) {
            console.log('[Parser] Using first .opf file:', opfFiles[0]);
            contentOpf = await zip.file(opfFiles[0])?.async('text');
          }
        }
      }
      
      if (!contentOpf) {
        console.error('[Parser] content.opf not found at any path');
        throw new Error('Invalid EPUB: content.opf not found');
      }
      
      console.log('[Parser] content.opf found, length:', contentOpf.length);
      console.log('[Parser] content.opf preview:', contentOpf.substring(0, 500));
      
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
        if (!item) {
          console.warn(`[Parser] Spine item "${spineItem}" not found in manifest`);
          continue;
        }
        
        console.log(`[Parser] Item found:`, { id: spineItem, href: item.href, mediaType: item.mediaType });
        
        // 支持多种 HTML 类型
        const isHtml = item.mediaType === 'application/xhtml+xml' || 
                       item.mediaType === 'text/html' ||
                       item.href.endsWith('.html') ||
                       item.href.endsWith('.xhtml') ||
                       item.href.endsWith('.htm');
        
        if (isHtml) {
          // 尝试多种路径组合
          const possiblePaths = [
            basePath ? `${basePath}/${item.href}` : item.href,
            item.href,
            basePath ? `${basePath}/${item.href}`.replace(/\\/g, '/') : item.href.replace(/\\/g, '/'),
          ];
          
          let chapterContent: string | null = null;
          let foundPath: string | null = null;
          
          for (const tryPath of possiblePaths) {
            console.log('[Parser] Trying chapter path:', tryPath);
            const content = await zip.file(tryPath)?.async('text');
            if (content) {
              chapterContent = content;
              foundPath = tryPath;
              break;
            }
          }
          
          // 如果没找到，尝试在 zip 中搜索匹配的文件名
          if (!chapterContent) {
            const fileName = path.basename(item.href);
            console.log('[Parser] Searching for file by name:', fileName);
            
            for (const zipPath of fileNames) {
              if (zipPath.endsWith(fileName)) {
                console.log('[Parser] Found matching file:', zipPath);
                chapterContent = await zip.file(zipPath)?.async('text') || null;
                foundPath = zipPath;
                break;
              }
            }
          }
          
          if (chapterContent) {
            console.log('[Parser] Chapter content found at:', foundPath, 'length:', chapterContent.length);
            try {
              const { title: chapterTitle, content: cleanContent } = this.parseChapter(chapterContent);
              chapters.push({
                id: spineItem,
                title: chapterTitle || item.href,
                content: cleanContent,
              });
              console.log('[Parser] Chapter parsed successfully:', { title: chapterTitle || item.href, contentLength: cleanContent.length });
            } catch (parseError) {
              console.error('[Parser] Failed to parse chapter:', spineItem, parseError);
            }
          } else {
            console.warn('[Parser] Chapter content not found for:', spineItem, 'tried paths:', possiblePaths);
          }
        } else {
          console.log('[Parser] Skipping non-HTML item:', spineItem, 'mediaType:', item.mediaType);
        }
      }
      
      console.log('[Parser] All chapters processed, total:', chapters.length);
      
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
      
      console.log('[Parser] ===========================================');
      console.log('[Parser] EPUB parse complete:', { title, author, chapterCount: chapters.length, contentLength: fullContent.length });
      console.log('[Parser] ===========================================');
      return result;
    } catch (error) {
      console.error('[Parser] ===========================================');
      console.error('[Parser] EPUB parse failed:', error);
      console.error('[Parser] Stack:', (error as Error).stack);
      console.error('[Parser] ===========================================');
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
    
    // 尝试多种正则表达式匹配
    const patterns = [
      /full-path="([^"]+)"/i,
      /full-path='([^']+)'/i,
      /href="([^"]+\.opf)"/i,
    ];
    
    for (const pattern of patterns) {
      const match = containerXml.match(pattern);
      if (match) {
        console.log('[Parser] Matched pattern:', pattern, 'result:', match[1]);
        return match[1];
      }
    }
    
    console.error('[Parser] No content.opf path pattern matched');
    return null;
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
    
    // 提取标题 - 尝试多种模式
    let title = 'Unknown Title';
    const titlePatterns = [
      /<dc:title[^>]*>([^<]*)<\/dc:title>/i,
      /<title>([^<]*)<\/title>/i,
    ];
    for (const pattern of titlePatterns) {
      const match = contentOpf.match(pattern);
      if (match && match[1].trim()) {
        title = match[1].trim();
        break;
      }
    }
    console.log('[Parser] Title:', title);
    
    // 提取作者 - 尝试多种模式
    let author = '';
    const authorPatterns = [
      /<dc:creator[^>]*>([^<]*)<\/dc:creator>/i,
      /<dc:author[^>]*>([^<]*)<\/dc:author>/i,
      /<author>([^<]*)<\/author>/i,
    ];
    for (const pattern of authorPatterns) {
      const match = contentOpf.match(pattern);
      if (match && match[1].trim()) {
        author = match[1].trim();
        break;
      }
    }
    console.log('[Parser] Author:', author);
    
    // 解析 manifest - 支持多种格式
    console.log('[Parser] Parsing manifest...');
    const manifest = new Map<string, { href: string; mediaType: string }>();
    
    // 尝试多种 manifest item 模式
    const manifestPatterns = [
      /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]+media-type="([^"]+)"[^>]*\/?>/gi,
      /<item[^>]+href="([^"]+)"[^>]+id="([^"]+)"[^>]+media-type="([^"]+)"[^>]*\/?>/gi,
      /<item[^>]+id="([^"]+)"[^>]+media-type="([^"]+)"[^>]+href="([^"]+)"[^>]*\/?>/gi,
    ];
    
    for (const pattern of manifestPatterns) {
      let match;
      while ((match = pattern.exec(contentOpf)) !== null) {
        // 根据模式确定捕获组的顺序
        let id, href, mediaType;
        if (pattern.toString().includes('id="([^"]+)"[^>]+href=')) {
          id = match[1]; href = match[2]; mediaType = match[3];
        } else if (pattern.toString().includes('href="([^"]+)"[^>]+id=')) {
          href = match[1]; id = match[2]; mediaType = match[3];
        } else {
          id = match[1]; mediaType = match[2]; href = match[3];
        }
        
        if (id && href) {
          manifest.set(id, { href, mediaType: mediaType || 'application/xhtml+xml' });
        }
      }
      
      if (manifest.size > 0) break; // 如果找到了数据，停止尝试其他模式
    }
    
    console.log('[Parser] Manifest items:', manifest.size);
    
    // 解析 spine
    console.log('[Parser] Parsing spine...');
    const spine: string[] = [];
    const spineRegex = /<itemref[^>]+idref="([^"]+)"[^>]*\/?>/gi;
    let match;
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
    
    // 提取标题 - 尝试多种模式
    let title: string | null = null;
    const titlePatterns = [
      /<title[^>]*>([^<]*)<\/title>/i,
      /<h1[^>]*>([^<]*)<\/h1>/i,
      /<h2[^>]*>([^<]*)<\/h2>/i,
    ];
    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match && match[1].trim()) {
        title = match[1].trim();
        break;
      }
    }
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

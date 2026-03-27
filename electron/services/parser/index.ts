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

export interface ParseOptions {
  maxChapters?: number;      // 最大解析章节数，0表示全部
  maxContentSize?: number;   // 最大内容大小（字节），默认10MB
}

export class ParserService {
  /**
   * 解析 EPUB 文件（优化版）
   * @param filePath 文件路径
   * @param options 解析选项
   */
  async parseEpub(filePath: string, options: ParseOptions = {}): Promise<ParsedBook> {
    const { maxChapters = 0, maxContentSize = 10 * 1024 * 1024 } = options;
    
    console.log('[Parser] Starting EPUB parse:', filePath);
    const startTime = Date.now();
    
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found: ' + filePath);
      }
      
      // 读取文件
      const data = fs.readFileSync(filePath);
      const fileSizeMB = (data.length / 1024 / 1024).toFixed(2);
      console.log(`[Parser] File size: ${fileSizeMB} MB`);
      
      // 解压 ZIP
      const zip = await JSZip.loadAsync(data);
      const fileNames = Object.keys(zip.files);
      
      // 找到 container.xml
      const containerFile = zip.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('Invalid EPUB: container.xml not found');
      }
      
      const containerXml = await containerFile.async('text');
      const contentOpfPath = this.extractContentOpfPath(containerXml);
      
      if (!contentOpfPath) {
        throw new Error('Invalid EPUB: content.opf path not found');
      }
      
      // 尝试不同的路径格式
      let contentOpf = await zip.file(contentOpfPath)?.async('text');
      
      if (!contentOpf) {
        const altPath1 = contentOpfPath.replace(/\\/g, '/');
        contentOpf = await zip.file(altPath1)?.async('text');
        
        if (!contentOpf) {
          const opfFiles = fileNames.filter(f => f.endsWith('.opf'));
          if (opfFiles.length > 0) {
            contentOpf = await zip.file(opfFiles[0])?.async('text');
          }
        }
      }
      
      if (!contentOpf) {
        throw new Error('Invalid EPUB: content.opf not found');
      }
      
      // 解析 content.opf
      const { title, author, manifest, spine, basePath } = this.parseContentOpf(contentOpf, contentOpfPath);
      console.log(`[Parser] Book: "${title}", Author: "${author}", Chapters: ${spine.length}`);
      
      // 确定要解析的章节数量
      const chaptersToParse = maxChapters > 0 ? Math.min(maxChapters, spine.length) : spine.length;
      if (chaptersToParse < spine.length) {
        console.log(`[Parser] Limiting to first ${chaptersToParse}/${spine.length} chapters`);
      }
      
      // 读取章节内容
      const chapters: Chapter[] = [];
      let totalContentSize = 0;
      const maxChapterSize = 1024 * 1024; // 单章最大 1MB
      
      for (let i = 0; i < chaptersToParse; i++) {
        const spineItem = spine[i];
        
        // 每10章输出一次日志
        if ((i + 1) % 10 === 0 || i === chaptersToParse - 1) {
          console.log(`[Parser] Processing ${i + 1}/${chaptersToParse}...`);
        }
        
        const item = manifest.get(spineItem);
        if (!item) continue;
        
        // 支持多种 HTML 类型
        const isHtml = item.mediaType === 'application/xhtml+xml' || 
                       item.mediaType === 'text/html' ||
                       item.href.endsWith('.html') ||
                       item.href.endsWith('.xhtml') ||
                       item.href.endsWith('.htm');
        
        if (!isHtml) continue;
        
        // 尝试多种路径组合
        const possiblePaths = [
          basePath ? `${basePath}/${item.href}` : item.href,
          item.href,
          basePath ? `${basePath}/${item.href}`.replace(/\\/g, '/') : item.href.replace(/\\/g, '/'),
        ];
        
        let chapterContent: string | null = null;
        
        for (const tryPath of possiblePaths) {
          const content = await zip.file(tryPath)?.async('text');
          if (content) {
            chapterContent = content;
            break;
          }
        }
        
        // 如果没找到，尝试在 zip 中搜索匹配的文件名
        if (!chapterContent) {
          const fileName = path.basename(item.href);
          for (const zipPath of fileNames) {
            if (zipPath.endsWith(fileName)) {
              chapterContent = await zip.file(zipPath)?.async('text') || null;
              break;
            }
          }
        }
        
        if (chapterContent) {
          // 限制单章大小
          if (chapterContent.length > maxChapterSize) {
            console.warn(`[Parser] Chapter ${i + 1} is very large (${chapterContent.length} chars), truncating`);
            chapterContent = chapterContent.slice(0, maxChapterSize) + '\n\n[内容已截断...]';
          }
          
          try {
            const { title: chapterTitle, content: cleanContent } = this.parseChapter(chapterContent);
            
            // 过滤封面章节
            const titleLower = (chapterTitle || '').toLowerCase();
            const spineIdLower = spineItem.toLowerCase();
            const isCover = 
              titleLower.includes('cover') ||
              titleLower.includes('封面') ||
              titleLower.includes('title page') ||
              spineIdLower.includes('cover');
            
            if (isCover) {
              console.log(`[Parser] Skipping cover chapter: ${chapterTitle || spineItem}`);
              continue;
            }
            
            // 检查总内容大小限制
            if (totalContentSize + cleanContent.length > maxContentSize) {
              console.warn('[Parser] Total content size limit reached, stopping');
              chapters.push({
                id: spineItem,
                title: chapterTitle || `章节 ${i + 1}`,
                content: cleanContent.slice(0, maxContentSize - totalContentSize) + '\n\n[内容已截断...]',
              });
              break;
            }
            
            chapters.push({
              id: spineItem,
              title: chapterTitle || `章节 ${i + 1}`,
              content: cleanContent,
            });
            totalContentSize += cleanContent.length;
          } catch (parseError) {
            console.error(`[Parser] Failed to parse chapter ${i + 1}:`, parseError);
          }
        }
      }
      
      // 合并所有章节内容（使用更高效的方式）
      const contentParts: string[] = [];
      for (const chapter of chapters) {
        contentParts.push(chapter.content);
      }
      const fullContent = contentParts.join('\n\n');
      
      const duration = Date.now() - startTime;
      console.log(`[Parser] EPUB parsed in ${duration}ms, ${chapters.length} chapters, ${fullContent.length} chars`);
      
      return {
        title,
        author,
        content: fullContent,
        chapters,
      };
    } catch (error) {
      console.error('[Parser] EPUB parse failed:', error);
      throw error;
    }
  }
  
  /**
   * 解析 TXT 文件（优化版，支持大文件）
   */
  async parseTxt(filePath: string, options: ParseOptions = {}): Promise<ParsedBook> {
    const { maxContentSize = 10 * 1024 * 1024 } = options;
    
    console.log('[Parser] Starting TXT parse:', filePath);
    
    try {
      // 获取文件大小
      const stats = fs.statSync(filePath);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`[Parser] TXT file size: ${fileSizeMB} MB`);
      
      let content = fs.readFileSync(filePath, 'utf-8');
      
      // 如果文件太大，截断内容
      if (content.length > maxContentSize) {
        console.warn(`[Parser] TXT file is very large, truncating to ${maxContentSize} bytes`);
        content = content.slice(0, maxContentSize) + '\n\n[文件内容过长，已截断...]';
      }
      
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
   * 解析 content.opf 文件（优化版）
   */
  private parseContentOpf(contentOpf: string, contentOpfPath: string): {
    title: string;
    author: string;
    manifest: Map<string, { href: string; mediaType: string }>;
    spine: string[];
    basePath: string;
  } {
    const basePath = path.dirname(contentOpfPath);
    
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
    
    // 解析 manifest - 支持多种格式
    const manifest = new Map<string, { href: string; mediaType: string }>();
    
    const manifestPatterns = [
      /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]+media-type="([^"]+)"[^>]*\/?>/gi,
      /<item[^>]+href="([^"]+)"[^>]+id="([^"]+)"[^>]+media-type="([^"]+)"[^>]*\/?>/gi,
      /<item[^>]+id="([^"]+)"[^>]+media-type="([^"]+)"[^>]+href="([^"]+)"[^>]*\/?>/gi,
    ];
    
    for (const pattern of manifestPatterns) {
      let match;
      while ((match = pattern.exec(contentOpf)) !== null) {
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
      
      if (manifest.size > 0) break;
    }
    
    // 解析 spine
    const spine: string[] = [];
    const spineRegex = /<itemref[^>]+idref="([^"]+)"[^>]*\/?>/gi;
    let match;
    while ((match = spineRegex.exec(contentOpf)) !== null) {
      spine.push(match[1]);
    }
    
    return { title, author, manifest, spine, basePath };
  }
  
  /**
   * 解析章节内容，提取标题和纯文本（优化版，处理大内容更高效）
   */
  private parseChapter(html: string): { title: string | null; content: string } {
    // 对于超大章节，使用分段处理
    const maxProcessSize = 500 * 1024; // 500KB
    
    // 提取标题（只在前20KB中查找以提高性能）
    let title: string | null = null;
    const headerSlice = html.slice(0, 20000);
    
    // 首先尝试提取所有可能的标题，按优先级排序
    const candidates: Array<{ text: string; priority: number }> = [];
    
    // 匹配各种标题标签（包括带属性的标签）
    const headingPatterns = [
      { pattern: /<h1[^>]*>([^<]*)<\/h1>/i, priority: 10 },
      { pattern: /<h2[^>]*>([^<]*)<\/h2>/i, priority: 20 },
      { pattern: /<h3[^>]*>([^<]*)<\/h3>/i, priority: 30 },
      { pattern: /<h4[^>]*>([^<]*)<\/h4>/i, priority: 40 },
      { pattern: /<h5[^>]*>([^<]*)<\/h5>/i, priority: 50 },
      { pattern: /<h6[^>]*>([^<]*)<\/h6>/i, priority: 60 },
      { pattern: /<title[^>]*>([^<]*)<\/title>/i, priority: 70 },
    ];
    
    for (const { pattern, priority } of headingPatterns) {
      // 查找所有匹配（每次创建新正则以避免lastIndex问题）
      const globalPattern = new RegExp(pattern.source, 'gi');
      let match;
      while ((match = globalPattern.exec(headerSlice)) !== null) {
        const text = match[1].trim();
        if (text && text.length > 0 && text.length < 200) {
          candidates.push({ text, priority });
        }
      }
    }
    
    // 按优先级排序
    candidates.sort((a, b) => a.priority - b.priority);
    
    // 选择最佳标题：优先选择通用章节标题（如 "Chapter 1"）
    const genericPatterns = /^(chapter|section|part)\s*\d+/i;
    for (const candidate of candidates) {
      // 如果是通用标题（如 "Chapter 1"），优先使用
      if (genericPatterns.test(candidate.text)) {
        title = candidate.text;
        break;
      }
    }
    
    // 如果没有找到通用标题，使用第一个候选（非通用标题）
    if (!title && candidates.length > 0) {
      title = candidates[0].text;
    }
    
    // 检测是否主要是图片内容（Cover页面或图片章节）
    const hasImages = /<img[^>]+src=/i.test(html);
    const imageCount = (html.match(/<img[^>]+src=/gi) || []).length;
    const textContent = html.replace(/<[^>]+>/g, '').trim();
    const isMainlyImages = hasImages && (textContent.length < 100 || imageCount > 0);
    
    // 移除 HTML 标签 - 使用更高效的方式
    let text: string;
    
    if (html.length > maxProcessSize) {
      // 大文件使用分段处理
      const chunks: string[] = [];
      for (let i = 0; i < html.length; i += maxProcessSize) {
        const chunk = html.slice(i, i + maxProcessSize);
        chunks.push(this.cleanHtmlChunk(chunk));
      }
      text = chunks.join(' ');
    } else {
      text = this.cleanHtmlChunk(html);
    }
    
    // 如果内容主要是图片且文本很少，添加提示
    if (isMainlyImages && text.trim().length < 50) {
      text = text.trim() + '\n\n[封面图片]';
    }
    
    return { title, content: text.trim() };
  }
  
  /**
   * 清理 HTML 片段，并将每句话单独分段
   */
  private cleanHtmlChunk(html: string): string {
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    // 将每句话单独分段（在句子结尾后添加单个换行）
    // 匹配中英文句号、问号、感叹号
    text = text
      .replace(/([.!?。！？])(\s+)(?=[A-Z"'"\u4e00-\u9fa5])/g, '$1\n')
      .replace(/([.!?。！？])$/gm, '$1\n');
    
    return text;
  }
}

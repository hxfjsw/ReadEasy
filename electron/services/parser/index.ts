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
    
    // 策略1: 优先从 <p> 标签中提取 Chapter X 和其后的子标题
    // 查找所有 <p> 标签，尝试找到章节号和章节名的组合
    const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    let chapterNumber: string | null = null;
    let chapterSubtitle: string | null = null;
    let pCount = 0;
    
    while ((pMatch = pPattern.exec(headerSlice)) !== null) {
      pCount++;
      const rawText = pMatch[1];
      // 保留HTML标签以便检测粗体
      const textWithTags = rawText.trim();
      // 清理后的文本
      const cleanText = textWithTags.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // 跳过空段落或图片段落
      if (!cleanText || cleanText.length === 0 || rawText.includes('<img')) {
        continue;
      }
      
      // 匹配 Chapter X 格式 (如 "Chapter 1", "CHAPTER ONE")
      const chapterMatch = cleanText.match(/^(chapter\s+\d+[\s\S]*)/i);
      if (chapterMatch && !chapterNumber) {
        // 检查是否包含副标题（同一<p>标签内）
        const parts = cleanText.split(/\n|\s{2,}/);
        if (parts.length > 1 && parts[0].match(/^chapter\s+\d+$/i)) {
          chapterNumber = parts[0].trim();
          // 剩余部分作为副标题
          chapterSubtitle = parts.slice(1).join(' ').trim();
        } else {
          chapterNumber = cleanText;
        }
        continue;
      }
      
      // 如果已找到 Chapter X，下一个非空<p>标签可能是副标题
      if (chapterNumber && !chapterSubtitle && cleanText.length < 200) {
        // 检查是否包含粗体标签（通常是章节副标题）
        const hasBold = /<b\b|<strong\b|class="[^"]*bold/i.test(textWithTags);
        // 或者是简短的标题样式文本
        const isShortTitle = cleanText.length < 100 && !cleanText.match(/^[a-z]/);
        
        if (hasBold || isShortTitle) {
          chapterSubtitle = cleanText;
          break; // 找到副标题，停止搜索
        }
      }
      
      // 如果已经处理了几个段落还没找到，停止搜索
      if (pCount > 10) break;
    }
    
    // 组合标题
    if (chapterNumber) {
      if (chapterSubtitle) {
        title = `${chapterNumber} ${chapterSubtitle}`;
      } else {
        title = chapterNumber;
      }
    }
    
    // 策略2: 如果没有从<p>标签找到，尝试从 h1-h6 标题标签提取
    if (!title) {
      const headingPatterns = [
        { tag: 'h1', priority: 10 },
        { tag: 'h2', priority: 20 },
        { tag: 'h3', priority: 30 },
      ];
      
      const candidates: Array<{ text: string; priority: number }> = [];
      
      for (const { tag, priority } of headingPatterns) {
        const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
        let match;
        while ((match = pattern.exec(headerSlice)) !== null) {
          let text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text && text.length > 0 && text.length < 200) {
            candidates.push({ text, priority });
          }
        }
      }
      
      // 从候选标题中提取 Chapter X 模式
      const genericPatterns = /(chapter|section|part)\s*\d+[^\n]*/i;
      for (const candidate of candidates) {
        const match = candidate.text.match(genericPatterns);
        if (match) {
          const chapterIndex = candidate.text.toLowerCase().indexOf(match[0].toLowerCase());
          title = candidate.text.slice(chapterIndex).trim();
          break;
        }
      }
      
      // 如果没有找到 Chapter X 模式，使用优先级最高的候选
      if (!title && candidates.length > 0) {
        candidates.sort((a, b) => a.priority - b.priority);
        title = candidates[0].text;
      }
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
    
    // 从内容中移除标题行（避免重复显示）
    if (title) {
      text = this.removeTitleFromContent(text, title);
    }
    
    // 同时移除 <title> 标签的内容（通常是作者名或书名）
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      const titleText = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      if (titleText && titleText !== title) {
        text = this.removeTitleFromContent(text, titleText);
      }
    }
    
    return { title, content: text.trim() };
  }
  
  /**
   * 从内容中移除标题行
   */
  private removeTitleFromContent(content: string, title: string): string {
    const lines = content.split('\n');
    const filteredLines: string[] = [];
    const titleLower = title.toLowerCase();
    const titleParts = titleLower.split(/\s+/).filter(p => p.length > 2);
    
    for (const line of lines) {
      const lineTrimmed = line.trim();
      const lineLower = lineTrimmed.toLowerCase();
      
      // 跳过空行
      if (!lineTrimmed) {
        filteredLines.push(line);
        continue;
      }
      
      // 跳过完全匹配标题的行
      if (lineLower === titleLower) {
        continue;
      }
      
      // 跳过标题的部分（如单独的 "Chapter 1" 或 "The Three Farmers"）
      let isTitlePart = false;
      for (const part of titleParts) {
        if (lineLower === part || lineLower === `chapter ${part}`) {
          isTitlePart = true;
          break;
        }
      }
      
      // 特殊处理：跳过单独的 Chapter X 行（如果标题包含 Chapter X）
      if (/^chapter\s+\d+$/i.test(lineTrimmed) && titleLower.includes(lineLower)) {
        continue;
      }
      
      // 如果这一行是标题的子字符串（如标题是 "Chapter 1 The Three Farmers"，行是 "The Three Farmers"）
      if (titleLower.includes(lineLower) && lineTrimmed.length > 3) {
        continue;
      }
      
      if (!isTitlePart) {
        filteredLines.push(line);
      }
    }
    
    return filteredLines.join('\n').trim();
  }
  
  /**
   * 清理 HTML 片段，保留段落结构
   */
  private cleanHtmlChunk(html: string): string {
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      // 将块级标签转换为换行符，保留段落结构
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
      .replace(/<(br\s*\/?|hr\s*\/?)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
    
    // 规范化空白字符：将多个空格/换行合并
    text = text
      .replace(/[ \t]+/g, ' ')  // 将多个空格/制表符合并为单个空格
      .replace(/\n[ \t]+/g, '\n')  // 移除行首空格
      .replace(/[ \t]+\n/g, '\n')  // 移除行尾空格
      .replace(/\n{3,}/g, '\n\n')  // 将3个以上连续换行合并为2个
      .trim();
    
    return text;
  }
}

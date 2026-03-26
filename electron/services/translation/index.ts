// Google免费翻译服务
// 使用 Google Translate Web API（免费版，有限制）

import { net } from 'electron';

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  confidence?: number;
}

export interface TranslateOptions {
  text: string;
  targetLang?: string;
  sourceLang?: string;
}

export class GoogleTranslationService {
  // Google免费翻译API端点（基于web版本）
  private readonly GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
  
  /**
   * 使用Google免费翻译API翻译文本
   * 注意：这是Google翻译网页版使用的非公开API，可能有频率限制
   */
  async translate(options: TranslateOptions): Promise<TranslationResult> {
    const { text, targetLang = 'zh-CN', sourceLang = 'auto' } = options;
    
    if (!text || text.trim().length === 0) {
      return { translatedText: '' };
    }

    try {
      // 构建请求参数
      const params = new URLSearchParams();
      params.append('client', 'gtx');
      params.append('sl', sourceLang);      // 源语言
      params.append('tl', targetLang);      // 目标语言
      params.append('hl', targetLang);      // 界面语言
      params.append('dt', 't');             // 返回翻译结果
      params.append('dt', 'bd');            // 返回词典信息
      params.append('dj', '1');             // JSON格式
      params.append('source', 'bubble');
      params.append('ck', '1');
      params.append('q', text);

      const url = `${this.GOOGLE_TRANSLATE_URL}?${params.toString()}`;
      
      // 使用Electron的net模块进行HTTP请求
      const response = await this.fetchWithElectron(url);
      
      return this.parseResponse(response, text);
    } catch (error: any) {
      console.error('Google translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * 使用Electron的net模块进行HTTP请求
   */
  private fetchWithElectron(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        url: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        },
      });

      let data = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          data += chunk.toString();
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${data}`));
          }
        });

        response.on('error', (error) => {
          reject(error);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.end();
    });
  }

  /**
   * 解析Google翻译API的响应
   * Google API返回的是一个JSON数组格式
   */
  private parseResponse(response: string, originalText: string): TranslationResult {
    try {
      // Google API返回的是JSON数组，需要解析
      // 格式: [[["翻译结果","原文",null,null,n]],null,"源语言代码"]
      const parsed = JSON.parse(response);
      
      // 提取翻译结果
      let translatedText = '';
      
      if (Array.isArray(parsed[0])) {
        // 拼接所有翻译片段
        translatedText = parsed[0]
          .map((item: any) => item[0])
          .filter((text: string) => text)
          .join('');
      }

      // 检测到的源语言
      const detectedSourceLanguage = parsed[2] || 'en';
      
      // 置信度（如果有）
      const confidence = parsed[6] || undefined;

      return {
        translatedText: translatedText || originalText,
        detectedSourceLanguage,
        confidence,
      };
    } catch (error) {
      console.error('Failed to parse translation response:', error);
      // 如果解析失败，返回原文
      return { translatedText: originalText };
    }
  }

  /**
   * 批量翻译（Google API支持一次请求多个句子）
   */
  async translateBatch(texts: string[], targetLang: string = 'zh-CN'): Promise<TranslationResult[]> {
    // 对于批量翻译，我们使用\n分隔的文本
    const combinedText = texts.join('\n');
    const result = await this.translate({
      text: combinedText,
      targetLang,
    });

    // 分割结果
    const translatedTexts = result.translatedText.split('\n');
    
    return texts.map((originalText, index) => ({
      translatedText: translatedTexts[index] || originalText,
      detectedSourceLanguage: result.detectedSourceLanguage,
      confidence: result.confidence,
    }));
  }

  /**
   * 测试翻译服务是否可用
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.translate({
        text: 'Hello',
        targetLang: 'zh-CN',
      });
      
      if (result.translatedText && result.translatedText.includes('你好')) {
        return { success: true, message: 'Google免费翻译服务可用' };
      }
      
      return { success: false, message: '翻译结果异常' };
    } catch (error: any) {
      return { 
        success: false, 
        message: `连接失败: ${error.message || '无法连接到Google翻译服务'}` 
      };
    }
  }
}

// 翻译服务管理器
export class TranslationService {
  private googleService: GoogleTranslationService;
  private aiService: any; // AIService实例

  constructor(aiService?: any) {
    this.googleService = new GoogleTranslationService();
    this.aiService = aiService;
  }

  /**
   * 翻译文本
   * @param provider 翻译服务提供商: 'google' | 'ai'
   */
  async translate(
    text: string, 
    provider: 'google' | 'ai' = 'google',
    configId?: number
  ): Promise<string> {
    if (provider === 'google') {
      const result = await this.googleService.translate({ text });
      return result.translatedText;
    } else {
      if (!this.aiService) {
        throw new Error('AI translation service is not available');
      }
      return this.aiService.translateSentence(text, configId);
    }
  }

  /**
   * 测试翻译服务
   */
  async testConnection(provider: 'google' | 'ai'): Promise<{ success: boolean; message: string }> {
    if (provider === 'google') {
      return this.googleService.testConnection();
    } else {
      if (!this.aiService) {
        return { success: false, message: 'AI translation service is not available' };
      }
      // AI服务通过ai:testConnection测试
      return { success: false, message: '请使用AI配置测试' };
    }
  }

  /**
   * 获取Google翻译服务实例
   */
  getGoogleService(): GoogleTranslationService {
    return this.googleService;
  }
}

// 导出单例
export const googleTranslationService = new GoogleTranslationService();

// Free Dictionary API 服务
// 文档: https://dictionaryapi.dev/

import { net } from 'electron';
import { GoogleTranslationService } from '../translation';

export interface FreeDictionaryDefinition {
  definition: string;
  synonyms: string[];
  antonyms: string[];
  example?: string;
}

export interface FreeDictionaryMeaning {
  partOfSpeech: string;
  definitions: FreeDictionaryDefinition[];
  synonyms: string[];
  antonyms: string[];
}

export interface FreeDictionaryPhonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
  license?: {
    name: string;
    url: string;
  };
}

export interface FreeDictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics: FreeDictionaryPhonetic[];
  meanings: FreeDictionaryMeaning[];
  license: {
    name: string;
    url: string;
  };
  sourceUrls: string[];
}

// 内部使用的单词定义格式（与 AIService 兼容）
export interface DictionaryWordDefinition {
  word: string;
  phoneticUk?: string;
  phoneticUs?: string;
  definitions: {
    pos: string;
    meaningCn: string;
    meaningEn: string;
    examples: string[];
  }[];
  level?: string;
  synonyms?: string[];
  antonyms?: string[];
}

// 配置选项
interface DictionaryOptions {
  maxDefinitionsPerPos: number;  // 每个词性最多返回几条释义
  translateToChinese: boolean;   // 是否翻译成中文
}

export class FreeDictionaryService {
  private readonly API_BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';
  private translationService: GoogleTranslationService;

  constructor() {
    this.translationService = new GoogleTranslationService();
  }

  /**
   * 查询单词定义
   * @param word 要查询的单词
   * @param options 配置选项
   * @returns 单词定义，如果未找到返回 null
   */
  async lookup(
    word: string, 
    options: Partial<DictionaryOptions> = {}
  ): Promise<DictionaryWordDefinition | null> {
    const cleanWord = word.toLowerCase().trim();
    const opts: DictionaryOptions = {
      maxDefinitionsPerPos: 2,  // 默认每个词性最多2条释义
      translateToChinese: true,  // 默认翻译成中文
      ...options,
    };
    
    try {
      const url = `${this.API_BASE_URL}/${encodeURIComponent(cleanWord)}`;
      const response = await this.fetchWithElectron(url);
      
      // Free Dictionary API 返回数组
      const data: FreeDictionaryResponse[] = JSON.parse(response);
      
      if (!data || data.length === 0) {
        return null;
      }

      return await this.parseResponse(data[0], opts);
    } catch (error: any) {
      // 404 表示单词未找到
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        console.log(`[FreeDictionary] Word not found: ${cleanWord}`);
        return null;
      }
      console.error('[FreeDictionary] Lookup error:', error);
      throw error;
    }
  }

  /**
   * 使用 Electron 的 net 模块进行 HTTP 请求
   */
  private fetchWithElectron(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        url: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0.36',
          'Accept': 'application/json',
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
          } else if (response.statusCode === 404) {
            reject(new Error('404: Word not found'));
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
   * 解析 API 响应为内部格式
   */
  private async parseResponse(
    data: FreeDictionaryResponse, 
    options: DictionaryOptions
  ): Promise<DictionaryWordDefinition> {
    // 提取音标
    let phoneticUk: string | undefined;
    let phoneticUs: string | undefined;

    for (const phonetic of data.phonetics) {
      if (phonetic.text) {
        // 根据音频 URL 或文本特征判断是英音还是美音
        if (phonetic.audio?.includes('-uk') || phonetic.audio?.includes('_uk')) {
          phoneticUk = phoneticUk || phonetic.text;
        } else if (phonetic.audio?.includes('-us') || phonetic.audio?.includes('_us')) {
          phoneticUs = phoneticUs || phonetic.text;
        } else if (!phoneticUk && !phoneticUs) {
          // 如果没有明确标识，先用作默认音标
          phoneticUk = phonetic.text;
        }
      }
    }

    // 如果没有从 phonetics 数组获取到，使用顶层的 phonetic
    if (!phoneticUk && data.phonetic) {
      phoneticUk = data.phonetic;
    }

    // 解析定义 - 精简释义数量
    const definitions: DictionaryWordDefinition['definitions'] = [];
    const allSynonyms: string[] = [];
    const allAntonyms: string[] = [];

    for (const meaning of data.meanings) {
      const pos = this.formatPartOfSpeech(meaning.partOfSpeech);
      
      // 收集同义词和反义词
      if (meaning.synonyms) {
        allSynonyms.push(...meaning.synonyms);
      }
      if (meaning.antonyms) {
        allAntonyms.push(...meaning.antonyms);
      }

      // 只取前 N 条释义
      const limitedDefs = meaning.definitions.slice(0, options.maxDefinitionsPerPos);

      for (const def of limitedDefs) {
        const examples: string[] = [];
        if (def.example) {
          examples.push(def.example);
        }

        definitions.push({
          pos,
          meaningCn: '', // 临时占位，稍后翻译
          meaningEn: def.definition,
          examples,
        });

        // 收集定义级别的同义词
        if (def.synonyms) {
          allSynonyms.push(...def.synonyms);
        }
        if (def.antonyms) {
          allAntonyms.push(...def.antonyms);
        }
      }
    }

    // 翻译成中文（如果需要且释义不多，避免请求过多）
    if (options.translateToChinese && definitions.length > 0) {
      try {
        // 批量翻译所有英文释义
        const textsToTranslate = definitions.map(d => d.meaningEn);
        const translatedTexts = await this.translateBatch(textsToTranslate);
        
        for (let i = 0; i < definitions.length; i++) {
          definitions[i].meaningCn = translatedTexts[i] || definitions[i].meaningEn;
        }
      } catch (error) {
        console.log('[FreeDictionary] Translation failed, using English definitions only');
        // 翻译失败时保留英文释义
        for (const def of definitions) {
          def.meaningCn = def.meaningEn;
        }
      }
    } else {
      // 不翻译时，中文释义设为英文
      for (const def of definitions) {
        def.meaningCn = def.meaningEn;
      }
    }

    return {
      word: data.word,
      phoneticUk,
      phoneticUs,
      definitions,
      synonyms: Array.from(new Set(allSynonyms)).slice(0, 5), // 精简同义词数量
      antonyms: Array.from(new Set(allAntonyms)).slice(0, 5),
    };
  }

  /**
   * 批量翻译文本
   */
  private async translateBatch(texts: string[]): Promise<string[]> {
    if (texts.length === 0) return [];
    
    try {
      // 使用 Google 翻译服务批量翻译
      // Google API 支持用换行符分隔的批量翻译
      const combinedText = texts.join('\n---\n');
      const result = await this.translationService.translate({
        text: combinedText,
        targetLang: 'zh-CN',
        sourceLang: 'en',
      });
      
      // 分割结果
      return result.translatedText.split('\n---\n').map(t => t.trim());
    } catch (error) {
      console.error('[FreeDictionary] Batch translation error:', error);
      // 翻译失败返回原文
      return texts;
    }
  }

  /**
   * 格式化词性
   */
  private formatPartOfSpeech(pos: string): string {
    const posMap: Record<string, string> = {
      'noun': 'n.',
      'verb': 'v.',
      'adjective': 'adj.',
      'adverb': 'adv.',
      'pronoun': 'pron.',
      'preposition': 'prep.',
      'conjunction': 'conj.',
      'interjection': 'int.',
      'determiner': 'det.',
      'modal verb': 'modal v.',
      'phrasal verb': 'phr. v.',
    };

    return posMap[pos.toLowerCase()] || pos;
  }

  /**
   * 测试服务是否可用
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.lookup('hello');
      
      if (result && result.word === 'hello') {
        return { success: true, message: 'Free Dictionary API 可用' };
      }
      
      return { success: false, message: 'API 响应异常' };
    } catch (error: any) {
      return { 
        success: false, 
        message: `连接失败: ${error.message || '无法连接到 Free Dictionary API'}` 
      };
    }
  }
}

// 导出单例
export const freeDictionaryService = new FreeDictionaryService();

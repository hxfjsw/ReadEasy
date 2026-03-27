// 有道词典 API 服务
// 使用有道词典公开 API

import { net } from 'electron';

// 有道 API 响应格式
export interface YoudaoCollinsEntry {
  entry: string;
  phonetic?: string;
}

export interface YoudaoEntry {
  phonetic?: string;
  seeAlso?: string;
  trs?: Array<{ pos: string; tran: string }>;
  see?: string;
}

export interface YoudaoWebTrans {
  key?: string;
  'key-speech'?: string;
}

export interface YoudaoResponse {
  // 简单释义
  ec?: {
    word?: {
      trs?: Array<{ tr?: Array<{ l?: { i?: string } }>; pos?: string }>;
      phone?: string;
      'speech'?: string;
      'uk-phone'?: string;
      'us-phone'?: string;
    };
  };
  // 柯林斯词典
  collins?: {
    collins_entries?: Array<{
      basic_entries?: {
        basic_entry?: Array<{
          headword?: string;
          phonetic?: string;
        }>;
      };
      entries?: {
        entry?: Array<{
          tran_entry?: Array<{
            pos?: string;
            tran?: string;
            def?: string;
            seeAlsos?: Array<{ seeAlso?: string }>;
            exam_sents?: {
              sent?: Array<{
                speech?: string;
                eng_sent?: string;
                chn_sent?: string;
              }>;
            };
          }>;
        }>;
      };
    }>;
  };
  // 网络释义
  web_trans?: {
    'web-translation'?: Array<YoudaoWebTrans>;
  };
  // 短语
  phrs?: {
    phrs?: Array<{ phr?: { headword?: string; translation?: string } }>;
  };
  // 词形
  simple?: {
    word?: Array<{
      phone?: string;
    }>;
  };
  // 同义词
  synonym?: {
    synonyms?: Array<{
      syno?: Array<{ pos: string; ws: string; tran: string }>;
    }>;
  };
}

// 内部使用的单词定义格式
export interface YoudaoWordDefinition {
  word: string;
  phoneticUk?: string;
  phoneticUs?: string;
  definitions: {
    pos: string;
    meaningCn: string;
    meaningEn?: string;
    examples: string[];
  }[];
  level?: string;
  synonyms?: string[];
  antonyms?: string[];
  phrases?: string[];
}

// 配置选项
interface DictionaryOptions {
  maxDefinitionsPerPos: number;
}

export class YoudaoDictionaryService {
  private readonly API_BASE_URL = 'http://dict.youdao.com/jsonapi';

  /**
   * 查询单词定义
   * @param word 要查询的单词
   * @param options 配置选项
   * @returns 单词定义，如果未找到返回 null
   */
  async lookup(
    word: string,
    options: Partial<DictionaryOptions> = {}
  ): Promise<YoudaoWordDefinition | null> {
    const cleanWord = word.toLowerCase().trim();
    const opts: DictionaryOptions = {
      maxDefinitionsPerPos: 2,
      ...options,
    };

    try {
      const url = `${this.API_BASE_URL}?q=${encodeURIComponent(cleanWord)}`;
      const response = await this.fetchWithElectron(url);

      const data: YoudaoResponse = JSON.parse(response);

      if (!data || this.isEmptyResult(data)) {
        console.log(`[YoudaoDict] Word not found: ${cleanWord}`);
        return null;
      }

      return this.parseResponse(cleanWord, data, opts);
    } catch (error: any) {
      console.error('[YoudaoDict] Lookup error:', error);
      throw error;
    }
  }

  /**
   * 检查结果是否为空
   */
  private isEmptyResult(data: YoudaoResponse): boolean {
    // 没有任何有效数据
    const hasEc = data.ec?.word?.trs && data.ec.word.trs.length > 0;
    const hasCollins = data.collins?.collins_entries && data.collins.collins_entries.length > 0;
    const hasWebTrans = data.web_trans?.['web-translation'] && data.web_trans['web-translation'].length > 0;
    
    return !hasEc && !hasCollins && !hasWebTrans;
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'http://dict.youdao.com/',
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
   * 解析 API 响应为内部格式
   */
  private parseResponse(
    word: string,
    data: YoudaoResponse,
    options: DictionaryOptions
  ): YoudaoWordDefinition {
    const definitions: YoudaoWordDefinition['definitions'] = [];
    const allSynonyms: string[] = [];
    const phrases: string[] = [];

    // 提取音标 - 优先从简单释义获取
    let phoneticUk: string | undefined;
    let phoneticUs: string | undefined;

    if (data.ec?.word) {
      phoneticUk = data.ec.word['uk-phone'] || data.ec.word.phone;
      phoneticUs = data.ec.word['us-phone'] || data.ec.word.phone;
    }

    // 从 simple 补充音标
    if (!phoneticUk && data.simple?.word?.[0]?.phone) {
      phoneticUk = data.simple.word[0].phone;
    }

    // 1. 解析柯林斯词典释义（更详细）
    if (data.collins?.collins_entries) {
      for (const collinsEntry of data.collins.collins_entries) {
        // 获取柯林斯音标
        if (collinsEntry.basic_entries?.basic_entry?.[0]?.phonetic) {
          if (!phoneticUk) phoneticUk = collinsEntry.basic_entries.basic_entry[0].phonetic;
        }

        if (collinsEntry.entries?.entry) {
          for (const entry of collinsEntry.entries.entry) {
            if (entry.tran_entry) {
              for (const tranEntry of entry.tran_entry) {
                const pos = tranEntry.pos || '';
                let meaning = tranEntry.tran || tranEntry.def || '';
                
                // 清理 HTML 标签
                meaning = this.cleanHtmlTags(meaning);

                if (meaning) {
                  const examples: string[] = [];
                  
                  // 提取例句
                  if (tranEntry.exam_sents?.sent) {
                    for (const sent of tranEntry.exam_sents.sent.slice(0, 2)) {
                      if (sent.eng_sent && sent.chn_sent) {
                        examples.push(`${sent.eng_sent}\n${sent.chn_sent}`);
                      }
                    }
                  }

                  // 合并相同词性的释义
                  const existingDef = definitions.find(d => d.pos === pos);
                  if (existingDef) {
                    if (!existingDef.meaningCn.includes(meaning)) {
                      existingDef.meaningCn += '; ' + meaning;
                    }
                    if (examples.length > 0) {
                      existingDef.examples.push(...examples);
                    }
                  } else {
                    definitions.push({
                      pos,
                      meaningCn: meaning,
                      examples: examples.slice(0, 2),
                    });
                  }
                }

                // 收集同义词
                if (tranEntry.seeAlsos) {
                  for (const seeAlso of tranEntry.seeAlsos) {
                    if (seeAlso.seeAlso) {
                      allSynonyms.push(seeAlso.seeAlso);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // 2. 解析简单释义（如果柯林斯没有）
    if (definitions.length === 0 && data.ec?.word?.trs) {
      for (const tr of data.ec.word.trs) {
        const meaning = tr.tr?.[0]?.l?.i;
        const pos = tr.pos || '';
        
        if (meaning) {
          const existingDef = definitions.find(d => d.pos === pos);
          if (existingDef) {
            existingDef.meaningCn += '; ' + meaning;
          } else {
            definitions.push({
              pos,
              meaningCn: meaning,
              examples: [],
            });
          }
        }
      }
    }

    // 3. 网络释义作为备选
    if (definitions.length === 0 && data.web_trans?.['web-translation']) {
      const webTrans = data.web_trans['web-translation']
        .map(w => w.key)
        .filter(Boolean)
        .join('; ');
      
      if (webTrans) {
        definitions.push({
          pos: '网络',
          meaningCn: webTrans,
          examples: [],
        });
      }
    }

    // 4. 收集短语
    if (data.phrs?.phrs) {
      for (const phr of data.phrs.phrs.slice(0, 5)) {
        if (phr.phr?.headword) {
          phrases.push(`${phr.phr.headword} ${phr.phr.translation || ''}`.trim());
        }
      }
    }

    // 5. 收集同义词
    if (data.synonym?.synonyms) {
      for (const synGroup of data.synonym.synonyms) {
        if (synGroup.syno) {
          for (const syn of synGroup.syno) {
            if (syn.ws) {
              // 解析同义词（格式：word1 word2 word3）
              const words = syn.ws.split(/\s+/).filter(w => w && !w.includes('；'));
              allSynonyms.push(...words.slice(0, 5));
            }
          }
        }
      }
    }

    // 精简每个词性的释义数量
    const limitedDefinitions = this.limitDefinitions(definitions, options.maxDefinitionsPerPos);

    return {
      word,
      phoneticUk,
      phoneticUs,
      definitions: limitedDefinitions,
      synonyms: Array.from(new Set(allSynonyms)).slice(0, 5),
      antonyms: [],
      phrases: phrases.slice(0, 5),
    };
  }

  /**
   * 清理 HTML 标签
   */
  private cleanHtmlTags(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * 限制每个词性的释义数量
   */
  private limitDefinitions(
    definitions: YoudaoWordDefinition['definitions'],
    limit: number
  ): YoudaoWordDefinition['definitions'] {
    const result: YoudaoWordDefinition['definitions'] = [];
    const posCount: Record<string, number> = {};

    for (const def of definitions) {
      const pos = def.pos || '其他';
      posCount[pos] = (posCount[pos] || 0) + 1;
      
      if (posCount[pos] <= limit) {
        result.push(def);
      }
    }

    return result;
  }

  /**
   * 测试服务是否可用
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.lookup('hello');

      if (result && result.word === 'hello') {
        return { success: true, message: '有道词典 API 可用' };
      }

      return { success: false, message: 'API 响应异常' };
    } catch (error: any) {
      return {
        success: false,
        message: `连接失败: ${error.message || '无法连接到有道词典 API'}`,
      };
    }
  }
}

// 导出单例
export const youdaoDictionaryService = new YoudaoDictionaryService();

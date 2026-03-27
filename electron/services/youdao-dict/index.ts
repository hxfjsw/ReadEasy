// 有道词典 API 服务
// 使用有道词典公开 API

import { net } from 'electron';

// 有道 API 响应格式
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
      // 词形变化
      wfs?: Array<{
        wf?: {
          name?: string;
          value?: string;
        };
      }>;
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
      // 音标和发音
      'uk-phone'?: string;
      'us-phone'?: string;
    }>;
  };
  // 同义词
  synonym?: {
    synonyms?: Array<{
      syno?: Array<{ pos: string; ws: string; tran: string }>;
    }>;
  };
  // 反义词
  antonym?: {
    antonyms?: Array<{
      ant?: Array<{ pos: string; ws: string; tran: string }>;
    }>;
  };
  // 考试类型/难度标签
  ecExam?: {
    exam_type?: Array<string>;
  };
  // 词频
  freq?: {
    items?: Array<{
      pos?: string;
      count?: string;
      rank?: string;
    }>;
  };
  // 专业释义
  special?: {
    sum?: string;
    entries?: Array<{
      major?: string;
      entry?: Array<{ value?: string }>;
    }>;
  };
  // 双语例句
  blng_sents?: {
    'sentence-pair'?: Array<{
      sentence?: string;
      'sentence-translation'?: string;
    }>;
  };
  // 权威例句
  auth_sents?: {
    sent?: Array<{
      speech?: string;
      corpus?: string;
    }>;
  };
}

// 词形变化
export interface WordForm {
  name: string;
  value: string;
}

// 内部使用的单词定义格式
export interface YoudaoWordDefinition {
  word: string;
  phonetic?: string;
  phoneticUk?: string;
  phoneticUs?: string;
  definitions: {
    pos: string;
    meaningCn: string;
    meaningEn?: string;
    examples: string[];
  }[];
  level?: string;
  examTypes?: string[];
  wordForms?: WordForm[];
  synonyms?: string[];
  antonyms?: string[];
  phrases?: string[];
  professional?: Array<{ major: string; meanings: string[] }>;
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
    const allAntonyms: string[] = [];
    const phrases: string[] = [];
    const wordForms: WordForm[] = [];
    const professional: Array<{ major: string; meanings: string[] }> = [];

    // ========== 提取音标 ==========
    let phonetic: string | undefined;
    let phoneticUk: string | undefined;
    let phoneticUs: string | undefined;

    // 从 ec 获取音标
    if (data.ec?.word) {
      phonetic = data.ec.word.phone;
      phoneticUk = data.ec.word['uk-phone'];
      phoneticUs = data.ec.word['us-phone'];
    }

    // 从 simple 补充音标
    if (data.simple?.word?.[0]) {
      const simpleWord = data.simple.word[0];
      phonetic = phonetic || simpleWord.phone;
      phoneticUk = phoneticUk || simpleWord['uk-phone'];
      phoneticUs = phoneticUs || simpleWord['us-phone'];
    }

    // 从柯林斯补充音标
    if (!phonetic && data.collins?.collins_entries?.[0]?.basic_entries?.basic_entry?.[0]?.phonetic) {
      phonetic = data.collins.collins_entries[0].basic_entries.basic_entry[0].phonetic;
    }

    // ========== 提取词形变化 ==========
    if (data.ec?.word?.wfs) {
      for (const wf of data.ec.word.wfs) {
        if (wf.wf?.name && wf.wf?.value) {
          wordForms.push({
            name: wf.wf.name,
            value: wf.wf.value,
          });
        }
      }
    }

    // ========== 提取难度等级/考试类型 ==========
    const examTypes: string[] = [];
    if (data.ecExam?.exam_type) {
      examTypes.push(...data.ecExam.exam_type);
    }
    // 根据词频估算难度
    let level = this.calculateLevel(examTypes, data.freq);

    // ========== 提取柯林斯词典释义 ==========
    if (data.collins?.collins_entries) {
      for (const collinsEntry of data.collins.collins_entries) {
        if (collinsEntry.entries?.entry) {
          for (const entry of collinsEntry.entries.entry) {
            if (entry.tran_entry) {
              for (const tranEntry of entry.tran_entry) {
                const pos = this.formatPos(tranEntry.pos);
                let meaning = tranEntry.tran || tranEntry.def || '';
                
                // 清理 HTML 标签
                meaning = this.cleanHtmlTags(meaning);

                if (meaning) {
                  const examples: string[] = [];
                  
                  // 提取柯林斯例句
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

    // ========== 提取简单释义（如果柯林斯没有） ==========
    if (definitions.length === 0 && data.ec?.word?.trs) {
      for (const tr of data.ec.word.trs) {
        const meaning = tr.tr?.[0]?.l?.i;
        const pos = this.formatPos(tr.pos);
        
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

    // ========== 网络释义作为备选 ==========
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

    // ========== 提取双语例句（补充到第一个释义） ==========
    if (data.blng_sents?.['sentence-pair']) {
      for (const sent of data.blng_sents['sentence-pair'].slice(0, 3)) {
        if (sent.sentence && sent['sentence-translation']) {
          const exampleText = `${sent.sentence}\n${sent['sentence-translation']}`;
          // 添加到第一个有例句数组的释义
          for (const def of definitions) {
            if (def.examples.length < 3 && !def.examples.includes(exampleText)) {
              def.examples.push(exampleText);
              break;
            }
          }
        }
      }
    }

    // ========== 提取短语 ==========
    if (data.phrs?.phrs) {
      for (const phr of data.phrs.phrs.slice(0, 8)) {
        if (phr.phr?.headword) {
          const phraseText = phr.phr.translation 
            ? `${phr.phr.headword}  ${phr.phr.translation}`
            : phr.phr.headword;
          phrases.push(phraseText);
        }
      }
    }

    // ========== 提取同义词 ==========
    if (data.synonym?.synonyms) {
      for (const synGroup of data.synonym.synonyms) {
        if (synGroup.syno) {
          for (const syn of synGroup.syno) {
            if (syn.ws) {
              // 解析同义词（格式：word1 word2 word3）
              const words = syn.ws.split(/\s+/).filter(w => w && !w.includes('；') && !w.includes(';'));
              allSynonyms.push(...words);
            }
          }
        }
      }
    }

    // ========== 提取反义词 ==========
    if (data.antonym?.antonyms) {
      for (const antGroup of data.antonym.antonyms) {
        if (antGroup.ant) {
          for (const ant of antGroup.ant) {
            if (ant.ws) {
              const words = ant.ws.split(/\s+/).filter(w => w && !w.includes('；') && !w.includes(';'));
              allAntonyms.push(...words);
            }
          }
        }
      }
    }

    // ========== 提取专业释义 ==========
    if (data.special?.entries) {
      for (const entry of data.special.entries.slice(0, 3)) {
        if (entry.major && entry.entry) {
          const meanings = entry.entry
            .map(e => e.value)
            .filter(Boolean)
            .map(v => this.cleanHtmlTags(v!));
          if (meanings.length > 0) {
            professional.push({
              major: entry.major,
              meanings: meanings.slice(0, 2),
            });
          }
        }
      }
    }

    // ========== 精简每个词性的释义数量 ==========
    const limitedDefinitions = this.limitDefinitions(definitions, options.maxDefinitionsPerPos);

    return {
      word,
      phonetic,
      phoneticUk,
      phoneticUs,
      definitions: limitedDefinitions,
      level,
      examTypes: examTypes.slice(0, 5),
      wordForms: wordForms.slice(0, 6),
      synonyms: Array.from(new Set(allSynonyms)).slice(0, 8),
      antonyms: Array.from(new Set(allAntonyms)).slice(0, 5),
      phrases: phrases.slice(0, 8),
      professional: professional.slice(0, 3),
    };
  }

  /**
   * 格式化词性
   */
  private formatPos(pos?: string): string {
    if (!pos) return '';
    
    const posMap: Record<string, string> = {
      'n.': 'n.',
      'v.': 'v.',
      'adj.': 'adj.',
      'adv.': 'adv.',
      'pron.': 'pron.',
      'prep.': 'prep.',
      'conj.': 'conj.',
      'int.': 'int.',
      'det.': 'det.',
      'modal': 'modal',
      'abbr.': 'abbr.',
      'num.': 'num.',
      'art.': 'art.',
    };

    // 标准化词性格式
    let normalizedPos = pos.toLowerCase().trim();
    if (!normalizedPos.endsWith('.') && normalizedPos.length > 1) {
      normalizedPos += '.';
    }

    return posMap[normalizedPos] || pos;
  }

  /**
   * 根据考试类型和词频计算难度等级
   */
  private calculateLevel(examTypes: string[], freq?: YoudaoResponse['freq']): string {
    // 根据考试类型判断难度
    if (examTypes.length > 0) {
      // 按难度排序
      const levelOrder = ['中考', '高考', '四级', '六级', '考研', '雅思', '托福', 'GRE', '专四', '专八'];
      for (const level of levelOrder.reverse()) {
        if (examTypes.some(t => t.includes(level))) {
          return level;
        }
      }
      return examTypes[0];
    }

    // 根据词频估算（如果有）
    if (freq?.items && freq.items.length > 0) {
      // 这里可以根据词频数据估算，但有道的词频数据格式不明确
      // 暂不处理
    }

    return '';
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

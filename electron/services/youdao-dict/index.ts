// 有道词典 API 服务
// 使用有道词典公开 API

import { net } from 'electron';

// 有道 API 响应格式（基于实际返回）
export interface YoudaoResponse {
  // 简单释义
  ec?: {
    source?: { name?: string; url?: string };
    word?: Array<{
      trs?: Array<{
        tr?: Array<{
          l?: { i?: string | string[] };
        }>;
      }>;
      phone?: string;
      ukphone?: string;
      usphone?: string;
      'ukspeech'?: string;
      'usspeech'?: string;
      'return-phrase'?: { l?: { i?: string } };
      prototype?: string;
    }>;
  };
  // 柯林斯词典
  collins?: {
    collins_entries?: Array<{
      entries?: {
        entry?: Array<{
          tran_entry?: Array<{
            pos_entry?: { pos?: string; pos_tips?: string };
            tran?: string;
            exam_sents?: {
              sent?: Array<{
                chn_sent?: string;
                eng_sent?: string;
              }>;
            };
          }>;
        }>;
      };
      basic_entries?: {
        basic_entry?: Array<{
          loc?: string;
          headword?: string;
        }>;
      };
      hwas?: string;
      headword?: string;
    }>;
  };
  // 网络释义
  web_trans?: {
    'web-translation'?: Array<{
      key?: string;
      'key-speech'?: string;
      trans?: Array<{ value?: string }>;
    }>;
  };
  // 单词本身信息（含音标）
  simple?: {
    query?: string;
    word?: Array<{
      usphone?: string;
      ukphone?: string;
      ukspeech?: string;
      usspeech?: string;
      'return-phrase'?: string;
    }>;
  };
  // 相关词形变化
  rel_word?: {
    word?: string;
    stem?: string;
    rels?: Array<{
      rel?: {
        pos?: string;
        words?: Array<{
          word?: string;
          tran?: string;
        }>;
      };
    }>;
  };
  // 个人学习信息（含难度等级）
  individual?: {
    trs?: Array<{
      pos?: string;
      tran?: string;
    }>;
    idiomatic?: Array<{
      colloc?: { en?: string; zh?: string };
    }>;
    level?: string;
    examInfo?: {
      year?: number;
      questionTypeInfo?: Array<{ time?: number; type?: string }>;
      recommendationRate?: number;
      frequency?: number;
    };
    returnPhrase?: string;
    pastExamSents?: Array<{
      en?: string;
      zh?: string;
      source?: string;
    }>;
  };
  // 双语例句
  blng_sents_part?: {
    'sentence-count'?: number;
    'sentence-pair'?: Array<{
      sentence?: string;
      'sentence-eng'?: string;
      'sentence-translation'?: string;
      source?: string;
    }>;
    trsClassify?: Array<{ proportion?: string; tr?: string }>;
  };
  // 权威例句
  auth_sents_part?: {
    'sentence-count'?: number;
    sent?: Array<{
      score?: number;
      speech?: string;
      source?: string;
      foreign?: string;
    }>;
  };
  // 媒体例句
  media_sents_part?: {
    'sentence-count'?: number;
    sent?: Array<{
      '@mediatype'?: string;
      eng?: string;
      chn?: string;
      snippets?: {
        snippet?: Array<{
          streamUrl?: string;
          source?: string;
        }>;
      };
    }>;
  };
  // 专业释义
  special?: {
    summary?: {
      sources?: { source?: { site?: string; url?: string } };
      text?: string;
    };
    total?: string;
    entries?: Array<{
      entry?: {
        major?: string;
        trs?: Array<{ tr?: { nat?: string; cite?: string }; num?: number }>;
        num?: number;
      };
    }>;
  };
  // 元数据
  meta?: {
    input?: string;
    guessLanguage?: string;
    le?: string;
    lang?: string;
    dicts?: string[];
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
    examples: string[];
  }[];
  level?: string;
  examInfo?: {
    frequency?: number;
    recommendationRate?: number;
  };
  wordForms?: WordForm[];
  synonyms?: string[];
  phrases?: string[];
  professional?: Array<{ major: string; meanings: string[] }>;
  pastExamSents?: Array<{ en: string; zh: string; source?: string }>;
}

// 配置选项
interface DictionaryOptions {
  maxDefinitionsPerPos: number;
  maxExamples: number;
  includeExamSents: boolean;
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
      maxExamples: 3,
      includeExamSents: true,
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
    const hasEc = data.ec?.word && data.ec.word.length > 0;
    const hasCollins = data.collins?.collins_entries && data.collins.collins_entries.length > 0;
    const hasSimple = data.simple?.word && data.simple.word.length > 0;
    const hasIndividual = data.individual?.trs && data.individual.trs.length > 0;

    return !hasEc && !hasCollins && !hasSimple && !hasIndividual;
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
    const phrases: string[] = [];
    const professional: Array<{ major: string; meanings: string[] }> = [];

    // ========== 提取音标 ==========
    let phonetic: string | undefined;
    let phoneticUk: string | undefined;
    let phoneticUs: string | undefined;

    // 优先从 simple 获取音标（更可靠）
    if (data.simple?.word?.[0]) {
      const simpleWord = data.simple.word[0];
      phoneticUk = simpleWord.ukphone;
      phoneticUs = simpleWord.usphone;
    }

    // 从 ec 补充音标
    if (data.ec?.word?.[0]) {
      const ecWord = data.ec.word[0];
      phonetic = ecWord.phone;
      phoneticUk = phoneticUk || ecWord.ukphone;
      phoneticUs = phoneticUs || ecWord.usphone;
    }

    // ========== 提取难度等级和考试信息 ==========
    let level: string | undefined;
    const examInfo: { frequency?: number; recommendationRate?: number } = {};

    if (data.individual?.level) {
      level = data.individual.level;
    }

    if (data.individual?.examInfo) {
      examInfo.frequency = data.individual.examInfo.frequency;
      examInfo.recommendationRate = data.individual.examInfo.recommendationRate;
    }

    // ========== 解析柯林斯词典释义（优先，质量更高）==========
    if (data.collins?.collins_entries) {
      for (const entry of data.collins.collins_entries) {
        if (entry.entries?.entry) {
          for (const e of entry.entries.entry) {
            if (e.tran_entry) {
              for (const tran of e.tran_entry) {
                const pos = this.formatPos(tran.pos_entry?.pos);
                const meaning = this.cleanHtmlTags(tran.tran || '');

                if (meaning && pos) {
                  const examples: string[] = [];

                  // 提取柯林斯例句
                  if (tran.exam_sents?.sent) {
                    for (const sent of tran.exam_sents.sent.slice(0, 2)) {
                      if (sent.eng_sent) {
                        const exampleText = sent.chn_sent
                          ? `${sent.eng_sent}\n${sent.chn_sent}`
                          : sent.eng_sent;
                        examples.push(exampleText);
                      }
                    }
                  }

                  // 合并相同词性的释义
                  const existingDef = definitions.find((d) => d.pos === pos);
                  if (existingDef) {
                    if (!existingDef.meaningCn.includes(meaning)) {
                      existingDef.meaningCn += '; ' + meaning;
                    }
                    examples.forEach((ex) => {
                      if (!existingDef.examples.includes(ex)) {
                        existingDef.examples.push(ex);
                      }
                    });
                  } else {
                    definitions.push({
                      pos,
                      meaningCn: meaning,
                      examples: examples.slice(0, options.maxExamples),
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // ========== 从 individual 解析释义（如果柯林斯没有）==========
    if (definitions.length === 0 && data.individual?.trs) {
      for (const tr of data.individual.trs) {
        const pos = this.formatPos(tr.pos);
        const meaning = tr.tran;

        if (meaning) {
          const existingDef = definitions.find((d) => d.pos === pos);
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

    // ========== 从 ec 解析释义（备选）==========
    if (definitions.length === 0 && data.ec?.word?.[0]?.trs) {
      for (const tr of data.ec.word[0].trs) {
        const meaning = tr.tr?.[0]?.l?.i;
        if (typeof meaning === 'string') {
          // 解析 "词性. 释义" 格式
          const match = meaning.match(/^([a-z]+\.?)\s*(.+)$/i);
          if (match) {
            const pos = this.formatPos(match[1]);
            const def = match[2];
            definitions.push({
              pos,
              meaningCn: def,
              examples: [],
            });
          } else {
            definitions.push({
              pos: '',
              meaningCn: meaning,
              examples: [],
            });
          }
        }
      }
    }

    // ========== 提取双语例句（补充到释义中）==========
    if (data.blng_sents_part?.['sentence-pair']) {
      const sents = data.blng_sents_part['sentence-pair'].slice(0, options.maxExamples);
      for (const sent of sents) {
        if (sent['sentence-eng'] && sent['sentence-translation']) {
          const exampleText = `${sent['sentence-eng']}\n${sent['sentence-translation']}`;
          // 找到最合适的释义添加例句
          for (const def of definitions) {
            if (def.examples.length < options.maxExamples) {
              def.examples.push(exampleText);
              break;
            }
          }
        }
      }
    }

    // ========== 提取真题例句 ==========
    const pastExamSents: Array<{ en: string; zh: string; source?: string }> = [];
    if (options.includeExamSents && data.individual?.pastExamSents) {
      for (const sent of data.individual.pastExamSents.slice(0, 3)) {
        if (sent.en && sent.zh) {
          pastExamSents.push({
            en: sent.en,
            zh: sent.zh,
            source: sent.source,
          });
        }
      }
    }

    // ========== 提取词形变化 ==========
    const wordForms: WordForm[] = [];
    if (data.rel_word?.rels) {
      for (const rel of data.rel_word.rels) {
        if (rel.rel?.pos && rel.rel.words) {
          const pos = rel.rel.pos;
          for (const w of rel.rel.words.slice(0, 2)) {
            if (w.word && w.word !== word) {
              wordForms.push({
                name: `${pos} ${w.word}`,
                value: w.tran || '',
              });
            }
          }
        }
      }
    }

    // ========== 提取短语搭配 ==========
    if (data.individual?.idiomatic) {
      for (const item of data.individual.idiomatic.slice(0, 5)) {
        if (item.colloc?.en) {
          const phraseText = item.colloc.zh
            ? `${item.colloc.en}  ${item.colloc.zh}`
            : item.colloc.en;
          phrases.push(phraseText);
        }
      }
    }

    // ========== 提取专业释义 ==========
    if (data.special?.entries) {
      for (const entry of data.special.entries.slice(0, 3)) {
        if (entry.entry?.major) {
          const meanings: string[] = [];
          if (entry.entry.trs) {
            for (const tr of entry.entry.trs) {
              if (tr.tr?.nat) {
                meanings.push(tr.tr.nat);
              }
            }
          }
          if (meanings.length > 0) {
            professional.push({
              major: entry.entry.major,
              meanings: meanings.slice(0, 2),
            });
          }
        }
      }
    }

    // ========== 精简释义数量 ==========
    const limitedDefinitions = this.limitDefinitions(definitions, options.maxDefinitionsPerPos);

    return {
      word,
      phonetic,
      phoneticUk,
      phoneticUs,
      definitions: limitedDefinitions,
      level,
      examInfo,
      wordForms: wordForms.slice(0, 6),
      phrases: phrases.slice(0, 8),
      professional: professional.slice(0, 3),
      pastExamSents: pastExamSents.length > 0 ? pastExamSents : undefined,
    };
  }

  /**
   * 格式化词性
   */
  private formatPos(pos?: string): string {
    if (!pos) return '';

    const posMap: Record<string, string> = {
      n: 'n.',
      v: 'v.',
      adj: 'adj.',
      adv: 'adv.',
      pron: 'pron.',
      prep: 'prep.',
      conj: 'conj.',
      int: 'int.',
      det: 'det.',
      modal: 'modal',
      abbr: 'abbr.',
      num: 'num.',
      art: 'art.',
      ADJ: 'adj.',
      N: 'n.',
      V: 'v.',
      ADV: 'adv.',
    };

    // 清理并标准化词性
    let normalizedPos = pos.trim();

    // 如果已经有.后缀，先去掉
    if (normalizedPos.endsWith('.')) {
      normalizedPos = normalizedPos.slice(0, -1);
    }

    return posMap[normalizedPos] || pos;
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
      .replace(/&nbsp;/g, ' ')
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

import { ParserService } from '../parser';
import { ECDICTService } from '../ecdict';
import { DatabaseService } from '../database';
import { verb, noun, adjective } from 'wink-lemmatizer';

export interface ExtractedWord {
  word: string;
  count: number;
  example?: string;
  definitionCn?: string;
  phoneticUs?: string;
  tag?: string;
  frq?: number;
}

export interface ExtractWordsResult {
  words: ExtractedWord[];
  totalCount: number;
  masteredCount: number;
  ignoredCount: number;
}

export interface LoadDefinitionsResult {
  words: ExtractedWord[];
  loadedCount: number;
  missingCount: number;
}

// 检查是否是重复字母（如 aaaa, bbbb）
const isRepeatedChar = (word: string): boolean => {
  if (word.length < 2) return false;
  const firstChar = word[0];
  for (let i = 1; i < word.length; i++) {
    if (word[i] !== firstChar) return false;
  }
  return true;
};

// 词形还原
const lemmatizeWord = (word: string): string => {
  const verbForm = verb(word);
  if (verbForm !== word) return verbForm;
  
  const nounForm = noun(word);
  if (nounForm !== word) return nounForm;
  
  const adjForm = adjective(word);
  if (adjForm !== word) return adjForm;
  
  return word;
};

export class WordExtractionService {
  private parserService: ParserService;
  private ecdictService: ECDICTService;
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService, parserService: ParserService, ecdictService: ECDICTService) {
    this.parserService = parserService || new ParserService();
    this.ecdictService = ecdictService;
    this.dbService = dbService;
  }

  /**
   * 从文件中提取单词
   */
  async extractWords(filePath: string): Promise<ExtractWordsResult> {
    console.log('[WordExtraction] Starting extraction:', filePath);
    const startTime = Date.now();

    // 1. 读取文件
    const fileResult = await this.readFile(filePath);
    if (!fileResult.success || !fileResult.content) {
      throw new Error(fileResult.error || '读取文件失败');
    }

    // 2. 获取熟词本和废词本
    const [masteredWords, ignoredWords] = await Promise.all([
      this.dbService.getMasteredWords(),
      this.dbService.getIgnoredWords(),
    ]);

    const masteredSet = new Set(masteredWords.map(w => w.toLowerCase()));
    const ignoredSet = new Set(ignoredWords.map(w => w.toLowerCase()));

    // 3. 提取单词
    const wordData = this.extractWordsFromText(fileResult.content);
    const allWords: ExtractedWord[] = Array.from(wordData.entries())
      .map(([word, data]) => ({
        word,
        count: data.count,
        example: data.example,
      }));

    // 4. 计算排除数量
    const masteredCount = allWords.filter(item => masteredSet.has(item.word.toLowerCase())).length;
    const ignoredCount = allWords.filter(item => ignoredSet.has(item.word.toLowerCase())).length;

    // 5. 过滤
    const filteredWords = allWords.filter(item => 
      !masteredSet.has(item.word.toLowerCase()) && 
      !ignoredSet.has(item.word.toLowerCase())
    );

    // 6. 批量查询 ECDICT 释义
    await this.loadDefinitionsFromECDICT(filteredWords);

    const duration = Date.now() - startTime;
    console.log(`[WordExtraction] Completed in ${duration}ms, total: ${allWords.length}, filtered: ${filteredWords.length}`);

    return {
      words: filteredWords,
      totalCount: allWords.length,
      masteredCount,
      ignoredCount,
    };
  }

  /**
   * 加载单词释义（从 ECDICT、本地数据库、AI）
   */
  async loadDefinitions(words: ExtractedWord[]): Promise<LoadDefinitionsResult> {
    const updatedWords = [...words];
    let loadedCount = 0;
    let missingCount = 0;

    // 1. ECDICT 批量查询
    const wordList = words.map(w => w.word.toLowerCase());
    const ecdictResult = this.ecdictService.batchLookup(wordList);
    
    for (let i = 0; i < updatedWords.length; i++) {
      const word = updatedWords[i].word.toLowerCase();
      const entry = ecdictResult.get(word);
      if (entry?.definitionCn) {
        updatedWords[i] = {
          ...updatedWords[i],
          definitionCn: entry.definitionCn,
          phoneticUs: entry.phoneticUs,
          tag: entry.tag,
          frq: entry.frq,
        };
        loadedCount++;
      }
    }

    // 2. 查询本地数据库
    const missingWords = updatedWords.filter(w => !w.definitionCn);
    for (const word of missingWords) {
      const wordFromDB = this.dbService.getWord(word.word.toLowerCase());
      if (wordFromDB?.definitionCn) {
        const index = updatedWords.findIndex(w => w.word === word.word);
        if (index !== -1) {
          updatedWords[index] = {
            ...updatedWords[index],
            definitionCn: wordFromDB.definitionCn,
          };
          loadedCount++;
        }
      }
    }

    missingCount = updatedWords.filter(w => !w.definitionCn).length;

    return {
      words: updatedWords,
      loadedCount,
      missingCount,
    };
  }

  /**
   * 排除无效词（ECDICT 中找不到的词）
   */
  async ignoreInvalidWords(
    words: ExtractedWord[], 
    source?: string
  ): Promise<{ validWords: ExtractedWord[]; ignoredCount: number }> {
    const wordList = words.map(w => w.word.toLowerCase());
    const ecdictResult = this.ecdictService.batchLookup(wordList);
    
    const foundWords = new Set<string>();
    ecdictResult.forEach((value, key) => {
      if (value.definitionCn) {
        foundWords.add(key);
      }
    });

    const invalidWords = words.filter(w => !foundWords.has(w.word.toLowerCase()));
    
    if (invalidWords.length > 0) {
      const invalidWordStrings = invalidWords.map(w => w.word);
      this.dbService.batchAddIgnoredWords(invalidWordStrings, source);
    }

    const validWords = words.filter(w => foundWords.has(w.word.toLowerCase()));
    
    return {
      validWords,
      ignoredCount: invalidWords.length,
    };
  }

  /**
   * 读取文件内容
   */
  private async readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const ext = filePath.split('.').pop()?.toLowerCase();
      
      if (ext === 'epub') {
        const book = await this.parserService.parseEpub(filePath, { maxContentSize: 100 * 1024 * 1024 });
        return { success: true, content: book.content };
      } else if (ext === 'txt') {
        const book = await this.parserService.parseTxt(filePath, { maxContentSize: 100 * 1024 * 1024 });
        return { success: true, content: book.content };
      } else {
        return { success: false, error: '不支持的文件格式' };
      }
    } catch (error: any) {
      console.error('[WordExtraction] Read file error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 从文本中提取单词
   */
  private extractWordsFromText(text: string): Map<string, { count: number; example?: string }> {
    const wordData = new Map<string, { count: number; example?: string }>();
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const matches = text.match(/[a-zA-Z]{4,}/g);
    
    if (matches) {
      for (const word of matches) {
        const lowerWord = word.toLowerCase();
        // 过滤纯重复字母和常见无意义组合，且长度在4-20之间
        if (!isRepeatedChar(lowerWord) && lowerWord.length >= 4 && lowerWord.length <= 20) {
          const lemma = lemmatizeWord(lowerWord);
          
          const existing = wordData.get(lemma);
          if (existing) {
            existing.count++;
          } else {
            let example: string | undefined;
            for (const sentence of sentences) {
              if (sentence.toLowerCase().includes(lowerWord)) {
                example = sentence.trim().replace(/\s+/g, ' ');
                if (example.length > 120) {
                  example = example.slice(0, 120) + '...';
                }
                break;
              }
            }
            wordData.set(lemma, { count: 1, example });
          }
        }
      }
    }
    return wordData;
  }

  /**
   * 从 ECDICT 批量加载释义
   */
  private async loadDefinitionsFromECDICT(words: ExtractedWord[]): Promise<void> {
    const wordList = words.map(w => w.word.toLowerCase());
    const ecdictResult = this.ecdictService.batchLookup(wordList);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].word.toLowerCase();
      const entry = ecdictResult.get(word);
      if (entry?.definitionCn) {
        words[i] = {
          ...words[i],
          definitionCn: entry.definitionCn,
          phoneticUs: entry.phoneticUs,
          tag: entry.tag,
          frq: entry.frq,
        };
      }
    }
  }
}

// 导出单例
export const createWordExtractionService = (dbService: DatabaseService, parserService: ParserService, ecdictService: ECDICTService) => {
  return new WordExtractionService(dbService, parserService, ecdictService);
};

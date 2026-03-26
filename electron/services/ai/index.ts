import OpenAI from 'openai';
import { DatabaseService } from '../database';
import { AIConfig } from '../database/schema';

export interface WordDefinition {
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

export interface VocabularyAnalysis {
  words: {
    word: string;
    level: string;
    frequency: number;
  }[];
  statistics: {
    totalWords: number;
    uniqueWords: number;
    byLevel: Record<string, number>;
  };
}

export class AIService {
  private dbService: DatabaseService;
  private clients: Map<number, OpenAI> = new Map();

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  // 获取或创建 OpenAI 客户端
  private async getClient(configId?: number): Promise<{ client: OpenAI; config: AIConfig }> {
    let config: AIConfig | undefined;
    
    if (configId) {
      const configs = this.dbService.getAIConfigs();
      config = configs.find(c => c.id === configId);
    }
    
    if (!config) {
      config = this.dbService.getDefaultAIConfig();
    }
    
    if (!config) {
      throw new Error('No AI configuration found');
    }

    if (!config.apiKey) {
      throw new Error('API key is not configured');
    }

    // 检查缓存的客户端
    let client = this.clients.get(config.id);
    if (!client) {
      client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      this.clients.set(config.id, client);
    }

    return { client, config };
  }

  // 测试连接
  async testConnection(config: Omit<AIConfig, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    try {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });

      // 发送一个简单的请求测试连接
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });

      if (response.choices && response.choices.length > 0) {
        return { success: true, message: '连接成功' };
      }
      
      return { success: false, message: '连接失败：无效的响应' };
    } catch (error: any) {
      return { 
        success: false, 
        message: `连接失败：${error.message || '未知错误'}` 
      };
    }
  }

  // 获取单词释义
  async getWordDefinition(word: string, context?: string, configId?: number): Promise<WordDefinition> {
    const { client, config } = await this.getClient(configId);
    
    const prompt = this.buildDefinitionPrompt(word, context);
    
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const result = JSON.parse(content);
      return this.normalizeDefinition(result);
    } catch (error: any) {
      console.error('Failed to get word definition:', error);
      throw new Error(`Failed to get definition: ${error.message}`);
    }
  }

  // 翻译句子
  async translateSentence(text: string, configId?: number): Promise<string> {
    const { client, config } = await this.getClient(configId);
    
    const prompt = `Translate the following English text to Chinese. Only return the translation, no explanation:\n\n${text}`;
    
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error: any) {
      console.error('Failed to translate:', error);
      throw new Error(`Failed to translate: ${error.message}`);
    }
  }

  // 分析词汇难度
  async analyzeVocabulary(text: string, configId?: number): Promise<VocabularyAnalysis> {
    const { client, config } = await this.getClient(configId);
    
    const prompt = this.buildVocabularyAnalysisPrompt(text);
    
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const result = JSON.parse(content);
      return this.normalizeVocabularyAnalysis(result);
    } catch (error: any) {
      console.error('Failed to analyze vocabulary:', error);
      throw new Error(`Failed to analyze: ${error.message}`);
    }
  }

  // 生成例句
  async generateExampleSentence(word: string, level: string, configId?: number): Promise<string> {
    const { client, config } = await this.getClient(configId);
    
    const levelDescriptions: Record<string, string> = {
      elementary: 'elementary school students',
      middle: 'middle school students',
      high: 'high school students',
      cet4: 'CET-4 level students',
      cet6: 'CET-6 level students',
      postgraduate: 'postgraduate entrance exam students',
      ielts: 'IELTS test takers',
      toefl: 'TOEFL test takers',
      gre: 'GRE test takers',
      tem8: 'TEM-8 level students',
    };

    const targetAudience = levelDescriptions[level] || 'English learners';
    const prompt = `Generate a simple, natural example sentence using the word "${word}" suitable for ${targetAudience}. Only return the sentence, nothing else.`;
    
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error: any) {
      console.error('Failed to generate example:', error);
      throw new Error(`Failed to generate example: ${error.message}`);
    }
  }

  // 构建单词释义 Prompt
  private buildDefinitionPrompt(word: string, context?: string): string {
    return `You are an English dictionary assistant. Provide detailed information for the word "${word}".
${context ? `Context: "${context}"` : ''}

Please respond in JSON format with the following structure:
{
  "word": "${word}",
  "phonetic_uk": "British phonetic notation (IPA)",
  "phonetic_us": "American phonetic notation (IPA)",
  "definitions": [
    {
      "pos": "part of speech (noun/verb/adjective/adverb/etc.)",
      "meaning_cn": "Chinese meaning",
      "meaning_en": "English meaning",
      "examples": ["example sentence 1", "example sentence 2"]
    }
  ],
  "level": "difficulty level (elementary/middle/high/cet4/cet6/postgraduate/ielts/toefl/gre/tem8)",
  "synonyms": ["synonym1", "synonym2"],
  "antonyms": ["antonym1", "antonym2"]
}

Requirements:
1. Provide at least 2 definitions if the word has multiple meanings
2. Include 1-2 example sentences for each definition
3. Use standard IPA for phonetic notation
4. Level should be based on word frequency and difficulty
5. If context is provided, prioritize the meaning used in that context`;
  }

  // 构建词汇分析 Prompt
  private buildVocabularyAnalysisPrompt(text: string): string {
    return `Analyze the vocabulary in the following text and identify words by difficulty level.

Text: """${text.slice(0, 2000)}"""

Respond in JSON format:
{
  "words": [
    {
      "word": "the word",
      "level": "elementary|middle|high|cet4|cet6|postgraduate|ielts|toefl|gre|tem8",
      "frequency": 1
    }
  ],
  "statistics": {
    "total_words": 100,
    "unique_words": 50,
    "by_level": {
      "elementary": 10,
      "middle": 15,
      "high": 10,
      "cet4": 8,
      "cet6": 4,
      "postgraduate": 1,
      "ielts": 1,
      "toefl": 1,
      "gre": 0,
      "tem8": 0
    }
  }
}

Requirements:
1. Only include content words (nouns, verbs, adjectives, adverbs), exclude common function words
2. Use base form of words (lemmatize)
3. Level classification based on standard word lists
4. Frequency is the number of occurrences in the text`;
  }

  // 规范化定义结果
  private normalizeDefinition(result: any): WordDefinition {
    return {
      word: result.word || '',
      phoneticUk: result.phonetic_uk || result.phoneticUk,
      phoneticUs: result.phonetic_us || result.phoneticUs,
      definitions: Array.isArray(result.definitions) ? result.definitions.map((def: any) => ({
        pos: def.pos || '',
        meaningCn: def.meaning_cn || def.meaningCn || '',
        meaningEn: def.meaning_en || def.meaningEn || '',
        examples: Array.isArray(def.examples) ? def.examples : [],
      })) : [],
      level: result.level,
      synonyms: Array.isArray(result.synonyms) ? result.synonyms : [],
      antonyms: Array.isArray(result.antonyms) ? result.antonyms : [],
    };
  }

  // 规范化词汇分析结果
  private normalizeVocabularyAnalysis(result: any): VocabularyAnalysis {
    return {
      words: Array.isArray(result.words) ? result.words.map((w: any) => ({
        word: w.word || '',
        level: w.level || 'unknown',
        frequency: w.frequency || 1,
      })) : [],
      statistics: {
        totalWords: result.statistics?.total_words || 0,
        uniqueWords: result.statistics?.unique_words || 0,
        byLevel: result.statistics?.by_level || {},
      },
    };
  }
}

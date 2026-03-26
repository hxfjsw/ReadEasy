import OpenAI from 'openai';
import { DatabaseService } from '../database';
import { AIConfig } from '../database/schema';

// 词根词缀分析
export interface RootAnalysis {
  prefix?: { value: string; meaning: string };
  root: { value: string; meaning: string; origin?: string };
  suffix?: { value: string; meaning: string };
  explanation: string;
}

// 相关词
export interface RelatedWord {
  word: string;
  meaning: string;
  relation: string;
}

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
  // 词源和词根词缀
  etymology?: string;
  rootAnalysis?: RootAnalysis;
  relatedWords?: RelatedWord[];
  // 上下文分析
  contextAnalysis?: string;
  contextTranslation?: string;
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
  private clients: Map<string, OpenAI> = new Map();

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  // 获取或创建 OpenAI 客户端
  private async getClient(configId?: number): Promise<{ client: OpenAI; config: AIConfig }> {
    let config: AIConfig | undefined;
    
    console.log('[AIService] getClient called with configId:', configId);
    
    if (configId) {
      const configs = this.dbService.getAIConfigs();
      console.log('[AIService] Available configs:', configs.map(c => ({ id: c.id, name: c.name, baseUrl: c.baseUrl })));
      config = configs.find(c => c.id === configId);
      console.log('[AIService] Found config by ID:', config);
    }
    
    if (!config) {
      console.log('[AIService] No config found by ID, getting default...');
      config = this.dbService.getDefaultAIConfig();
      console.log('[AIService] Default config:', config);
    }
    
    if (!config) {
      throw new Error('No AI configuration found');
    }

    if (!config.apiKey) {
      throw new Error('API key is not configured');
    }

    console.log('[AIService] Using config:', { 
      id: config.id, 
      name: config.name, 
      baseUrl: config.baseUrl,
      provider: config.provider 
    });

    // 使用配置ID和baseUrl的组合作为缓存key，确保配置变更时重新创建客户端
    const cacheKey = `${config.id}_${config.baseUrl}`;
    
    // 检查缓存的客户端
    let client = this.clients.get(cacheKey);
    if (!client) {
      console.log('[AIService] Creating new OpenAI client for:', config.name, 'baseURL:', config.baseUrl);
      client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      this.clients.set(cacheKey, client);
    } else {
      console.log('[AIService] Using cached client for:', cacheKey);
    }

    return { client, config };
  }

  // 测试连接
  async testConnection(config: Omit<AIConfig, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[AIService] Testing connection to:', config.baseUrl);
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
    
    // 使用用户自定义提示词或默认提示词
    const sourceLang = config.sourceLanguage || 'en';
    const targetLang = config.targetLanguage || 'zh-CN';
    
    let prompt: string;
    if (config.customPrompt && config.customPrompt.trim()) {
      // 使用用户自定义提示词，替换变量
      prompt = config.customPrompt
        .replace(/\{\{text\}\}/g, text)
        .replace(/\{\{sourceLanguage\}\}/g, sourceLang)
        .replace(/\{\{targetLanguage\}\}/g, targetLang);
    } else {
      // 默认提示词
      const langMap: Record<string, string> = {
        'en': 'English',
        'zh-CN': 'Chinese',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'fr': 'French',
        'de': 'German',
        'es': 'Spanish',
        'ru': 'Russian',
      };
      const sourceLangName = langMap[sourceLang] || sourceLang;
      const targetLangName = langMap[targetLang] || targetLang;
      prompt = `Translate the following ${sourceLangName} text to ${targetLangName}. Only return the translation, no explanation:\n\n${text}`;
    }
    
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature || 0.3,
        max_tokens: config.maxTokens || 2000,
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
        temperature: config.temperature,
        max_tokens: config.maxTokens,
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
      throw new Error(`Failed to analyze vocabulary: ${error.message}`);
    }
  }

  // 生成例句
  async generateExampleSentence(word: string, level: string, configId?: number): Promise<{ sentence: string; translation: string }> {
    const { client, config } = await this.getClient(configId);
    
    const prompt = this.buildExamplePrompt(word, level);
    
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
      return {
        sentence: result.sentence || result.example || '',
        translation: result.translation || result.chinese || '',
      };
    } catch (error: any) {
      console.error('Failed to generate example:', error);
      throw new Error(`Failed to generate example: ${error.message}`);
    }
  }

  // 构建单词释义提示词
  private buildDefinitionPrompt(word: string, context?: string): string {
    const contextSection = context ? `

IMPORTANT - Context Analysis:
The word appears in this context: "${context}"

You MUST provide:
1. contextAnalysis: Explain what this word means SPECIFICALLY in this context, and why it's used here. Analyze the context in detail.
2. contextTranslation: Provide a natural Chinese translation of the entire context sentence/paragraph.
` : '';

    const contextFields = context ? `,
  "contextAnalysis": "Detailed analysis of what the word means in this specific context, including cultural references, implied meanings, etc.",
  "contextTranslation": "Natural Chinese translation of the entire context"` : '';

    return `Please provide a detailed definition for the word "${word}".${contextSection}

You MUST also provide etymology analysis including:
1. etymology: The origin and history of the word
2. rootAnalysis: Break down the word into its root(s), prefix, and suffix with explanations
3. relatedWords: List 3-5 words that share the same root or are etymologically related

Return the result in the following JSON format:
{
  "word": "${word}",
  "phoneticUk": "British phonetic symbol",
  "phoneticUs": "American phonetic symbol",
  "definitions": [
    {
      "pos": "part of speech (n., v., adj., adv., etc.)",
      "meaningCn": "Chinese meaning",
      "meaningEn": "English meaning",
      "examples": ["Example sentence 1", "Example sentence 2"]
    }
  ],
  "level": "vocabulary level (elementary, middle, high, cet4, cet6, postgraduate, ielts, toefl, gre, tem8)",
  "synonyms": ["synonym1", "synonym2"],
  "antonyms": ["antonym1", "antonym2"],
  "etymology": "Origin and history of the word (e.g., from Latin/Greek/French...)",
  "rootAnalysis": {
    "prefix": {"value": "prefix part", "meaning": "meaning of prefix"},
    "root": {"value": "root part", "meaning": "meaning of root", "origin": "Latin/Greek/etc"},
    "suffix": {"value": "suffix part", "meaning": "meaning of suffix"},
    "explanation": "How the parts combine to form the word meaning"
  },
  "relatedWords": [
    {"word": "related word 1", "meaning": "brief meaning", "relation": "shares same root/prefix/etc"}
  ]${contextFields}
}`;
  }

  // 构建词汇分析提示词
  private buildVocabularyAnalysisPrompt(text: string): string {
    return `Analyze the vocabulary difficulty of the following English text. Identify words that are at different levels (elementary, middle, high, cet4, cet6, postgraduate, ielts, toefl, gre, tem8).

Text: ${text.slice(0, 1000)}

Return the result in the following JSON format:
{
  "words": [
    {
      "word": "example",
      "level": "cet4",
      "frequency": 1
    }
  ],
  "statistics": {
    "totalWords": 100,
    "uniqueWords": 50,
    "byLevel": {
      "elementary": 10,
      "middle": 15,
      "high": 10,
      "cet4": 8,
      "cet6": 4,
      "postgraduate": 2,
      "ielts": 0,
      "toefl": 0,
      "gre": 1,
      "tem8": 0
    }
  }
}`;
  }

  // 构建例句生成提示词
  private buildExamplePrompt(word: string, level: string): string {
    return `Generate an example sentence using the word "${word}" suitable for ${level} level English learners.

Return the result in the following JSON format:
{
  "sentence": "The example sentence using the word.",
  "translation": "中文翻译"
}`;
  }

  // 规范化单词释义结果
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
      etymology: result.etymology,
      rootAnalysis: result.root_analysis || result.rootAnalysis,
      relatedWords: Array.isArray(result.related_words || result.relatedWords) 
        ? (result.related_words || result.relatedWords) : [],
      contextAnalysis: result.context_analysis || result.contextAnalysis,
      contextTranslation: result.context_translation || result.contextTranslation,
    };
  }

  // 规范化词汇分析结果
  private normalizeVocabularyAnalysis(result: any): VocabularyAnalysis {
    return {
      words: Array.isArray(result.words) ? result.words : [],
      statistics: {
        totalWords: result.statistics?.totalWords || 0,
        uniqueWords: result.statistics?.uniqueWords || 0,
        byLevel: result.statistics?.byLevel || {},
      },
    };
  }
}

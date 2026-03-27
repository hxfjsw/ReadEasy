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

  // 获取单词释义（完整版）
  async getWordDefinition(word: string, context?: string, configId?: number): Promise<WordDefinition> {
    const { client, config } = await this.getClient(configId);
    
    const prompt = this.buildDefinitionPrompt(word, context);
    
    try {
      // 检查是否支持 json_object 格式
      const supportsJsonObject = config.provider !== 'lmstudio' && config.provider !== 'custom';
      
      const requestOptions: any = {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      };
      
      // 只有支持的 provider 才使用 response_format
      if (supportsJsonObject) {
        requestOptions.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(requestOptions);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      // 尝试解析 JSON，如果不支持 json_object 格式，可能需要从文本中提取 JSON
      let result: any;
      if (supportsJsonObject) {
        result = JSON.parse(content);
      } else {
        // 尝试从文本中提取 JSON 块
        result = this.extractJsonFromText(content);
      }
      
      return this.normalizeDefinition(result);
    } catch (error: any) {
      console.error('Failed to get word definition:', error);
      throw new Error(`Failed to get definition: ${error.message}`);
    }
  }

  // 获取单词基础释义（分步查询第一步，快速返回）
  async getWordDefinitionBasic(word: string, configId?: number): Promise<Partial<WordDefinition>> {
    const { client, config } = await this.getClient(configId);
    
    const prompt = this.buildBasicDefinitionPrompt(word);
    
    try {
      const supportsJsonObject = config.provider !== 'lmstudio' && config.provider !== 'custom';
      
      const requestOptions: any = {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
        max_tokens: 1000, // 基础释义不需要太多token
      };
      
      if (supportsJsonObject) {
        requestOptions.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(requestOptions);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      let result: any;
      if (supportsJsonObject) {
        result = JSON.parse(content);
      } else {
        result = this.extractJsonFromText(content);
      }
      
      return this.normalizeBasicDefinition(result);
    } catch (error: any) {
      console.error('Failed to get basic word definition:', error);
      throw new Error(`Failed to get basic definition: ${error.message}`);
    }
  }

  // 获取单词详细释义（分步查询第二步，包括词源、词根、上下文分析）
  async getWordDefinitionDetailed(word: string, context?: string, configId?: number): Promise<Partial<WordDefinition>> {
    const { client, config } = await this.getClient(configId);
    
    const prompt = this.buildDetailedDefinitionPrompt(word, context);
    
    try {
      const supportsJsonObject = config.provider !== 'lmstudio' && config.provider !== 'custom';
      
      const requestOptions: any = {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      };
      
      if (supportsJsonObject) {
        requestOptions.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(requestOptions);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      let result: any;
      if (supportsJsonObject) {
        result = JSON.parse(content);
      } else {
        result = this.extractJsonFromText(content);
      }
      
      return this.normalizeDetailedDefinition(result);
    } catch (error: any) {
      console.error('Failed to get detailed word definition:', error);
      throw new Error(`Failed to get detailed definition: ${error.message}`);
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
      // 检查是否支持 json_object 格式
      const supportsJsonObject = config.provider !== 'lmstudio' && config.provider !== 'custom';
      
      const requestOptions: any = {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      };
      
      // 只有支持的 provider 才使用 response_format
      if (supportsJsonObject) {
        requestOptions.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(requestOptions);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      // 尝试解析 JSON
      let result: any;
      if (supportsJsonObject) {
        result = JSON.parse(content);
      } else {
        result = this.extractJsonFromText(content);
      }
      
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
      // 检查是否支持 json_object 格式
      const supportsJsonObject = config.provider !== 'lmstudio' && config.provider !== 'custom';
      
      const requestOptions: any = {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      };
      
      // 只有支持的 provider 才使用 response_format
      if (supportsJsonObject) {
        requestOptions.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(requestOptions);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      // 尝试解析 JSON
      let result: any;
      if (supportsJsonObject) {
        result = JSON.parse(content);
      } else {
        result = this.extractJsonFromText(content);
      }
      
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
1. contextAnalysis: Explain what this word means SPECIFICALLY in this context IN CHINESE (中文), and why it's used here. Analyze the context in detail. Your explanation MUST be in Chinese.
2. contextTranslation: Provide a natural Chinese translation of the entire context sentence/paragraph.
` : '';

    const contextFields = context ? `,
  "contextAnalysis": "用中文详细解释这个单词在此特定上下文中的含义、用法和文化内涵等",
  "contextTranslation": "Natural Chinese translation of the entire context"` : '';

    return `Please provide a detailed definition for the word "${word}".${contextSection}

You MUST also provide etymology analysis in CHINESE (中文) including:
1. etymology: The origin and history of the word explained in Chinese, include the original Latin/Greek/French word if applicable
2. rootAnalysis: Accurately break down the word into its morphemes (prefix, root/stem, suffix). For each part provide:
   - The exact morpheme as it appears in the word (e.g., "ferv-", "-ent-", "-ly")
   - The type (prefix/root/suffix)
   - The etymological source (Latin/Greek/Old English etc.) and precise meaning
   - Use professional etymological terminology
3. relatedWords: List 3-5 words that share the same root or are etymologically related, with meanings in Chinese

IMPORTANT: Return ONLY a valid JSON object in the following format, without any markdown formatting or extra text:
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
  "etymology": "词源解释，用中文详细说明单词的起源和历史，包含原始拉丁语/希腊语/法语词汇及其含义",
  "rootAnalysis": {
    "prefix": {"value": "前缀部分（如：dis-, un-, pre-）", "type": "前缀", "source": "来源语言", "meaning": "准确的词源学含义"},
    "root": {"value": "词根部分（如：ferv-, port-, spect-）", "type": "词根", "source": "拉丁语/希腊语等原始词汇", "meaning": "原始含义及演变"},
    "suffix": {"value": "后缀部分（如：-ent-, -ly, -tion）", "type": "后缀", "source": "来源语言", "meaning": "语法功能及含义"},
    "explanation": "用中文详细解释这些词素如何组合形成单词的完整含义，包含词源演变过程"
  },
  "relatedWords": [
    {"word": "related word 1", "meaning": "中文释义", "relation": "中文说明关联（如：共享相同词根/前缀等）"}
  ]${contextFields}
}`;
  }

  // 构建基础单词释义提示词（分步查询第一步）
  private buildBasicDefinitionPrompt(word: string): string {
    return `Please provide the basic definition for the word "${word}".

IMPORTANT: Return ONLY a valid JSON object in the following format, without any markdown formatting or extra text:
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
  "antonyms": ["antonym1", "antonym2"]
}`;
  }

  // 构建详细单词释义提示词（分步查询第二步）
  private buildDetailedDefinitionPrompt(word: string, context?: string): string {
    const contextSection = context ? `

IMPORTANT - Context Analysis:
The word appears in this context: "${context}"

You MUST provide:
1. contextAnalysis: Explain what this word means SPECIFICALLY in this context IN CHINESE (中文), and why it's used here. Your explanation MUST be in Chinese.
2. contextTranslation: Provide a natural Chinese translation of the entire context sentence/paragraph.
` : '';

    const contextFields = context ? `,
  "contextAnalysis": "用中文详细解释这个单词在此特定上下文中的含义和用法",
  "contextTranslation": "Natural Chinese translation of the entire context"` : '';

    return `Please provide detailed etymology and root analysis for the word "${word}".${contextSection}

You MUST provide in CHINESE (中文):
1. etymology: The origin and history of the word explained in Chinese, include the original Latin/Greek/French word if applicable
2. rootAnalysis: Accurately break down the word into its morphemes (prefix, root/stem, suffix). For each part provide:
   - The exact morpheme as it appears in the word (e.g., "ferv-", "-ent-", "-ly")
   - The type (prefix/root/suffix)
   - The etymological source (Latin/Greek/Old English etc.) and precise meaning
   - Use professional etymological terminology
3. relatedWords: List 3-5 words that share the same root or are etymologically related, with meanings in Chinese

IMPORTANT: Return ONLY a valid JSON object in the following format, without any markdown formatting or extra text:
{
  "etymology": "词源解释，用中文详细说明单词的起源和历史，包含原始拉丁语/希腊语/法语词汇及其含义",
  "rootAnalysis": {
    "prefix": {"value": "前缀部分（如：dis-, un-, pre-）", "type": "前缀", "source": "来源语言", "meaning": "准确的词源学含义"},
    "root": {"value": "词根部分（如：ferv-, port-, spect-）", "type": "词根", "source": "拉丁语/希腊语等原始词汇", "meaning": "原始含义及演变"},
    "suffix": {"value": "后缀部分（如：-ent-, -ly, -tion）", "type": "后缀", "source": "来源语言", "meaning": "语法功能及含义"},
    "explanation": "用中文详细解释这些词素如何组合形成单词的完整含义，包含词源演变过程"
  },
  "relatedWords": [
    {"word": "related word 1", "meaning": "中文释义", "relation": "中文说明关联（如：共享相同词根/前缀等）"}
  ]${contextFields}
}`;
  }

  // 规范化基础单词释义结果
  private normalizeBasicDefinition(result: any): Partial<WordDefinition> {
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

  // 规范化详细单词释义结果
  private normalizeDetailedDefinition(result: any): Partial<WordDefinition> {
    let rootAnalysis = result.root_analysis || result.rootAnalysis;
    if (typeof rootAnalysis === 'string' && rootAnalysis) {
      try {
        rootAnalysis = JSON.parse(rootAnalysis);
      } catch {
        rootAnalysis = undefined;
      }
    }

    let relatedWords = result.related_words || result.relatedWords;
    if (typeof relatedWords === 'string' && relatedWords) {
      try {
        relatedWords = JSON.parse(relatedWords);
      } catch {
        relatedWords = undefined;
      }
    }

    return {
      etymology: result.etymology,
      rootAnalysis,
      relatedWords: Array.isArray(relatedWords) ? relatedWords : [],
      contextAnalysis: result.context_analysis || result.contextAnalysis,
      contextTranslation: result.context_translation || result.contextTranslation,
    };
  }

  // 构建词汇分析提示词
  private buildVocabularyAnalysisPrompt(text: string): string {
    return `Analyze the vocabulary difficulty of the following English text. Identify words that are at different levels (elementary, middle, high, cet4, cet6, postgraduate, ielts, toefl, gre, tem8).

Text: ${text.slice(0, 1000)}

IMPORTANT: Return ONLY a valid JSON object in the following format, without any markdown formatting or extra text:
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

IMPORTANT: Return ONLY a valid JSON object in the following format, without any markdown formatting or extra text:
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

  // 从文本中提取 JSON
  private extractJsonFromText(text: string): any {
    // 尝试直接解析
    try {
      return JSON.parse(text);
    } catch (e) {
      // 尝试查找 JSON 代码块
      const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        try {
          return JSON.parse(jsonBlockMatch[1].trim());
        } catch (e2) {
          // 继续尝试其他方法
        }
      }
      
      // 尝试查找花括号包裹的内容
      const curlyMatch = text.match(/\{[\s\S]*\}/);
      if (curlyMatch) {
        try {
          return JSON.parse(curlyMatch[0]);
        } catch (e3) {
          // 继续尝试其他方法
        }
      }
      
      // 如果都失败了，抛出错误
      throw new Error('无法从响应中解析 JSON: ' + text.substring(0, 100));
    }
  }
}

// 词汇等级
export enum VocabularyLevel {
  ELEMENTARY = 'elementary',
  MIDDLE = 'middle',
  HIGH = 'high',
  CET4 = 'cet4',
  CET6 = 'cet6',
  POSTGRADUATE = 'postgraduate',
  IELTS = 'ielts',
  TOEFL = 'toefl',
  GRE = 'gre',
  TEM8 = 'tem8',
}

export const VocabularyLevelLabels: Record<VocabularyLevel, string> = {
  [VocabularyLevel.ELEMENTARY]: '小学',
  [VocabularyLevel.MIDDLE]: '初中',
  [VocabularyLevel.HIGH]: '高中',
  [VocabularyLevel.CET4]: '四级',
  [VocabularyLevel.CET6]: '六级',
  [VocabularyLevel.POSTGRADUATE]: '考研',
  [VocabularyLevel.IELTS]: '雅思',
  [VocabularyLevel.TOEFL]: '托福',
  [VocabularyLevel.GRE]: 'GRE',
  [VocabularyLevel.TEM8]: '专八',
};

// 单词定义
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
  // 上下文分析
  contextAnalysis?: string;
  contextTranslation?: string;
}

// 单词
export interface Word {
  id: number;
  word: string;
  phoneticUk?: string;
  phoneticUs?: string;
  definitionCn?: string;
  definitionEn?: string;
  level: string;
  frequency?: number;
  source: string;
  createdAt: Date;
}

// 单词本
export interface WordBook {
  id: number;
  name: string;
  description?: string;
  source?: string;
  createdAt: Date;
}

// 单词本中的单词
export interface WordBookItem extends Word {
  context?: string;
  addedAt: Date;
}

// AI配置
export interface AIConfig {
  id?: number;
  provider: 'openai' | 'openai-compatible' | 'azure' | 'anthropic' | 'custom';
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isDefault?: boolean;
  sourceLanguage?: string;
  targetLanguage?: string;
  customPrompt?: string;
  createdAt?: Date;
}

// 阅读记录
export interface ReadingRecord {
  id: number;
  bookName: string;
  filePath: string;
  format: string;
  progress: number;
  currentPosition?: string;
  bookmarks: string[];
  lastReadAt: Date;
}

// 用户设置
export interface UserSettings {
  vocabularyLevel: VocabularyLevel;
  customWords: string[];
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: 'light' | 'dark' | 'sepia';
  highlightColor: string;
}

// 词汇分析
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

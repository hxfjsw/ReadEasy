import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  vocabularyLevel: text('vocabulary_level').notNull().default('cet4'),
  customWords: text('custom_words').notNull().default('[]'),
  settings: text('settings').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 单词表
export const words = sqliteTable('words', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  word: text('word').notNull().unique(),
  phoneticUk: text('phonetic_uk'),
  phoneticUs: text('phonetic_us'),
  definitionCn: text('definition_cn'),
  definitionEn: text('definition_en'),
  level: text('level').notNull(),
  frequency: real('frequency'),
  source: text('source').notNull().default('local'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // 扩展字段
  etymology: text('etymology'),
  rootAnalysis: text('root_analysis'),
  relatedWords: text('related_words'),
});

// 单词本表
export const wordBooks = sqliteTable('word_books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 单词本-单词关联表
export const wordBookItems = sqliteTable('word_book_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wordBookId: integer('word_book_id').notNull(),
  wordId: integer('word_id').notNull(),
  context: text('context'),
  addedAt: integer('added_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // 扩展字段
  contextAnalysis: text('context_analysis'),
  contextTranslation: text('context_translation'),
});

// 阅读记录表
export const readingRecords = sqliteTable('reading_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookName: text('book_name').notNull(),
  filePath: text('file_path').notNull(),
  format: text('format').notNull(),
  progress: real('progress').notNull().default(0),
  currentPosition: text('current_position'),
  bookmarks: text('bookmarks').notNull().default('[]'),
  lastReadAt: integer('last_read_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// AI配置表
export const aiConfigs = sqliteTable('ai_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key').notNull(),
  model: text('model').notNull(),
  temperature: real('temperature').notNull().default(0.3),
  maxTokens: integer('max_tokens').notNull().default(2000),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  // 翻译相关设置
  sourceLanguage: text('source_language').default('en'),
  targetLanguage: text('target_language').default('zh-CN'),
  customPrompt: text('custom_prompt'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 设置表
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 熟词本表 - 只记录单词本身，不需要详细释义
export const masteredWords = sqliteTable('mastered_words', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  word: text('word').notNull().unique(), // 单词本身（小写存储）
  addedAt: integer('added_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// 导出类型
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Word = typeof words.$inferSelect;
export type NewWord = typeof words.$inferInsert;
export type WordBook = typeof wordBooks.$inferSelect;
export type NewWordBook = typeof wordBooks.$inferInsert;
export type WordBookItem = typeof wordBookItems.$inferSelect;
export type NewWordBookItem = typeof wordBookItems.$inferInsert;
export type ReadingRecord = typeof readingRecords.$inferSelect;
export type NewReadingRecord = typeof readingRecords.$inferInsert;
export type AIConfig = typeof aiConfigs.$inferSelect;
export type NewAIConfig = typeof aiConfigs.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type MasteredWord = typeof masteredWords.$inferSelect;
export type NewMasteredWord = typeof masteredWords.$inferInsert;

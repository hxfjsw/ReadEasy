import Database from 'better-sqlite3';


import * as schema from './schema';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export class DatabaseService {
  private db: Database.Database;

  private dbPath: string;

  constructor() {
    // 在用户数据目录创建数据库
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'database');
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = path.join(dbDir, 'readeasy.db');
    this.db = new Database(this.dbPath);

  }

  async initialize(): Promise<void> {
    // 创建表
    this.createTables();
    
    // 初始化默认数据
    await this.initializeDefaultData();
  }

  private createTables(): void {
    // 用户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vocabulary_level TEXT NOT NULL DEFAULT 'cet4',
        custom_words TEXT NOT NULL DEFAULT '[]',
        settings TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // 单词表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL UNIQUE,
        phonetic_uk TEXT,
        phonetic_us TEXT,
        definition_cn TEXT,
        definition_en TEXT,
        level TEXT NOT NULL,
        frequency REAL,
        source TEXT NOT NULL DEFAULT 'local',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // 单词本表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS word_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        source TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // 单词本-单词关联表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS word_book_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_book_id INTEGER NOT NULL,
        word_id INTEGER NOT NULL,
        context TEXT,
        added_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (word_book_id) REFERENCES word_books(id) ON DELETE CASCADE,
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
        UNIQUE(word_book_id, word_id)
      )
    `);

    // 阅读记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reading_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        format TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        current_position TEXT,
        bookmarks TEXT NOT NULL DEFAULT '[]',
        last_read_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // AI配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        temperature REAL NOT NULL DEFAULT 0.3,
        max_tokens INTEGER NOT NULL DEFAULT 2000,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // 设置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // 创建索引
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_words_level ON words(level)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_word_book_items_book_id ON word_book_items(word_book_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_reading_records_path ON reading_records(file_path)`);
  }

  private async initializeDefaultData(): Promise<void> {
    // 检查是否已有默认AI配置
    const defaultConfig = this.db.prepare(
      'SELECT * FROM ai_configs WHERE is_default = 1'
    ).get();

    if (!defaultConfig) {
      // 创建默认AI配置（空配置，需要用户自行设置）
      this.db.prepare(`
        INSERT INTO ai_configs (provider, name, base_url, api_key, model, is_default)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('openai', 'OpenAI', 'https://api.openai.com/v1', '', 'gpt-3.5-turbo', 1);
    }

    // 检查是否已有用户记录
    const user = this.db.prepare('SELECT * FROM users LIMIT 1').get();
    if (!user) {
      this.db.prepare(`
        INSERT INTO users (vocabulary_level, custom_words, settings)
        VALUES (?, ?, ?)
      `).run('cet4', '[]', '{}');
    }

    // 创建默认单词本
    const defaultWordBook = this.db.prepare(
      'SELECT * FROM word_books WHERE name = ?'
    ).get('默认单词本');

    if (!defaultWordBook) {
      this.db.prepare(`
        INSERT INTO word_books (name, description)
        VALUES (?, ?)
      `).run('默认单词本', '自动收藏的单词');
    }
  }

  // 通用查询方法
  query(sql: string, params?: any[]): any[] {
    return this.db.prepare(sql).all(params || []);
  }

  run(sql: string, params?: any[]): Database.RunResult {
    return this.db.prepare(sql).run(params || []);
  }

  get(sql: string, params?: any[]): any {
    return this.db.prepare(sql).get(params || []);
  }

  // 用户相关操作
  getUser(): schema.User | undefined {
    return this.db.prepare('SELECT * FROM users LIMIT 1').get() as schema.User | undefined;
  }

  updateUser(id: number, data: Partial<schema.NewUser>): void {
    const sets: string[] = [];
    const values: any[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);
    
    this.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  // 单词相关操作
  getWord(word: string): schema.Word | undefined {
    return this.db.prepare('SELECT * FROM words WHERE word = ?').get(word) as schema.Word | undefined;
  }

  addWord(data: schema.NewWord): number {
    const result = this.db.prepare(`
      INSERT INTO words (word, phonetic_uk, phonetic_us, definition_cn, definition_en, level, frequency, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.word,
      data.phoneticUk || null,
      data.phoneticUs || null,
      data.definitionCn || null,
      data.definitionEn || null,
      data.level,
      data.frequency || null,
      data.source || 'local'
    );
    return Number(result.lastInsertRowid);
  }

  getWordsByLevel(level: string): schema.Word[] {
    return this.db.prepare('SELECT * FROM words WHERE level = ?').all(level) as schema.Word[];
  }

  // 单词本相关操作
  getWordBooks(): schema.WordBook[] {
    return this.db.prepare('SELECT * FROM word_books ORDER BY created_at DESC').all() as schema.WordBook[];
  }

  addWordBook(data: schema.NewWordBook): number {
    const result = this.db.prepare(`
      INSERT INTO word_books (name, description, source)
      VALUES (?, ?, ?)
    `).run(data.name, data.description || null, data.source || null);
    return Number(result.lastInsertRowid);
  }

  deleteWordBook(id: number): void {
    this.db.prepare('DELETE FROM word_books WHERE id = ?').run(id);
  }

  addWordToBook(wordBookId: number, wordId: number, context?: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO word_book_items (word_book_id, word_id, context)
      VALUES (?, ?, ?)
    `).run(wordBookId, wordId, context || null);
  }

  removeWordFromBook(wordBookId: number, wordId: number): void {
    this.db.prepare(`
      DELETE FROM word_book_items WHERE word_book_id = ? AND word_id = ?
    `).run(wordBookId, wordId);
  }

  getWordsInBook(wordBookId: number): (schema.Word & { context?: string; addedAt: Date })[] {
    return this.db.prepare(`
      SELECT w.*, wbi.context, wbi.added_at as addedAt
      FROM words w
      JOIN word_book_items wbi ON w.id = wbi.word_id
      WHERE wbi.word_book_id = ?
      ORDER BY wbi.added_at DESC
    `).all(wordBookId) as any[];
  }

  // AI配置相关操作
  getAIConfigs(): schema.AIConfig[] {
    return this.db.prepare('SELECT * FROM ai_configs ORDER BY created_at DESC').all() as schema.AIConfig[];
  }

  getDefaultAIConfig(): schema.AIConfig | undefined {
    return this.db.prepare('SELECT * FROM ai_configs WHERE is_default = 1 LIMIT 1').get() as schema.AIConfig | undefined;
  }

  addAIConfig(data: schema.NewAIConfig): number {
    const result = this.db.prepare(`
      INSERT INTO ai_configs (provider, name, base_url, api_key, model, temperature, max_tokens, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.provider,
      data.name,
      data.baseUrl,
      data.apiKey,
      data.model,
      data.temperature || 0.3,
      data.maxTokens || 2000,
      data.isDefault ? 1 : 0
    );
    
    const id = Number(result.lastInsertRowid);
    
    // 如果设置为默认，取消其他默认配置
    if (data.isDefault) {
      this.db.prepare(`
        UPDATE ai_configs SET is_default = 0 WHERE id != ?
      `).run(id);
    }
    
    return id;
  }

  updateAIConfig(id: number, data: Partial<schema.NewAIConfig>): void {
    const sets: string[] = [];
    const values: any[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      const dbKey = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      sets.push(`${dbKey} = ?`);
      values.push(value);
    }
    values.push(id);
    
    this.db.prepare(`UPDATE ai_configs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    
    // 如果设置为默认，取消其他默认配置
    if (data.isDefault) {
      this.db.prepare(`
        UPDATE ai_configs SET is_default = 0 WHERE id != ?
      `).run(id);
    }
  }

  deleteAIConfig(id: number): void {
    this.db.prepare('DELETE FROM ai_configs WHERE id = ?').run(id);
  }

  // 阅读记录相关操作
  getReadingRecords(): schema.ReadingRecord[] {
    return this.db.prepare('SELECT * FROM reading_records ORDER BY last_read_at DESC').all() as schema.ReadingRecord[];
  }

  getReadingRecord(filePath: string): schema.ReadingRecord | undefined {
    return this.db.prepare('SELECT * FROM reading_records WHERE file_path = ?').get(filePath) as schema.ReadingRecord | undefined;
  }

  addOrUpdateReadingRecord(data: schema.NewReadingRecord): void {
    const existing = this.getReadingRecord(data.filePath);
    
    if (existing) {
      this.db.prepare(`
        UPDATE reading_records 
        SET progress = ?, current_position = ?, bookmarks = ?, last_read_at = unixepoch()
        WHERE id = ?
      `).run(data.progress, data.currentPosition || null, data.bookmarks, existing.id);
    } else {
      this.db.prepare(`
        INSERT INTO reading_records (book_name, file_path, format, progress, current_position, bookmarks)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(data.bookName, data.filePath, data.format, data.progress, data.currentPosition || null, data.bookmarks);
    }
  }

  deleteReadingRecord(id: number): void {
    this.db.prepare('DELETE FROM reading_records WHERE id = ?').run(id);
  }

  // 设置相关操作
  getSetting(key: string): string | undefined {
    const result = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return result?.value;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
    `).run(key, value);
  }

  // 关闭数据库
  close(): void {
    this.db.close();
  }
}

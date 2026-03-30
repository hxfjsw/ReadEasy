// 单词练习数据库服务

import Database from 'better-sqlite3';
import {
  PracticeRecord,
  PracticeWord,
  CreatePracticeSessionParams,
  RecordAnswerParams,
  GetPracticeWordsParams,
} from '../../../src/types/practice';

export class PracticeDatabaseService {
  constructor(private db: Database.Database) {}

  // 创建练习相关表
  createTables(): void {
    // 练习会话表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS practice_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_book_id INTEGER NOT NULL,
        mode TEXT NOT NULL DEFAULT 'context',
        total_words INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        wrong_count INTEGER NOT NULL DEFAULT 0,
        started_at INTEGER NOT NULL DEFAULT (unixepoch()),
        completed_at INTEGER,
        FOREIGN KEY (word_book_id) REFERENCES word_books(id) ON DELETE CASCADE
      )
    `);

    // 练习记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS practice_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        word_id INTEGER NOT NULL,
        word_book_item_id INTEGER NOT NULL,
        is_correct INTEGER NOT NULL,
        selected_answer TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        time_spent INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
        FOREIGN KEY (word_book_item_id) REFERENCES word_book_items(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_practice_sessions_book_id ON practice_sessions(word_book_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_practice_records_session_id ON practice_records(session_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_practice_records_word_id ON practice_records(word_id)`);
  }

  // 迁移：添加掌握度相关字段
  migrateProficiencyFields(): void {
    const tableInfo = this.db.prepare(`PRAGMA table_info(word_book_items)`).all() as any[];
    
    const hasProficiencyLevel = tableInfo.some(col => col.name === 'proficiency_level');
    const hasConsecutiveCorrect = tableInfo.some(col => col.name === 'consecutive_correct');

    if (!hasProficiencyLevel) {
      this.db.exec(`ALTER TABLE word_book_items ADD COLUMN proficiency_level INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hasConsecutiveCorrect) {
      this.db.exec(`ALTER TABLE word_book_items ADD COLUMN consecutive_correct INTEGER NOT NULL DEFAULT 0`);
    }
  }

  // 创建练习会话
  createSession(params: CreatePracticeSessionParams): number {
    const result = this.db.prepare(`
      INSERT INTO practice_sessions (word_book_id, mode, total_words, started_at)
      VALUES (?, ?, ?, unixepoch())
    `).run(params.wordBookId, params.mode, params.wordIds.length);

    return Number(result.lastInsertRowid);
  }

  // 获取练习单词列表
  getPracticeWords(params: GetPracticeWordsParams): PracticeWord[] {
    const { wordBookId, filter = 'all' } = params;
    
    let sql = `
      SELECT 
        wbi.id as wordBookItemId,
        w.id as wordId,
        w.word,
        w.phonetic_us as phoneticUs,
        w.definition_cn as definitionCn,
        wbi.context,
        wbi.context_translation as contextTranslation,
        w.level,
        wbi.proficiency_level as proficiencyLevel,
        wbi.consecutive_correct as consecutiveCorrect
      FROM words w
      JOIN word_book_items wbi ON w.id = wbi.word_id
      WHERE wbi.word_book_id = ?
    `;

    // 根据筛选条件添加过滤
    if (filter === 'new') {
      sql += ` AND wbi.proficiency_level = 0`;
    } else if (filter === 'review') {
      sql += ` AND wbi.proficiency_level > 0 AND wbi.proficiency_level < 3`;
    } else if (filter === 'wrong') {
      sql += ` AND wbi.consecutive_correct = 0`;
    }

    sql += ` ORDER BY wbi.added_at DESC`;

    const rows = this.db.prepare(sql).all(wordBookId) as any[];

    return rows.map(row => ({
      wordBookItemId: row.wordBookItemId,
      wordId: row.wordId,
      word: row.word,
      phoneticUs: row.phoneticUs,
      definitionCn: row.definitionCn,
      context: row.context,
      contextTranslation: row.contextTranslation,
      level: row.level,
      proficiencyLevel: row.proficiencyLevel || 0,
      consecutiveCorrect: row.consecutiveCorrect || 0,
    }));
  }

  // 记录答题结果
  recordAnswer(params: RecordAnswerParams): void {
    this.db.prepare(`
      INSERT INTO practice_records 
      (session_id, word_id, word_book_item_id, is_correct, selected_answer, correct_answer, time_spent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
    `).run(
      params.sessionId,
      params.wordId,
      params.wordBookItemId,
      params.isCorrect ? 1 : 0,
      params.selectedAnswer,
      params.correctAnswer,
      params.timeSpent || null
    );

    // 更新单词掌握度
    this.updateWordProficiency(params.wordBookItemId, params.isCorrect);
  }

  // 更新单词掌握度
  private updateWordProficiency(wordBookItemId: number, isCorrect: boolean): void {
    // 先获取当前状态
    const row = this.db.prepare(`
      SELECT proficiency_level, consecutive_correct 
      FROM word_book_items 
      WHERE id = ?
    `).get(wordBookItemId) as any;

    if (!row) return;

    let proficiencyLevel = row.proficiency_level || 0;
    let consecutiveCorrect = row.consecutive_correct || 0;

    if (isCorrect) {
      consecutiveCorrect++;
      // 连续答对3次升级
      if (consecutiveCorrect >= 3) {
        proficiencyLevel = Math.min(3, proficiencyLevel + 1);
        consecutiveCorrect = 0;
      }
    } else {
      consecutiveCorrect = 0;
      // 答错降级
      if (proficiencyLevel > 0) {
        proficiencyLevel--;
      }
    }

    // 更新数据库
    this.db.prepare(`
      UPDATE word_book_items 
      SET proficiency_level = ?, 
          consecutive_correct = ?,
          last_reviewed_at = unixepoch(),
          review_count = review_count + 1
      WHERE id = ?
    `).run(proficiencyLevel, consecutiveCorrect, wordBookItemId);
  }

  // 完成练习会话
  completeSession(sessionId: number, correctCount: number, wrongCount: number): void {
    this.db.prepare(`
      UPDATE practice_sessions 
      SET completed_at = unixepoch(),
          correct_count = ?,
          wrong_count = ?
      WHERE id = ?
    `).run(correctCount, wrongCount, sessionId);
  }

  // 获取练习统计
  getPracticeStats(wordBookId?: number): {
    totalSessions: number;
    totalWords: number;
    totalCorrect: number;
    totalWrong: number;
    accuracy: number;
  } {
    let sql = `
      SELECT 
        COUNT(*) as totalSessions,
        SUM(total_words) as totalWords,
        SUM(correct_count) as totalCorrect,
        SUM(wrong_count) as totalWrong
      FROM practice_sessions
      WHERE completed_at IS NOT NULL
    `;
    
    if (wordBookId) {
      sql += ` AND word_book_id = ?`;
    }

    const row = this.db.prepare(sql).get(wordBookId) as any;

    const totalCorrect = row.totalCorrect || 0;
    const totalWrong = row.totalWrong || 0;
    const total = totalCorrect + totalWrong;

    return {
      totalSessions: row.totalSessions || 0,
      totalWords: row.totalWords || 0,
      totalCorrect,
      totalWrong,
      accuracy: total > 0 ? Math.round((totalCorrect / total) * 100) : 0,
    };
  }

  // 获取单词练习历史
  getWordHistory(wordId: number): PracticeRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM practice_records 
      WHERE word_id = ?
      ORDER BY created_at DESC
    `).all(wordId) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      wordId: row.word_id,
      wordBookItemId: row.word_book_item_id,
      isCorrect: row.is_correct === 1,
      selectedAnswer: row.selected_answer,
      correctAnswer: row.correct_answer,
      timeSpent: row.time_spent,
      createdAt: new Date(row.created_at * 1000),
    }));
  }

  // 获取今日练习统计
  getTodayStats(): {
    todaySessions: number;
    todayWords: number;
    todayCorrect: number;
    todayWrong: number;
  } {
    const row = this.db.prepare(`
      SELECT 
        COUNT(*) as todaySessions,
        SUM(total_words) as todayWords,
        SUM(correct_count) as todayCorrect,
        SUM(wrong_count) as todayWrong
      FROM practice_sessions
      WHERE completed_at IS NOT NULL
      AND date(completed_at, 'unixepoch') = date('now')
    `).get() as any;

    return {
      todaySessions: row.todaySessions || 0,
      todayWords: row.todayWords || 0,
      todayCorrect: row.todayCorrect || 0,
      todayWrong: row.todayWrong || 0,
    };
  }
}

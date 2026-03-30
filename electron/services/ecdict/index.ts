import Database from 'better-sqlite3';
import fs from 'fs';

export interface ECDICTEntry {
  word: string;
  sw: string; // 小写单词（用于搜索）
  phonetic?: string; // 音标
  definition?: string; // 英文定义
  translation?: string; // 中文翻译
  pos?: string; // 词性
  collins?: number; // 柯林斯星级
  oxford?: number; // 是否牛津 3000 词汇
  tag?: string; // 标签，如 zk gk cet4 cet6 考研 ielts toefl gre
  bnc?: number; // 英国国家语料库词频
  frq?: number; // 当代语料库词频
  exchange?: string; // 时态复数等变化
  detail?: string; // 详细 JSON 数据
  audio?: string; // 音频文件名
}

export interface ECDICTDefinition {
  word: string;
  phoneticUs?: string;
  phoneticUk?: string;
  definitionCn: string;
  definitionEn?: string;
  pos?: string;
  level?: string;
  exchange?: string;
  tag?: string;
  frq?: number; // 当代语料库词频
}

export class ECDICTService {
  private db: Database.Database | null = null;
  private dbPath: string = '';

  /**
   * 设置 ECDICT 数据库路径
   */
  setDatabasePath(dbPath: string): boolean {
    // 如果路径没有变化且数据库已连接，不做任何操作
    if (this.dbPath === dbPath && this.db !== null) {
      return true;
    }

    // 关闭现有连接
    this.close();

    this.dbPath = dbPath;

    // 验证路径是否存在
    if (!dbPath || !fs.existsSync(dbPath)) {
      console.log('[ECDICT] Database file not found:', dbPath);
      return false;
    }

    try {
      this.db = new Database(dbPath, { readonly: true });
      console.log('[ECDICT] Connected to database:', dbPath);
      return true;
    } catch (error) {
      console.error('[ECDICT] Failed to connect to database:', error);
      this.db = null;
      return false;
    }
  }

  /**
   * 获取当前数据库路径
   */
  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.db !== null;
  }

  /**
   * 查询单词
   */
  lookup(word: string): ECDICTDefinition | null {
    if (!this.db) {
      return null;
    }

    const cleanWord = word.toLowerCase().trim();

    try {
      const row = this.db.prepare('SELECT * FROM stardict WHERE word = ? COLLATE NOCASE').get(cleanWord) as ECDICTEntry | undefined;

      if (!row) {
        return null;
      }

      return this.parseEntry(row);
    } catch (error) {
      console.error('[ECDICT] Lookup error:', error);
      return null;
    }
  }

  /**
   * 批量查询单词
   */
  batchLookup(words: string[]): Map<string, ECDICTDefinition> {
    const result = new Map<string, ECDICTDefinition>();

    if (!this.db || words.length === 0) {
      return result;
    }

    try {
      // SQLite 对 IN 子句的参数数量有限制（通常 999 个），所以分批查询
      const batchSize = 500;
      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);
        const placeholders = batch.map(() => '?').join(',');
        const stmt = this.db.prepare(`SELECT * FROM stardict WHERE word IN (${placeholders}) COLLATE NOCASE`);
        const rows = stmt.all(...batch) as ECDICTEntry[];

        for (const row of rows) {
          const parsed = this.parseEntry(row);
          result.set(parsed.word.toLowerCase(), parsed);
        }
      }
    } catch (error) {
      console.error('[ECDICT] Batch lookup error:', error);
    }

    return result;
  }

  /**
   * 搜索单词（模糊匹配）
   */
  search(query: string, limit: number = 10): ECDICTDefinition[] {
    if (!this.db) {
      return [];
    }

    const cleanQuery = query.toLowerCase().trim();

    try {
      const rows = this.db.prepare(
        'SELECT * FROM stardict WHERE sw LIKE ? LIMIT ?'
      ).all(`${cleanQuery}%`, limit) as ECDICTEntry[];

      return rows.map(row => this.parseEntry(row));
    } catch (error) {
      console.error('[ECDICT] Search error:', error);
      return [];
    }
  }

  /**
   * 解析数据库条目
   */
  private parseEntry(entry: ECDICTEntry): ECDICTDefinition {
    // 解析音标（ECDICT 的音标格式是 /.../）
    let phoneticUs: string | undefined;
    let phoneticUk: string | undefined;

    if (entry.phonetic) {
      // ECDICT 的音标通常只有一个，我们将其作为美音
      const cleanPhonetic = entry.phonetic.replace(/^\//, '').replace(/\/$/, '');
      phoneticUs = cleanPhonetic;
    }

    // 解析中文释义
    let definitionCn = '';
    if (entry.translation) {
      // translation 字段可能包含多行释义
      definitionCn = entry.translation.replace(/\n/g, '; ').trim();
    } else if (entry.definition) {
      // 如果没有中文翻译，使用英文定义
      definitionCn = entry.definition.replace(/\n/g, '; ').trim();
    }

    // 解析词性
    let pos = entry.pos || '';

    // 解析词频等级标签
    let level = '';
    if (entry.tag) {
      // tag 可能包含多个标签，如 "cet4 cet6"
      const tags = entry.tag.split(/\s+/);
      level = tags[0] || ''; // 取第一个作为等级
    }

    return {
      word: entry.word,
      phoneticUs,
      phoneticUk,
      definitionCn,
      definitionEn: entry.definition,
      pos,
      level,
      exchange: entry.exchange,
      tag: entry.tag,
      frq: entry.frq,
    };
  }

  /**
   * 测试连接
   */
  testConnection(): { success: boolean; message: string } {
    if (!this.db) {
      if (!this.dbPath) {
        return { success: false, message: '未配置 ECDICT 数据库路径' };
      }
      if (!fs.existsSync(this.dbPath)) {
        return { success: false, message: `数据库文件不存在: ${this.dbPath}` };
      }
      return { success: false, message: '数据库连接失败' };
    }

    try {
      // 测试查询
      const result = this.lookup('hello');
      if (result && result.word === 'hello') {
        return { success: true, message: 'ECDICT 连接成功' };
      }
      return { success: false, message: '查询测试失败' };
    } catch (error: any) {
      return { success: false, message: `测试失败: ${error.message}` };
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats(): { totalWords: number } | null {
    if (!this.db) {
      return null;
    }

    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM stardict').get() as { count: number };
      return { totalWords: result.count };
    } catch (error) {
      console.error('[ECDICT] Get stats error:', error);
      return null;
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[ECDICT] Database connection closed');
    }
  }
}

// 导出单例
export const ecdictService = new ECDICTService();

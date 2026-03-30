// 单词练习功能类型定义

export type PracticeMode = 'context' | 'translation';

export interface PracticeSession {
  id: number;
  wordBookId: number;
  mode: PracticeMode;
  totalWords: number;
  correctCount: number;
  wrongCount: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface PracticeRecord {
  id: number;
  sessionId: number;
  wordId: number;
  wordBookItemId: number;
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  timeSpent?: number; // ms
  createdAt: Date;
}

export interface PracticeWord {
  wordBookItemId: number;
  wordId: number;
  word: string;
  phoneticUs?: string;
  definitionCn: string;
  context?: string;
  contextTranslation?: string;
  level: string;
  proficiencyLevel: number;
  consecutiveCorrect: number;
}

export interface PracticeQuestion {
  id: string; // 唯一标识
  wordBookItemId: number;
  wordId: number;
  word: string;
  phoneticUs?: string;
  questionText: string; // "What means 'xxx' here?" 或 "What does 'xxx' mean here?"
  sentence: string; // 完整例句
  highlightWord: string; // 要高亮的词
  options: PracticeOption[];
  correctAnswer: string; // 正确答案的key
}

export interface PracticeOption {
  key: string; // "1", "2", "3", "4"
  text: string; // 选项文本（中文释义或英文单词）
  isCorrect?: boolean; // 仅用于内部判断
}

export interface PracticeProgress {
  current: number;
  total: number;
  correctCount: number;
  wrongCount: number;
}

export interface PracticeStats {
  totalPracticed: number;
  totalCorrect: number;
  accuracy: number;
  streakDays: number;
  todayNewWords: number;
  todayReviewWords: number;
}

// 创建练习会话参数
export interface CreatePracticeSessionParams {
  wordBookId: number;
  mode: PracticeMode;
  wordIds: number[];
}

// 记录答题结果参数
export interface RecordAnswerParams {
  sessionId: number;
  wordBookItemId: number;
  wordId: number;
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  timeSpent?: number;
}

// 获取练习单词参数
export interface GetPracticeWordsParams {
  wordBookId: number;
  mode: PracticeMode;
  count?: number;
  filter?: 'all' | 'new' | 'review' | 'wrong';
}

// 生成干扰项参数
export interface GenerateDistractorsParams {
  correctWord: string;
  correctDefinition: string;
  context: string;
  count?: number;
}

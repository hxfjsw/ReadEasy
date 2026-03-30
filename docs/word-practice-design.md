# 单词本练习功能设计方案

## 一、功能概述

基于语境的单词练习功能，通过展示单词在原文中的上下文，让用户选择正确的中文释义，帮助巩固记忆。

## 二、界面设计（基于截图）

### 2.1 练习界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  ✕  [==========>        ]  进度条                    [⋮]   │  ← 顶部栏
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    What means "震动" here?                                  │  ← 问题
│                                                             │
│    His broom was 🔊 vibrating so hard, it was almost...    │  ← 例句，目标词加粗+发音按钮
│                                                             │
│    ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│    │ [1] vibrating │  │ [2] come off it │  │ [3] Smeltings │  ← 选项（4个）
│    └────────────┘  └────────────┘  └────────────┘          │
│    ┌────────────┐                                          │
│    │ [4] intimidating                                     │
│    └────────────┘                                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✅ Correct! 或 ❌ Wrong!                             │   │  ← 底部反馈栏
│  └─────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────────────────────────┐    │
│  │ EXPLAIN/EDIT │  │           CONTINUE               │    │  ← 操作按钮
│  └──────────────┘  └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 状态流转

```
┌─────────────┐    选择答案    ┌─────────────┐   点击CONTINUE   ┌─────────────┐
│   答题中     │ ────────────→ │  显示结果    │ ──────────────→ │   下一题     │
│  (无反馈)   │               │ (Correct/   │                 │             │
│             │               │   Wrong)     │                 │             │
└─────────────┘               └─────────────┘                 └─────────────┘
                                     │
                                     ↓ 点击EXPLAIN
                              ┌─────────────┐
                              │  查看解析    │
                              │ (单词详情)   │
                              └─────────────┘
```

## 三、数据库设计

### 3.1 新增表

```sql
-- 练习会话表
CREATE TABLE IF NOT EXISTS practice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_book_id INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'context', -- 'context': 语境模式, 'translation': 翻译模式
  total_words INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  FOREIGN KEY (word_book_id) REFERENCES word_books(id) ON DELETE CASCADE
);

-- 练习记录表（每道题的详细记录）
CREATE TABLE IF NOT EXISTS practice_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  word_book_item_id INTEGER NOT NULL,
  is_correct INTEGER NOT NULL, -- 0/1
  selected_answer TEXT NOT NULL, -- 用户选择的答案
  correct_answer TEXT NOT NULL, -- 正确答案
  time_spent INTEGER, -- 答题耗时（毫秒）
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (word_book_item_id) REFERENCES word_book_items(id) ON DELETE CASCADE
);

-- 单词掌握度表（扩展 word_book_items）
-- 使用现有的 review_stage, review_count, last_reviewed_at 字段
-- 新增熟练度字段
ALTER TABLE word_book_items ADD COLUMN proficiency_level INTEGER NOT NULL DEFAULT 0; 
-- 0: 陌生, 1: 模糊, 2: 认识, 3: 掌握
ALTER TABLE word_book_items ADD COLUMN consecutive_correct INTEGER NOT NULL DEFAULT 0;
-- 连续答对次数
```

### 3.2 索引

```sql
CREATE INDEX IF NOT EXISTS idx_practice_sessions_book_id ON practice_sessions(word_book_id);
CREATE INDEX IF NOT EXISTS idx_practice_records_session_id ON practice_records(session_id);
CREATE INDEX IF NOT EXISTS idx_practice_records_word_id ON practice_records(word_id);
CREATE INDEX IF NOT EXISTS idx_word_book_items_proficiency ON word_book_items(proficiency_level);
```

## 四、类型定义

```typescript
// src/types/practice.ts

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
  key: string; // "A", "B", "C", "D" 或 "1", "2", "3", "4"
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
```

## 五、API 设计（IPC Handlers）

```typescript
// electron/ipc/handlers/practice.ts

// 获取练习单词列表
ipcMain.handle('practice:getWords', async (_, params: {
  wordBookId: number;
  mode: PracticeMode;
  count?: number;
  filter?: 'all' | 'new' | 'review' | 'wrong';
}) => {
  // 根据筛选条件返回单词列表
});

// 创建练习会话
ipcMain.handle('practice:createSession', async (_, params: {
  wordBookId: number;
  mode: PracticeMode;
  wordIds: number[];
}) => {
  // 创建新的练习会话，返回sessionId
});

// 记录答题结果
ipcMain.handle('practice:recordAnswer', async (_, params: {
  sessionId: number;
  wordBookItemId: number;
  wordId: number;
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  timeSpent?: number;
}) => {
  // 记录答题结果，更新单词掌握度
});

// 完成练习会话
ipcMain.handle('practice:completeSession', async (_, sessionId: number) => {
  // 标记会话完成，计算统计信息
});

// 获取练习统计
ipcMain.handle('practice:getStats', async (_, wordBookId?: number) => {
  // 返回练习统计数据
});

// 获取单词练习历史
ipcMain.handle('practice:getWordHistory', async (_, wordId: number) => {
  // 返回该单词的历史练习记录
});

// 生成干扰项（用于前端生成选项）
ipcMain.handle('practice:generateDistractors', async (_, params: {
  correctWord: string;
  correctDefinition: string;
  context: string;
  count?: number;
}) => {
  // 使用AI或预定义词典生成干扰项
});
```

## 六、核心算法

### 6.1 选题算法（智能排序）

```typescript
function selectPracticeWords(
  words: PracticeWord[],
  count: number,
  filter: 'all' | 'new' | 'review' | 'wrong'
): PracticeWord[] {
  // 1. 根据filter筛选
  let filtered = words;
  if (filter === 'new') {
    filtered = words.filter(w => w.proficiencyLevel === 0);
  } else if (filter === 'review') {
    filtered = words.filter(w => w.proficiencyLevel > 0 && w.proficiencyLevel < 3);
  } else if (filter === 'wrong') {
    filtered = words.filter(w => w.consecutiveCorrect === 0);
  }

  // 2. 计算优先级分数（越小越优先）
  const scored = filtered.map(word => {
    let score = 0;
    
    // 优先新词
    if (word.proficiencyLevel === 0) score -= 100;
    
    // 优先连续答错的词
    score -= (3 - word.consecutiveCorrect) * 20;
    
    // 优先低频词（假设低频词更难）
    if (word.level === 'gre' || word.level === 'tem8') score -= 10;
    
    // 随机因素（避免顺序固定）
    score += Math.random() * 10;
    
    return { word, score };
  });

  // 3. 按分数排序，取前count个
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(s => s.word);
}
```

### 6.2 干扰项生成策略

```typescript
async function generateDistractors(
  correctWord: string,
  correctDefinition: string,
  context: string,
  allWords: PracticeWord[],
  count: number = 3
): Promise<string[]> {
  const distractors: string[] = [];
  
  // 策略1：从同一单词本中找同级别的单词释义
  const sameLevelWords = allWords.filter(w => 
    w.word !== correctWord && 
    w.definitionCn !== correctDefinition
  );
  
  // 策略2：使用AI生成相似释义（如果配置了AI）
  // 提示词：给定单词和上下文，生成3个容易混淆的中文释义
  
  // 策略3：从本地词典找近义词的不同释义
  
  // 混合策略，确保干扰项质量
  while (distractors.length < count && sameLevelWords.length > 0) {
    const idx = Math.floor(Math.random() * sameLevelWords.length);
    const word = sameLevelWords.splice(idx, 1)[0];
    if (!distractors.includes(word.definitionCn)) {
      distractors.push(word.definitionCn);
    }
  }
  
  return distractors;
}
```

### 6.3 掌握度更新算法

```typescript
function updateProficiency(
  currentLevel: number,
  consecutiveCorrect: number,
  isCorrect: boolean
): { level: number; consecutive: number } {
  if (isCorrect) {
    consecutiveCorrect++;
    // 连续答对3次升级
    if (consecutiveCorrect >= 3) {
      return { 
        level: Math.min(3, currentLevel + 1), 
        consecutive: 0 
      };
    }
  } else {
    consecutiveCorrect = 0;
    // 答错降级
    if (currentLevel > 0) {
      return { 
        level: currentLevel - 1, 
        consecutive: 0 
      };
    }
  }
  
  return { level: currentLevel, consecutive: consecutiveCorrect };
}
```

## 七、组件设计

### 7.1 组件结构

```
src/
├── pages/
│   └── WordBookPage/
│       ├── index.tsx                    # 单词本主页面（现有）
│       ├── components/
│       │   ├── WordList.tsx             # 单词列表（现有）
│       │   └── PracticeButton.tsx       # 开始练习按钮
│       └── practice/
│           ├── PracticePage.tsx         # 练习页面
│           ├── components/
│           │   ├── ProgressBar.tsx      # 进度条
│           │   ├── QuestionCard.tsx     # 题目卡片
│           │   ├── OptionButton.tsx     # 选项按钮
│           │   ├── FeedbackBar.tsx      # 底部反馈栏
│           │   ├── PracticeComplete.tsx # 完成页面
│           │   └── WordExplanation.tsx  # 单词解析弹窗
│           └── hooks/
│               └── usePractice.ts       # 练习状态管理
├── hooks/
│   └── useWordPractice.ts               # 练习数据获取
└── types/
    └── practice.ts                      # 类型定义
```

### 7.2 核心组件 Props

```typescript
// QuestionCard.tsx
interface QuestionCardProps {
  question: PracticeQuestion;
  selectedAnswer?: string;
  showResult: boolean;
  onSelect: (key: string) => void;
  onPlayAudio: () => void;
}

// OptionButton.tsx  
interface OptionButtonProps {
  option: PracticeOption;
  isSelected: boolean;
  isCorrect: boolean;
  showResult: boolean;
  onClick: () => void;
}

// FeedbackBar.tsx
interface FeedbackBarProps {
  isCorrect: boolean;
  correctAnswer: string;
  onExplain: () => void;
  onContinue: () => void;
}
```

## 八、状态管理（usePractice Hook）

```typescript
interface PracticeState {
  // 会话信息
  sessionId?: number;
  mode: PracticeMode;
  
  // 题目相关
  questions: PracticeQuestion[];
  currentIndex: number;
  
  // 答题状态
  answers: Map<string, {
    selected: string;
    isCorrect: boolean;
    timeSpent: number;
  }>;
  
  // 当前题目状态
  currentSelected?: string;
  showResult: boolean;
  questionStartTime: number;
  
  // 统计
  correctCount: number;
  wrongCount: number;
}

interface PracticeActions {
  startPractice: (wordBookId: number, mode: PracticeMode) => Promise<void>;
  selectAnswer: (key: string) => void;
  submitAnswer: () => Promise<void>;
  nextQuestion: () => void;
  finishPractice: () => Promise<void>;
}
```

## 九、与现有功能集成

### 9.1 入口点

1. **单词本页面**：在单词本详情页添加「开始练习」按钮
2. **阅读页面**：收藏单词后提示「去练习」
3. **复习提醒**：基于艾宾浩斯曲线的复习提醒入口

### 9.2 数据复用

- 复用 `word_book_items` 中的 `context`, `contextTranslation`
- 复用 `words` 表中的 `definitionCn`, `phoneticUs`
- 复用现有的复习字段 `review_stage`, `review_count`

### 9.3 AI 服务集成

- **生成干扰项**：使用 AI 根据上下文生成高质量的干扰选项
- **解析单词**：点击 EXPLAIN 时调用现有的 `ai:defineWord`

## 十、实现优先级

### Phase 1: MVP（最小可用）
- [ ] 数据库表创建
- [ ] 基础练习界面（答题、反馈、跳转）
- [ ] 简单干扰项生成（从同单词本随机选）
- [ ] 答题结果记录

### Phase 2: 体验优化
- [ ] 智能选题算法
- [ ] 掌握度系统
- [ ] AI 生成干扰项
- [ ] 练习统计面板

### Phase 3: 高级功能
- [ ] 多种练习模式（中译英、拼写）
- [ ] 复习计划（基于艾宾浩斯）
- [ ] 练习成就系统
- [ ] 错误本功能

## 十一、关键技术点

### 11.1 性能考虑
- 题目预加载：提前生成下一题的选项
- 音频缓存：单词发音本地缓存
- 批量更新：答题结束后批量写入数据库

### 11.2 错误处理
- 选项不足时降级处理（显示"暂无足够选项"提示）
- 上下文缺失时使用 AI 生成例句
- 网络错误时允许离线练习，稍后同步

### 11.3 可访问性
- 键盘导航（1-4选择，Enter确认）
- 屏幕阅读器支持
- 高对比度模式

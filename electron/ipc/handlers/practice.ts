// 单词练习 IPC Handlers

import { ipcMain } from 'electron';
import { DatabaseService } from '../../services/database';
import { PracticeDatabaseService } from '../../services/database/practice';
import { AIService } from '../../services/ai';
import {
  PracticeMode,
  CreatePracticeSessionParams,
  RecordAnswerParams,
  GetPracticeWordsParams,
  GenerateDistractorsParams,
  PracticeQuestion,
  PracticeOption,
} from '../../../src/types/practice';

export function registerPracticeHandlers(
  dbService: DatabaseService,
  _aiService: AIService
): void {
  const practiceDb = new PracticeDatabaseService(dbService['db']);

  // 创建练习会话
  ipcMain.handle('practice:createSession', async (_, params: CreatePracticeSessionParams) => {
    console.log('[IPC] practice:createSession called:', params);
    try {
      const sessionId = practiceDb.createSession(params);
      return { success: true, sessionId };
    } catch (error: any) {
      console.error('[IPC] practice:createSession error:', error);
      return { success: false, message: error.message };
    }
  });

  // 获取练习单词列表
  ipcMain.handle('practice:getWords', async (_, params: GetPracticeWordsParams) => {
    console.log('[IPC] practice:getWords called:', params);
    try {
      let words = practiceDb.getPracticeWords(params);
      
      // 智能排序
      words = selectPracticeWords(words, params.count || words.length, params.filter || 'all');
      
      return { success: true, data: words };
    } catch (error: any) {
      console.error('[IPC] practice:getWords error:', error);
      return { success: false, message: error.message };
    }
  });

  // 生成练习题目（包含干扰项）
  ipcMain.handle('practice:generateQuestions', async (_, params: {
    wordBookId: number;
    mode: PracticeMode;
    count?: number;
    filter?: 'all' | 'new' | 'review' | 'wrong';
  }) => {
    console.log('[IPC] practice:generateQuestions called:', params);
    try {
      // 获取单词列表
      let words = practiceDb.getPracticeWords({
        wordBookId: params.wordBookId,
        mode: params.mode,
        filter: params.filter,
      });
      
      // 智能排序并截取
      words = selectPracticeWords(words, params.count || 20, params.filter || 'all');

      // 生成题目
      const questions: PracticeQuestion[] = await Promise.all(
        words.map(async (word) => {
          // 提取简洁的中文释义（处理JSON格式）
          const correctDefinition = extractSimpleDefinition(word.definitionCn);

          // 生成干扰项
          const distractors = await generateDistractors(
            word.word,
            correctDefinition,
            word.context || '',
            words,
            3
          );

          // 构建选项
          const allOptions = [correctDefinition, ...distractors];
          // 打乱顺序
          const shuffledOptions = shuffleArray(allOptions);
          
          const options: PracticeOption[] = shuffledOptions.map((text, idx) => ({
            key: String(idx + 1),
            text,
            isCorrect: text === correctDefinition,
          }));

          // 找到正确答案的key
          const correctAnswer = options.find(opt => opt.isCorrect)?.key || '1';

          // 构建例句（高亮目标词）
          const sentence = word.context || `Example sentence with the word "${word.word}".`;

          return {
            id: `q-${word.wordBookItemId}`,
            wordBookItemId: word.wordBookItemId,
            wordId: word.wordId,
            word: word.word,
            phoneticUs: word.phoneticUs,
            questionText: generateQuestionText(word.word, params.mode),
            sentence,
            highlightWord: word.word,
            options,
            correctAnswer,
          };
        })
      );

      return { success: true, data: questions };
    } catch (error: any) {
      console.error('[IPC] practice:generateQuestions error:', error);
      return { success: false, message: error.message };
    }
  });

  // 记录答题结果
  ipcMain.handle('practice:recordAnswer', async (_, params: RecordAnswerParams) => {
    console.log('[IPC] practice:recordAnswer called:', params);
    try {
      practiceDb.recordAnswer(params);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] practice:recordAnswer error:', error);
      return { success: false, message: error.message };
    }
  });

  // 完成练习会话
  ipcMain.handle('practice:completeSession', async (_, params: {
    sessionId: number;
    correctCount: number;
    wrongCount: number;
  }) => {
    console.log('[IPC] practice:completeSession called:', params);
    try {
      practiceDb.completeSession(params.sessionId, params.correctCount, params.wrongCount);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] practice:completeSession error:', error);
      return { success: false, message: error.message };
    }
  });

  // 获取练习统计
  ipcMain.handle('practice:getStats', async (_, wordBookId?: number) => {
    console.log('[IPC] practice:getStats called:', wordBookId);
    try {
      const stats = practiceDb.getPracticeStats(wordBookId);
      const todayStats = practiceDb.getTodayStats();
      return { 
        success: true, 
        data: {
          ...stats,
          ...todayStats,
        }
      };
    } catch (error: any) {
      console.error('[IPC] practice:getStats error:', error);
      return { success: false, message: error.message };
    }
  });

  // 获取单词练习历史
  ipcMain.handle('practice:getWordHistory', async (_, wordId: number) => {
    console.log('[IPC] practice:getWordHistory called:', wordId);
    try {
      const history = practiceDb.getWordHistory(wordId);
      return { success: true, data: history };
    } catch (error: any) {
      console.error('[IPC] practice:getWordHistory error:', error);
      return { success: false, message: error.message };
    }
  });

  // 生成干扰项（使用AI）
  ipcMain.handle('practice:generateDistractors', async (_, params: GenerateDistractorsParams) => {
    console.log('[IPC] practice:generateDistractors called:', params);
    try {
      // 如果没有配置AI，返回空数组，前端使用备用方案
      const defaultConfig = dbService.getDefaultAIConfig();
      if (!defaultConfig || !defaultConfig.apiKey) {
        return { success: true, data: [] };
      }

      // TODO: 使用AI服务生成干扰项
      // const prompt = `Given the English word...`;
      // const result = await aiService.chat(prompt, defaultConfig.id);
      // return { success: true, data: result };
      
      // 暂时返回空数组，使用本地干扰项
      return { success: true, data: [] };
    } catch (error: any) {
      console.error('[IPC] practice:generateDistractors error:', error);
      return { success: true, data: [] }; // 返回空数组，不阻断流程
    }
  });
}

// ==================== 辅助函数 ====================

// 智能选题算法
function selectPracticeWords(
  words: any[],
  count: number,
  filter: 'all' | 'new' | 'review' | 'wrong'
): any[] {
  // 1. 根据filter筛选
  let filtered = words;
  if (filter === 'new') {
    filtered = words.filter((w: any) => w.proficiencyLevel === 0);
  } else if (filter === 'review') {
    filtered = words.filter((w: any) => w.proficiencyLevel > 0 && w.proficiencyLevel < 3);
  } else if (filter === 'wrong') {
    filtered = words.filter((w: any) => w.consecutiveCorrect === 0);
  }

  // 如果筛选后数量不足，使用全部单词
  if (filtered.length < count) {
    filtered = words;
  }

  // 2. 计算优先级分数（越小越优先）
  const scored = filtered.map((word: any) => {
    let score = 0;
    
    // 优先新词
    if (word.proficiencyLevel === 0) score -= 100;
    
    // 优先连续答错的词
    score -= (3 - word.consecutiveCorrect) * 20;
    
    // 优先低频词（假设低频词更难）
    if (word.level === 'gre' || word.level === 'tem8') score -= 10;
    if (word.level === 'ielts' || word.level === 'toefl') score -= 5;
    
    // 随机因素（避免顺序固定）
    score += Math.random() * 15;
    
    return { word, score };
  });

  // 3. 按分数排序，取前count个
  return scored
    .sort((a: any, b: any) => a.score - b.score)
    .slice(0, count)
    .map((s: any) => s.word);
}

// 生成干扰项（本地策略）
async function generateDistractors(
  correctWord: string,
  correctDefinition: string,
  _context: string,
  allWords: any[],
  count: number
): Promise<string[]> {
  const distractors: string[] = [];
  
  // 从其他单词中找释义（提取简洁释义后比较）
  const otherWords = allWords.filter((w: any) => 
    w.word !== correctWord && 
    w.definitionCn &&
    extractSimpleDefinition(w.definitionCn) !== correctDefinition
  );

  // 打乱并选取
  const shuffled = shuffleArray([...otherWords]);
  
  for (const word of shuffled) {
    if (distractors.length >= count) break;
    const simpleDef = extractSimpleDefinition(word.definitionCn);
    if (!distractors.includes(simpleDef)) {
      distractors.push(simpleDef);
    }
  }

  return distractors;
}

// 生成问题文本
function generateQuestionText(word: string, mode: PracticeMode): string {
  if (mode === 'context') {
    // 语境模式：问在这个上下文中单词的意思
    return `What means "${word}" here?`;
  } else {
    // 翻译模式：问单词的中文意思
    return `What does "${word}" mean?`;
  }
}

// 打乱数组
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 提取简洁的中文释义
// 处理两种情况：
// 1. JSON格式的词典数据: [{"pos":"...","meaningCn":"..."}]
// 2. 纯文本释义
function extractSimpleDefinition(definition: string | undefined): string {
  if (!definition) return '暂无释义';
  
  // 尝试解析JSON格式
  if (definition.trim().startsWith('[') || definition.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(definition);
      const definitions = Array.isArray(parsed) ? parsed : [parsed];
      
      // 提取第一个释义的中文部分
      for (const def of definitions) {
        if (def.meaningCn) {
          const meaning = def.meaningCn;
          // 尝试匹配连续的中文（长度2-15个字符）
          const chineseMatches = meaning.match(/[\u4e00-\u9fa5]{2,15}/g);
          if (chineseMatches && chineseMatches.length > 0) {
            // 返回第一个匹配的中文词组
            return chineseMatches[0];
          }
          // 如果没有匹配到中文词组，尝试提取中文开头的短语
          const chineseStart = meaning.match(/^[\u4e00-\u9fa5][^\n;,.。，；]{1,10}/);
          if (chineseStart) {
            return chineseStart[0];
          }
          //  fallback: 返回前15个字符
          return meaning.trim().slice(0, 15) || '暂无释义';
        }
      }
    } catch (e) {
      // JSON解析失败，当作纯文本处理
    }
  }
  
  // 纯文本处理：截取前15个字符
  const simplified = definition.trim().slice(0, 15);
  return simplified || '暂无释义';
}

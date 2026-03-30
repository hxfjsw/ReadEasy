import { useState, useCallback } from 'react';
import {
  PracticeQuestion,
  PracticeProgress,
  PracticeMode,
  PracticeStats,
} from '../types/practice';

interface PracticeState {
  sessionId?: number;
  questions: PracticeQuestion[];
  currentIndex: number;
  answers: Map<string, {
    selected: string;
    isCorrect: boolean;
    timeSpent: number;
  }>;
  currentSelected?: string;
  showResult: boolean;
  questionStartTime: number;
  isComplete: boolean;
}

export function useWordPractice() {
  const [state, setState] = useState<PracticeState>({
    questions: [],
    currentIndex: 0,
    answers: new Map(),
    showResult: false,
    questionStartTime: Date.now(),
    isComplete: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 开始练习
  const startPractice = useCallback(async (
    wordBookId: number,
    mode: PracticeMode = 'context',
    count: number = 20,
    filter: 'all' | 'new' | 'review' | 'wrong' = 'all'
  ) => {
    setLoading(true);
    setError(null);

    try {
      // 1. 获取题目
      const questionsResult = await window.electron.ipcRenderer.invoke(
        'practice:generateQuestions',
        { wordBookId, mode, count, filter }
      );

      if (!questionsResult.success) {
        throw new Error(questionsResult.message || 'Failed to generate questions');
      }

      const questions = questionsResult.data;
      if (!questions || questions.length === 0) {
        throw new Error('No words available for practice');
      }

      // 2. 创建会话
      const wordIds = questions.map((q: PracticeQuestion) => q.wordId);
      const sessionResult = await window.electron.ipcRenderer.invoke(
        'practice:createSession',
        { wordBookId, mode, wordIds }
      );

      if (!sessionResult.success) {
        throw new Error(sessionResult.message || 'Failed to create session');
      }

      // 3. 初始化状态
      setState({
        sessionId: sessionResult.sessionId,
        questions,
        currentIndex: 0,
        answers: new Map(),
        showResult: false,
        questionStartTime: Date.now(),
        isComplete: false,
      });

      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // 选择答案
  const selectAnswer = useCallback((key: string) => {
    if (state.showResult) return;
    
    setState(prev => ({
      ...prev,
      currentSelected: key,
    }));
  }, [state.showResult]);

  // 提交答案
  const submitAnswer = useCallback(async () => {
    if (!state.currentSelected || state.showResult) return;

    const currentQuestion = state.questions[state.currentIndex];
    const isCorrect = currentQuestion.correctAnswer === state.currentSelected;
    const timeSpent = Date.now() - state.questionStartTime;

    // 记录到本地状态
    const newAnswers = new Map(state.answers);
    newAnswers.set(currentQuestion.id, {
      selected: state.currentSelected,
      isCorrect,
      timeSpent,
    });

    setState(prev => ({
      ...prev,
      answers: newAnswers,
      showResult: true,
    }));

    // 异步记录到服务器
    if (state.sessionId) {
      try {
        await window.electron.ipcRenderer.invoke('practice:recordAnswer', {
          sessionId: state.sessionId,
          wordBookItemId: currentQuestion.wordBookItemId,
          wordId: currentQuestion.wordId,
          isCorrect,
          selectedAnswer: state.currentSelected,
          correctAnswer: currentQuestion.correctAnswer,
          timeSpent,
        });
      } catch (err) {
        console.error('Failed to record answer:', err);
      }
    }
  }, [state.currentSelected, state.showResult, state.questions, state.currentIndex, state.sessionId, state.answers, state.questionStartTime]);

  // 下一题
  const nextQuestion = useCallback(() => {
    if (state.currentIndex >= state.questions.length - 1) {
      // 完成练习
      completePractice();
      return;
    }

    setState(prev => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      currentSelected: undefined,
      showResult: false,
      questionStartTime: Date.now(),
    }));
  }, [state.currentIndex, state.questions.length]);

  // 完成练习
  const completePractice = useCallback(async () => {
    if (!state.sessionId) return;

    const correctCount = Array.from(state.answers.values()).filter(a => a.isCorrect).length;
    const wrongCount = state.answers.size - correctCount;

    try {
      await window.electron.ipcRenderer.invoke('practice:completeSession', {
        sessionId: state.sessionId,
        correctCount,
        wrongCount,
      });
    } catch (err) {
      console.error('Failed to complete session:', err);
    }

    setState(prev => ({
      ...prev,
      isComplete: true,
    }));
  }, [state.sessionId, state.answers]);

  // 重置练习
  const resetPractice = useCallback(() => {
    setState({
      questions: [],
      currentIndex: 0,
      answers: new Map(),
      showResult: false,
      questionStartTime: Date.now(),
      isComplete: false,
    });
    setError(null);
  }, []);

  // 播放单词发音
  const playAudio = useCallback((word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // 获取当前题目
  const currentQuestion = state.questions[state.currentIndex];

  // 获取进度
  const progress: PracticeProgress = {
    current: state.currentIndex + 1,
    total: state.questions.length,
    correctCount: Array.from(state.answers.values()).filter(a => a.isCorrect).length,
    wrongCount: Array.from(state.answers.values()).filter(a => !a.isCorrect).length,
  };

  // 获取当前答案是否正确
  const isCurrentCorrect = state.currentSelected && currentQuestion
    ? currentQuestion.correctAnswer === state.currentSelected
    : false;

  return {
    // 状态
    loading,
    error,
    sessionId: state.sessionId,
    questions: state.questions,
    currentIndex: state.currentIndex,
    currentQuestion,
    selectedAnswer: state.currentSelected,
    showResult: state.showResult,
    isComplete: state.isComplete,
    progress,
    isCurrentCorrect,
    answers: state.answers,

    // 操作
    startPractice,
    selectAnswer,
    submitAnswer,
    nextQuestion,
    resetPractice,
    playAudio,
  };
}

// 获取练习统计
export async function getPracticeStats(wordBookId?: number): Promise<PracticeStats | null> {
  try {
    const result = await window.electron.ipcRenderer.invoke('practice:getStats', wordBookId);
    if (result.success) {
      return result.data;
    }
    return null;
  } catch (err) {
    console.error('Failed to get practice stats:', err);
    return null;
  }
}

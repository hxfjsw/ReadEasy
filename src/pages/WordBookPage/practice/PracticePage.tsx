import React, { useEffect } from 'react';
import { message, Modal } from 'antd';
import { useWordPractice } from '../../../hooks/useWordPractice';
import { ProgressBar } from './components/ProgressBar';
import { QuestionCard } from './components/QuestionCard';
import { FeedbackBar } from './components/FeedbackBar';
import { PracticeComplete } from './components/PracticeComplete';
import { PracticeMode } from '../../../types/practice';

interface PracticePageProps {
  wordBookId: number;
  wordBookName?: string;
  mode?: PracticeMode;
  count?: number;
  filter?: 'all' | 'new' | 'review' | 'wrong';
  onClose: () => void;
  onComplete?: () => void;
}

export const PracticePage: React.FC<PracticePageProps> = ({
  wordBookId,
  wordBookName: _wordBookName,
  mode = 'context',
  count = 20,
  filter = 'all',
  onClose,
  onComplete,
}) => {
  const {
    loading,
    error,
    currentQuestion,
    selectedAnswer,
    showResult,
    isComplete,
    progress,
    isCurrentCorrect,
    startPractice,
    selectAnswer,
    submitAnswer,
    nextQuestion,
    resetPractice,
    playAudio,
  } = useWordPractice();

  // 初始化练习
  useEffect(() => {
    const init = async () => {
      const result = await startPractice(wordBookId, mode, count, filter);
      if (!result.success) {
        message.error(result.message || 'Failed to start practice');
        onClose();
      }
    };
    init();
  }, [wordBookId, mode, count, filter]);

  // 显示错误
  useEffect(() => {
    if (error) {
      message.error(error);
    }
  }, [error]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComplete || !currentQuestion) return;

      // 数字键 1-4 选择答案
      if (e.key >= '1' && e.key <= '4') {
        const key = e.key;
        const option = currentQuestion.options.find(o => o.key === key);
        if (option && !showResult) {
          selectAnswer(key);
        }
      }

      // Enter 提交或继续
      if (e.key === 'Enter') {
        if (!showResult && selectedAnswer) {
          submitAnswer();
        } else if (showResult) {
          nextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, selectedAnswer, showResult, isComplete, selectAnswer, submitAnswer, nextQuestion]);

  // 处理关闭
  const handleClose = () => {
    if (progress.current > 1 && !isComplete) {
      Modal.confirm({
        title: 'Quit Practice?',
        content: 'Your progress will be saved. You can continue later.',
        okText: 'Quit',
        cancelText: 'Continue',
        onOk: onClose,
      });
    } else {
      onClose();
    }
  };

  // 处理解释/编辑
  const handleExplain = () => {
    if (!currentQuestion) return;
    
    // 显示单词详情
    Modal.info({
      title: currentQuestion.word,
      width: 500,
      content: (
        <div className="py-4">
          <p className="text-gray-600 mb-4">
            <strong>Context:</strong> {currentQuestion.sentence}
          </p>
          <p className="text-gray-600">
            <strong>Correct Answer:</strong> {' '}
            {currentQuestion.options.find(o => o.key === currentQuestion.correctAnswer)?.text}
          </p>
        </div>
      ),
      onOk() {},
    });
  };

  // 处理重新开始
  const handleRestart = async () => {
    resetPractice();
    const result = await startPractice(wordBookId, mode, count, filter);
    if (!result.success) {
      message.error(result.message || 'Failed to restart practice');
    }
  };

  // 处理完成
  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
    onClose();
  };

  // 加载中
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading practice...</p>
        </div>
      </div>
    );
  }

  // 无题目
  if (!currentQuestion && !isComplete) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No words available for practice</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* 进度条 */}
      <ProgressBar
        current={progress.current}
        total={progress.total}
        onClose={handleClose}
      />

      {/* 练习完成页面 */}
      {isComplete ? (
        <PracticeComplete
          total={progress.total}
          correctCount={progress.correctCount}
          wrongCount={progress.wrongCount}
          onRestart={handleRestart}
          onBack={handleComplete}
        />
      ) : (
        <>
          {/* 题目卡片 */}
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              selectedAnswer={selectedAnswer}
              showResult={showResult}
              onSelect={selectAnswer}
              onPlayAudio={() => playAudio(currentQuestion.word)}
            />
          )}

          {/* 反馈栏 */}
          {showResult && (
            <FeedbackBar
              isCorrect={isCurrentCorrect}
              onExplain={handleExplain}
              onContinue={nextQuestion}
            />
          )}

          {/* 提交按钮（答题时显示） */}
          {!showResult && selectedAnswer && (
            <div className="px-6 py-4 bg-white border-t border-gray-200">
              <button
                onClick={() => submitAnswer(selectedAnswer)}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
              >
                CHECK ANSWER
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

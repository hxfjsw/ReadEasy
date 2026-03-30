import React from 'react';
import { TrophyOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons';

interface PracticeCompleteProps {
  total: number;
  correctCount: number;
  wrongCount: number;
  onRestart: () => void;
  onBack: () => void;
}

export const PracticeComplete: React.FC<PracticeCompleteProps> = ({
  total,
  correctCount,
  wrongCount,
  onRestart,
  onBack,
}) => {
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  // 根据准确率给出评价
  const getEvaluation = () => {
    if (accuracy >= 90) return { text: 'Excellent!', color: 'text-green-500' };
    if (accuracy >= 70) return { text: 'Good Job!', color: 'text-blue-500' };
    if (accuracy >= 50) return { text: 'Keep Trying!', color: 'text-yellow-500' };
    return { text: 'Need More Practice', color: 'text-red-500' };
  };

  const evaluation = getEvaluation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      {/* 奖杯图标 */}
      <div className="mb-8">
        <TrophyOutlined className="text-8xl text-yellow-400" />
      </div>

      {/* 评价文字 */}
      <h2 className={`text-3xl font-bold mb-8 ${evaluation.color}`}>
        {evaluation.text}
      </h2>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-6 mb-12 w-full max-w-lg">
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
          <p className="text-3xl font-bold text-gray-800 mb-1">{total}</p>
          <p className="text-sm text-gray-500">Total Words</p>
        </div>

        <div className="bg-green-50 rounded-2xl p-6 text-center shadow-sm border border-green-100">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircleOutlined className="text-green-500" />
            <p className="text-3xl font-bold text-green-600">{correctCount}</p>
          </div>
          <p className="text-sm text-green-600">Correct</p>
        </div>

        <div className="bg-red-50 rounded-2xl p-6 text-center shadow-sm border border-red-100">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CloseCircleOutlined className="text-red-500" />
            <p className="text-3xl font-bold text-red-600">{wrongCount}</p>
          </div>
          <p className="text-sm text-red-600">Wrong</p>
        </div>
      </div>

      {/* 准确率 */}
      <div className="mb-12 text-center">
        <p className="text-gray-500 mb-2">Accuracy</p>
        <p className="text-5xl font-bold text-gray-800">{accuracy}%</p>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-4">
        <button
          onClick={onRestart}
          className="flex items-center gap-2 px-8 py-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors"
        >
          <ReloadOutlined />
          Practice Again
        </button>

        <button
          onClick={onBack}
          className="flex items-center gap-2 px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
        >
          <HomeOutlined />
          Back to Word Book
        </button>
      </div>
    </div>
  );
};

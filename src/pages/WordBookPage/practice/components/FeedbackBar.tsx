import React from 'react';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';

interface FeedbackBarProps {
  isCorrect: boolean;
  onExplain: () => void;
  onContinue: () => void;
}

export const FeedbackBar: React.FC<FeedbackBarProps> = ({
  isCorrect,
  onExplain,
  onContinue,
}) => {
  return (
    <div className="bg-white border-t border-gray-200">
      {/* 反馈信息栏 */}
      <div
        className={`px-6 py-4 ${
          isCorrect ? 'bg-green-500' : 'bg-red-500'
        }`}
      >
        <div className="flex items-center gap-2 text-white">
          {isCorrect ? (
            <>
              <CheckCircleFilled className="text-xl" />
              <span className="text-lg font-semibold">Correct!</span>
            </>
          ) : (
            <>
              <CloseCircleFilled className="text-xl" />
              <span className="text-lg font-semibold">Wrong!</span>
            </>
          )}
        </div>
      </div>

      {/* 操作按钮栏 */}
      <div className="px-6 py-4 flex items-center gap-4">
        <button
          onClick={onExplain}
          className="px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          EXPLAIN / EDIT
        </button>

        <button
          onClick={onContinue}
          className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
};

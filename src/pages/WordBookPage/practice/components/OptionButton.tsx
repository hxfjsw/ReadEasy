import React from 'react';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

interface OptionButtonProps {
  optionKey: string;
  text: string;
  isSelected: boolean;
  isCorrect: boolean;
  showResult: boolean;
  onClick: () => void;
}

export const OptionButton: React.FC<OptionButtonProps> = ({
  optionKey,
  text,
  isSelected,
  isCorrect,
  showResult,
  onClick,
}) => {
  // 确定按钮样式
  let buttonClass = 'relative w-full py-4 px-6 rounded-xl border-2 text-left transition-all duration-200 ';
  
  if (showResult) {
    if (isCorrect) {
      // 正确答案 - 绿色
      buttonClass += 'bg-green-50 border-green-500 text-green-700';
    } else if (isSelected && !isCorrect) {
      // 选错的答案 - 红色
      buttonClass += 'bg-red-50 border-red-500 text-red-700';
    } else {
      // 其他未选中的答案
      buttonClass += 'bg-gray-50 border-gray-200 text-gray-400';
    }
  } else {
    // 答题中状态
    if (isSelected) {
      buttonClass += 'bg-green-50 border-green-500 text-green-700';
    } else {
      buttonClass += 'bg-white border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50/30';
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={showResult}
      className={buttonClass}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-sm font-medium text-gray-400 flex-shrink-0">[{optionKey}]</span>
        <span className="text-base truncate" title={text}>{text}</span>
      </div>

      {/* 结果显示图标 */}
      {showResult && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 flex-shrink-0">
          {isCorrect ? (
            <CheckOutlined className="text-green-500 text-lg" />
          ) : isSelected ? (
            <CloseOutlined className="text-red-500 text-lg" />
          ) : null}
        </span>
      )}
    </button>
  );
};

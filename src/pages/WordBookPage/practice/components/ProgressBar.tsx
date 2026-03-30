import React from 'react';
import { CloseOutlined, MoreOutlined } from '@ant-design/icons';

interface ProgressBarProps {
  current: number;
  total: number;
  onClose: () => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  onClose,
}) => {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200">
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <CloseOutlined className="text-lg" />
      </button>

      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button className="text-gray-400 hover:text-gray-600 transition-colors">
        <MoreOutlined className="text-lg" />
      </button>
    </div>
  );
};

import React, { useState } from 'react';
import { Button, Dropdown } from 'antd';
import { PlayCircleOutlined, DownOutlined, TrophyOutlined } from '@ant-design/icons';
import { PracticePage } from '../practice/PracticePage';

interface PracticeButtonProps {
  wordBookId: number;
  wordBookName: string;
  wordCount: number;
  disabled?: boolean;
}

type PracticeFilter = 'all' | 'new' | 'review' | 'wrong';

interface PracticeOption {
  key: PracticeFilter;
  label: string;
  description: string;
}

const PRACTICE_OPTIONS: PracticeOption[] = [
  { key: 'all', label: 'Practice All', description: 'Practice all words in the book' },
  { key: 'new', label: 'New Words Only', description: 'Focus on words you haven\'t practiced' },
  { key: 'review', label: 'Review Mode', description: 'Practice words you\'re learning' },
  { key: 'wrong', label: 'Wrong Words', description: 'Focus on words you got wrong' },
];

export const PracticeButton: React.FC<PracticeButtonProps> = ({
  wordBookId,
  wordBookName,
  wordCount,
  disabled = false,
}) => {
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<PracticeFilter>('all');

  const handleStartPractice = (filter: PracticeFilter) => {
    setSelectedFilter(filter);
    setIsPracticeOpen(true);
  };

  const handleClosePractice = () => {
    setIsPracticeOpen(false);
  };

  // 下拉菜单项
  const dropdownItems = PRACTICE_OPTIONS.map(option => ({
    key: option.key,
    label: (
      <div className="py-1">
        <div className="font-medium">{option.label}</div>
        <div className="text-xs text-gray-500">{option.description}</div>
      </div>
    ),
    onClick: () => handleStartPractice(option.key),
  }));

  return (
    <>
      <Dropdown
        menu={{ items: dropdownItems }}
        placement="bottomRight"
        disabled={disabled || wordCount === 0}
      >
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          disabled={disabled || wordCount === 0}
          className="flex items-center"
        >
          <span>Practice</span>
          <DownOutlined className="ml-1 text-xs" />
        </Button>
      </Dropdown>

      {/* 练习页面 */}
      {isPracticeOpen && (
        <PracticePage
          wordBookId={wordBookId}
          wordBookName={wordBookName}
          mode="context"
          count={Math.min(20, wordCount)}
          filter={selectedFilter}
          onClose={handleClosePractice}
          onComplete={handleClosePractice}
        />
      )}
    </>
  );
};

// 练习统计卡片组件
interface PracticeStatsCardProps {
  totalPracticed: number;
  accuracy: number;
  todayWords: number;
}

export const PracticeStatsCard: React.FC<PracticeStatsCardProps> = ({
  totalPracticed,
  accuracy,
  todayWords,
}) => {
  return (
    <div className="flex items-center gap-6 bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-xl border border-green-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
          <TrophyOutlined className="text-white text-lg" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Practiced</p>
          <p className="text-lg font-bold text-gray-800">{totalPracticed}</p>
        </div>
      </div>

      <div className="h-8 w-px bg-gray-200" />

      <div>
        <p className="text-xs text-gray-500">Accuracy</p>
        <p className="text-lg font-bold text-gray-800">{accuracy}%</p>
      </div>

      <div className="h-8 w-px bg-gray-200" />

      <div>
        <p className="text-xs text-gray-500">Today</p>
        <p className="text-lg font-bold text-gray-800">{todayWords}</p>
      </div>
    </div>
  );
};

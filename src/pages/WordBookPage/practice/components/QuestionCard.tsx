import React from 'react';
import { SoundOutlined } from '@ant-design/icons';
import { PracticeQuestion } from '../../../../types/practice';
import { OptionButton } from './OptionButton';

interface QuestionCardProps {
  question: PracticeQuestion;
  selectedAnswer?: string;
  showResult: boolean;
  onSelect: (key: string) => void;
  onPlayAudio: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedAnswer,
  showResult,
  onSelect,
  onPlayAudio,
}) => {
  // 高亮例句中的目标单词
  const renderSentence = () => {
    if (!question.sentence) {
      return (
        <p className="text-lg text-gray-700 leading-relaxed">
          Example sentence with the word &quot;{question.highlightWord}&quot;.
        </p>
      );
    }

    // 使用正则表达式高亮单词（忽略大小写）
    const regex = new RegExp(`\\b(${question.highlightWord})\\b`, 'gi');
    const parts = question.sentence.split(regex);

    return (
      <p className="text-lg text-gray-700 leading-relaxed">
        {parts.map((part, index) => {
          const isHighlight = part.toLowerCase() === question.highlightWord.toLowerCase();
          if (isHighlight) {
            return (
              <span key={index} className="font-bold text-gray-900">
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </p>
    );
  };

  return (
    <div className="flex-1 flex flex-col px-8 py-6">
      {/* 问题标题 */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {question.questionText}
      </h2>

      {/* 例句 */}
      <div className="mb-8">
        <div className="flex items-start gap-2">
          <button
            onClick={onPlayAudio}
            className="mt-1 text-blue-500 hover:text-blue-600 transition-colors flex-shrink-0"
          >
            <SoundOutlined className="text-lg" />
          </button>
          {renderSentence()}
        </div>
      </div>

      {/* 选项列表 */}
      <div className="grid grid-cols-2 gap-4">
        {question.options.map((option) => (
          <OptionButton
            key={option.key}
            optionKey={option.key}
            text={option.text}
            isSelected={selectedAnswer === option.key}
            isCorrect={option.isCorrect || false}
            showResult={showResult}
            onClick={() => onSelect(option.key)}
          />
        ))}
      </div>
    </div>
  );
};

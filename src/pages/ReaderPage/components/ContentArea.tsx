import React from 'react';
import { Spin, Empty, Progress, Button, Tooltip } from 'antd';
import { UploadOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { LoadingState } from '../../../types/reader';

interface ContentAreaProps {
  loadingState: LoadingState;
  fileContent: string;
  theme: 'light' | 'dark' | 'sepia';
  themeStyles: { bg: string; text: string; container: string };
  fontSize: number;
  lineHeight: number;
  currentPage: number;
  totalPages: number;
  contentRef: React.RefObject<HTMLDivElement>;
  vocabularyLevel: string;
  knownWords: Set<string>;
  vocabularyAnalysis: Map<string, string>;
  onMouseUp: () => void;
  onFileSelect: () => void;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  onWordClick: (word: string, context: string) => void;
}

export const ContentArea: React.FC<ContentAreaProps> = ({
  loadingState,
  fileContent,
  theme,
  themeStyles,
  fontSize,
  lineHeight,
  currentPage,
  totalPages,
  contentRef,
  vocabularyLevel,
  knownWords,
  vocabularyAnalysis,
  onMouseUp,
  onFileSelect,
  goToPreviousPage,
  goToNextPage,
  onWordClick,
}) => {
  if (loadingState.isLoading) {
    return (
      <div className={`flex-1 overflow-hidden ${themeStyles.bg} relative`}>
        <div className="flex flex-col items-center justify-center h-full space-y-6">
          <Spin size="large" />
          <div className="text-center space-y-3 w-80">
            <p className="text-lg font-medium text-gray-700">{loadingState.message}</p>
            <Progress percent={loadingState.progress} status="active" />
          </div>
        </div>
      </div>
    );
  }

  if (!fileContent) {
    return (
      <div className={`flex-1 overflow-hidden ${themeStyles.bg} relative`}>
        <Empty description="请选择或拖拽文件到此处" className="mt-20">
          <Button type="primary" onClick={onFileSelect} icon={<UploadOutlined />}>选择文件</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div ref={contentRef} className={`flex-1 overflow-hidden ${themeStyles.bg} relative`} onMouseUp={onMouseUp}>
        <div className="flex flex-col h-full">
          <div className={`flex-1 reader-content p-8 max-w-4xl mx-auto ${themeStyles.container} shadow-sm overflow-hidden`} style={{ fontSize: `${fontSize}px`, lineHeight }}>
            <div className={`${themeStyles.text} whitespace-pre-wrap`}>
              <RenderContent 
                text={fileContent}
                vocabularyLevel={vocabularyLevel}
                knownWords={knownWords}
                vocabularyAnalysis={vocabularyAnalysis}
                onWordClick={onWordClick}
              />
            </div>
          </div>
          
          {totalPages > 1 && (
            <div className={`h-14 border-t flex items-center justify-center gap-4 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <Button icon={<LeftOutlined />} onClick={goToPreviousPage} disabled={currentPage === 0}>上一页</Button>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>第 {currentPage + 1} / {totalPages} 页</span>
              <Button icon={<RightOutlined />} onClick={goToNextPage} disabled={currentPage === totalPages - 1}>下一页</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const levelOrder = ['elementary', 'middle', 'high', 'cet4', 'cet6', 'postgraduate', 'ielts', 'toefl', 'gre', 'tem8'];
const levelColors: Record<string, string> = {
  elementary: '#52c41a', middle: '#13c2c2', high: '#1890ff', cet4: '#2f54eb',
  cet6: '#722ed1', postgraduate: '#eb2f96', ielts: '#fa8c16', toefl: '#faad14',
  gre: '#f5222d', tem8: '#cf1322',
};

interface RenderContentProps {
  text: string;
  vocabularyLevel: string;
  knownWords: Set<string>;
  vocabularyAnalysis: Map<string, string>;
  onWordClick: (word: string, context: string) => void;
}

const RenderContent: React.FC<RenderContentProps> = React.memo(({ 
  text, 
  vocabularyLevel, 
  knownWords, 
  vocabularyAnalysis, 
  onWordClick 
}) => {
  // 按行分割，处理 Markdown 标题
  const lines = text.split('\n');
  
  return (
    <>
      {lines.map((line, lineIndex) => {
        // 检测 Markdown 标题 (# 开头)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = headingMatch[2];
          const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
          return (
            <HeadingTag key={`h-${lineIndex}`} className="text-2xl font-bold my-4">
              {headingText}
            </HeadingTag>
          );
        }
        
        // 处理普通行
        const parts = line.split(/(\s+|[.,!?;:"()[\]{}])/);
        return (
          <div key={`line-${lineIndex}`} className="min-h-[1.5em]">
            {parts.map((part, index) => {
              if (!/^[a-zA-Z]+$/.test(part)) return <span key={index}>{part}</span>;
              
              const contextStart = Math.max(0, index - 20);
              const contextEnd = Math.min(parts.length, index + 20);
              const context = parts.slice(contextStart, contextEnd).join('');
              
              const lowerWord = part.toLowerCase();
              const isKnown = knownWords.has(lowerWord);
              const wordLevel = vocabularyAnalysis.get(lowerWord);
              const userLevelIndex = levelOrder.indexOf(vocabularyLevel);
              const wordLevelIndex = wordLevel ? levelOrder.indexOf(wordLevel) : -1;
              const isUnknown = !isKnown && wordLevel && wordLevelIndex > userLevelIndex;
              const levelColor = wordLevel ? levelColors[wordLevel] : '';
              
              return (
                <Tooltip key={index} title={part}>
                  <span
                    className={`cursor-pointer hover:bg-yellow-200 hover:text-blue-600 transition-colors rounded px-0.5 ${isUnknown ? 'border-b-2 border-red-400 bg-red-50' : ''}`}
                    style={levelColor ? { borderBottom: `2px solid ${levelColor}` } : {}}
                    onClick={() => onWordClick(part.toLowerCase(), context)}
                  >
                    {part}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        );
      })}
    </>
  );
});

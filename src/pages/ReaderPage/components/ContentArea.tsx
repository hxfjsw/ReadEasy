import React, { useEffect } from 'react';
import { Spin, Empty, Progress, Button, Tooltip } from 'antd';
import { UploadOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { LoadingState } from '../../../types/reader';
import { HighlightedSentence } from '../../../hooks/useReaderAudio';

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
  highlightedSentence: HighlightedSentence | null;
  similarityThreshold: number;
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
  highlightedSentence,
  similarityThreshold,
  onMouseUp,
  onFileSelect,
  goToPreviousPage,
  goToNextPage,
  onWordClick,
}) => {
  // 页面切换时滚动到顶部
  useEffect(() => {
    const scrollableContent = contentRef.current?.querySelector('.reader-content');
    if (scrollableContent) {
      scrollableContent.scrollTop = 0;
    }
  }, [currentPage, contentRef]);

  if (loadingState.isLoading) {
    return (
      <div className={`flex-1 overflow-auto ${themeStyles.bg} relative`}>
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
      <div className={`flex-1 overflow-auto ${themeStyles.bg} relative`}>
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
          <div className={`flex-1 reader-content p-8 max-w-4xl mx-auto ${themeStyles.container} shadow-sm overflow-auto`} style={{ fontSize: `${fontSize}px`, lineHeight }}>
            <div className={`${themeStyles.text} whitespace-pre-wrap`}>
              <RenderContent 
                text={fileContent}
                vocabularyLevel={vocabularyLevel}
                knownWords={knownWords}
                vocabularyAnalysis={vocabularyAnalysis}
                highlightedSentence={highlightedSentence}
                similarityThreshold={similarityThreshold}
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
  highlightedSentence: HighlightedSentence | null;
  similarityThreshold: number;
  onWordClick: (word: string, context: string) => void;
}

// 计算字符串相似度（用于高亮句子匹配）
const calculateSimilarity = (str1: string, str2: string): number => {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '').trim();
  
  if (s1 === s2) return 1;
  
  const len = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return (len - distance) / len;
};

const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

const RenderContent: React.FC<RenderContentProps> = React.memo(({ 
  text, 
  vocabularyLevel, 
  knownWords, 
  vocabularyAnalysis, 
  highlightedSentence,
  similarityThreshold,
  onWordClick 
}) => {
  // 将文本分割成段落/句子
  const sentences = text.split(/([.!?。！？]+\s*)/).filter(s => s.length > 0);
  
  // 重组句子（将标点符号和句子内容结合）
  const combinedSentences: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    const punctuation = sentences[i + 1] || '';
    if (sentence.trim()) {
      combinedSentences.push(sentence + punctuation);
    }
  }
  
  // 如果没有标点符号分割，直接按段落分割
  if (combinedSentences.length === 0) {
    combinedSentences.push(...text.split('\n').filter(s => s.trim().length > 0));
  }
  
  let sentenceIndex = 0;
  
  return (
    <>
      {text.split('\n').map((line, lineIndex) => {
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
        
        // 处理普通行，按句子分割并检查高亮
        const lineSentences = line.split(/([.!?]+\s*)/).filter(s => s.length > 0);
        const elements: React.ReactNode[] = [];
        let currentSentence = '';
        
        for (let i = 0; i < lineSentences.length; i++) {
          const part = lineSentences[i];
          
          // 如果是标点，附加到当前句子
          if (/^[.!?]+\s*$/.test(part)) {
            currentSentence += part;
            
            // 检查是否需要高亮
            const shouldHighlight = highlightedSentence !== null && 
              calculateSimilarity(currentSentence, highlightedSentence.text) >= similarityThreshold;
            
            elements.push(
              <SentenceSpan 
                key={`sent-${sentenceIndex++}`}
                sentence={currentSentence}
                vocabularyLevel={vocabularyLevel}
                knownWords={knownWords}
                vocabularyAnalysis={vocabularyAnalysis}
                onWordClick={onWordClick}
                isHighlighted={shouldHighlight}
              />
            );
            currentSentence = '';
          } else {
            // 如果有累积的句子先处理
            if (currentSentence) {
              const shouldHighlight = highlightedSentence !== null && 
                calculateSimilarity(currentSentence, highlightedSentence.text) >= 0.8;
              
              elements.push(
                <SentenceSpan 
                  key={`sent-${sentenceIndex++}`}
                  sentence={currentSentence}
                  vocabularyLevel={vocabularyLevel}
                  knownWords={knownWords}
                  vocabularyAnalysis={vocabularyAnalysis}
                  onWordClick={onWordClick}
                  isHighlighted={shouldHighlight}
                />
              );
            }
            currentSentence = part;
          }
        }
        
        // 处理最后剩余的文本
        if (currentSentence.trim()) {
          const shouldHighlight = highlightedSentence !== null && 
            calculateSimilarity(currentSentence, highlightedSentence.text) >= 0.8;
          
          elements.push(
            <SentenceSpan 
              key={`sent-${sentenceIndex++}`}
              sentence={currentSentence}
              vocabularyLevel={vocabularyLevel}
              knownWords={knownWords}
              vocabularyAnalysis={vocabularyAnalysis}
              onWordClick={onWordClick}
              isHighlighted={shouldHighlight}
            />
          );
        }
        
        return (
          <p key={`line-${lineIndex}`} className="my-0 leading-relaxed">
            {elements}
          </p>
        );
      })}
    </>
  );
});

// 句子组件（支持高亮）
interface SentenceSpanProps {
  sentence: string;
  vocabularyLevel: string;
  knownWords: Set<string>;
  vocabularyAnalysis: Map<string, string>;
  onWordClick: (word: string, context: string) => void;
  isHighlighted: boolean;
}

const SentenceSpan: React.FC<SentenceSpanProps> = ({
  sentence,
  vocabularyLevel,
  knownWords,
  vocabularyAnalysis,
  onWordClick,
  isHighlighted,
}) => {
  // 将句子分割成单词和非单词
  const parts = sentence.split(/(\s+|[.,!?;:"()[\]{}])/);
  
  return (
    <span 
      className={`transition-colors duration-500 rounded px-1 ${
        isHighlighted 
          ? 'bg-yellow-300 text-black font-medium shadow-sm' 
          : ''
      }`}
    >
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
    </span>
  );
};

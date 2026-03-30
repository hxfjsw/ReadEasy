import { useState, useRef, useCallback } from 'react';
import { message } from 'antd';

// 当前朗读的单词信息
export interface CurrentWord {
  word: string;
  charIndex: number;
  charLength: number;
}

export function useReaderTTS() {
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<CurrentWord | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const currentTextRef = useRef<string>('');

  // 开始/继续全文朗读
  const startReadingAloud = useCallback((fileContent: string) => {
    if (!('speechSynthesis' in window)) {
      message.warning('您的浏览器不支持语音朗读');
      return;
    }

    if (isPaused && utteranceRef.current) {
      // 继续播放
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    // 开始新的朗读
    const sentences = fileContent.match(/[^.!?]+[.!?]+/g) || [fileContent];
    setSentences(sentences);
    setIsReadingAloud(true);
    setIsPaused(false);
    setCurrentSentenceIndex(0);

    readSentence(0, sentences);
  }, [isPaused]);

  // 从字符位置提取当前单词
  const extractWordAtPosition = useCallback((text: string, charIndex: number): CurrentWord | null => {
    // 找到单词的开始位置
    let start = charIndex;
    while (start > 0 && /[a-zA-Z']/.test(text[start - 1])) {
      start--;
    }
    
    // 找到单词的结束位置
    let end = charIndex;
    while (end < text.length && /[a-zA-Z']/.test(text[end])) {
      end++;
    }
    
    if (start < end) {
      const word = text.substring(start, end).toLowerCase();
      return {
        word,
        charIndex: start,
        charLength: end - start,
      };
    }
    
    return null;
  }, []);

  // 朗读单个句子
  const readSentence = useCallback((index: number, sentences: string[]) => {
    if (index >= sentences.length) {
      setIsReadingAloud(false);
      setCurrentSentenceIndex(-1);
      setCurrentWord(null);
      return;
    }

    setCurrentSentenceIndex(index);
    const currentSentence = sentences[index];
    currentTextRef.current = currentSentence;

    const utterance = new SpeechSynthesisUtterance(currentSentence);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    
    // 监听单词边界事件（逐词高亮）
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const wordInfo = extractWordAtPosition(currentSentence, event.charIndex);
        if (wordInfo) {
          setCurrentWord(wordInfo);
          console.log('[TTS] 当前朗读单词:', wordInfo.word);
        }
      }
    };
    
    utterance.onend = () => {
      setCurrentWord(null);
      readSentence(index + 1, sentences);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsReadingAloud(false);
      setCurrentWord(null);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [extractWordAtPosition]);

  // 暂停朗读
  const pauseReadingAloud = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  // 停止朗读
  const stopReadingAloud = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsReadingAloud(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
    setCurrentWord(null);
    setSentences([]);
    utteranceRef.current = null;
    currentTextRef.current = '';
  }, []);

  // 播放单词发音
  const playPronunciation = useCallback((word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
      message.warning('您的浏览器不支持语音播放');
    }
  }, []);

  return {
    isReadingAloud,
    isPaused,
    currentSentenceIndex,
    sentences,
    currentWord,
    highlightRef,
    startReadingAloud,
    pauseReadingAloud,
    stopReadingAloud,
    playPronunciation,
  };
}

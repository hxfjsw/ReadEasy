import { useState, useRef, useCallback } from 'react';
import { message } from 'antd';

export function useReaderTTS() {
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const [sentences, setSentences] = useState<string[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);

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

  // 朗读单个句子
  const readSentence = useCallback((index: number, sentences: string[]) => {
    if (index >= sentences.length) {
      setIsReadingAloud(false);
      setCurrentSentenceIndex(-1);
      return;
    }

    setCurrentSentenceIndex(index);

    const utterance = new SpeechSynthesisUtterance(sentences[index]);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    
    utterance.onend = () => {
      readSentence(index + 1, sentences);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsReadingAloud(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

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
    setSentences([]);
    utteranceRef.current = null;
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
    highlightRef,
    startReadingAloud,
    pauseReadingAloud,
    stopReadingAloud,
    playPronunciation,
  };
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useWhisper } from './useWhisper';

// 高亮句子信息
export interface HighlightedSentence {
  text: string;
  similarity: number;
  startTime: number;
  endTime: number;
}

export function useReaderAudio(segmentDuration: number = 5, similarityThreshold: number = 0.5) {
  const [audioFile, setAudioFile] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [highlightedSentence, setHighlightedSentence] = useState<HighlightedSentence | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscribedSegmentRef = useRef<number>(-1);
  const contentTextRef = useRef<string>('');
  
  const whisper = useWhisper();

  // 选择音频文件
  const handleSelectAudio = useCallback(async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('file:open', {
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'aac'] },
          { name: 'MP3', extensions: ['mp3'] },
          { name: 'All Files', extensions: ['*'] },
        ]
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        if (!path.toLowerCase().endsWith('.mp3')) {
          message.error('请选择 MP3 格式的音频文件');
          return;
        }
        setAudioFile(path);
        
        // 创建音频对象
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        
        const audio = new Audio(`file://${path}`);
        audio.addEventListener('loadedmetadata', () => {
          setAudioDuration(audio.duration);
        });
        audio.addEventListener('ended', () => {
          setIsPlayingAudio(false);
          if (audioProgressIntervalRef.current) {
            clearInterval(audioProgressIntervalRef.current);
          }
        });
        audio.addEventListener('error', (e) => {
          console.error('音频加载失败:', e);
          message.error('音频文件加载失败');
          setAudioFile('');
        });
        
        audioRef.current = audio;
        
        // 初始化音频分段（用于识别）
        try {
          const response = await fetch(`file://${path}`);
          const blob = await response.blob();
          const file = new File([blob], path.split('/').pop() || 'audio.mp3', { type: 'audio/mpeg' });
          await whisper.initAudioSegments(file, segmentDuration);
          lastTranscribedSegmentRef.current = -1;
        } catch (e) {
          console.error('初始化音频分段失败:', e);
        }
        
        message.success('有声书已加载');
      }
    } catch (error) {
      console.error('选择音频文件失败:', error);
      message.error('选择音频文件失败');
    }
  }, [whisper]);

  // 播放/暂停音频
  const toggleAudioPlayback = useCallback(() => {
    if (!audioRef.current) {
      message.warning('请先选择音频文件');
      return;
    }

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      if (audioProgressIntervalRef.current) {
        clearInterval(audioProgressIntervalRef.current);
        audioProgressIntervalRef.current = null;
      }
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
        // 启动进度更新
        audioProgressIntervalRef.current = setInterval(() => {
          if (audioRef.current) {
            const currentTime = audioRef.current.currentTime;
            setAudioCurrentTime(currentTime);
            
            // 实时识别：根据设置的分片时长识别
            const currentSegment = Math.floor(currentTime / segmentDuration);
            if (currentSegment !== lastTranscribedSegmentRef.current && currentSegment >= 0) {
              lastTranscribedSegmentRef.current = currentSegment;
              // 触发识别
              handleTranscriptionAtTime(currentTime);
            }
          }
        }, 1000);
      }).catch((error) => {
        console.error('播放失败:', error);
        message.error('音频播放失败');
      });
    }
  }, [isPlayingAudio]);

  // 处理指定时间的识别和高亮
  const handleTranscriptionAtTime = useCallback(async (currentTime: number) => {
    if (!contentTextRef.current) return;
    
    // 识别当前时间段
    const segment = await whisper.transcribeAtTime(currentTime);
    
    if (segment && segment.text) {
      // 查找匹配的句子
      const match = whisper.findMatchingSentence(segment.text, contentTextRef.current, similarityThreshold);
      
      if (match) {
        console.log(`[Audio] 高亮句子 (相似度 ${(match.similarity * 100).toFixed(1)}%):`, match.sentence);
        setHighlightedSentence({
          text: match.sentence,
          similarity: match.similarity,
          startTime: segment.startTime,
          endTime: segment.endTime,
        });
      } else {
        console.log('[Audio] 未找到匹配的句子，识别文本:', segment.text);
      }
    }
  }, [whisper]);

  // 暂停音频（用于查词或翻译时）
  const pauseAudioForInteraction = useCallback(() => {
    if (audioRef.current && isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      if (audioProgressIntervalRef.current) {
        clearInterval(audioProgressIntervalRef.current);
        audioProgressIntervalRef.current = null;
      }
      return true;
    }
    return false;
  }, [isPlayingAudio]);

  // 处理进度条拖动
  const handleAudioSeek = useCallback((value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setAudioCurrentTime(value);
      lastTranscribedSegmentRef.current = Math.floor(value / segmentDuration);
    }
  }, []);

  // 格式化时间显示
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 关闭音频
  const closeAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioFile('');
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setHighlightedSentence(null);
    lastTranscribedSegmentRef.current = -1;
    contentTextRef.current = '';
    whisper.resetTranscription();
    if (audioProgressIntervalRef.current) {
      clearInterval(audioProgressIntervalRef.current);
      audioProgressIntervalRef.current = null;
    }
  }, [whisper]);

  // 设置当前内容文本（用于句子匹配）
  const setContentText = useCallback((text: string) => {
    contentTextRef.current = text;
  }, []);

  // 使用 Whisper 识别当前音频（手动触发全部识别）
  const transcribeCurrentAudio = useCallback(async () => {
    message.info('请播放音频，系统会自动根据播放位置识别并高亮文本');
  }, []);

  // 清理音频资源
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioProgressIntervalRef.current) {
        clearInterval(audioProgressIntervalRef.current);
      }
    };
  }, []);

  return {
    audioFile,
    isPlayingAudio,
    audioCurrentTime,
    audioDuration,
    highlightedSentence,
    handleSelectAudio,
    toggleAudioPlayback,
    pauseAudioForInteraction,
    handleAudioSeek,
    formatTime,
    closeAudio,
    transcribeCurrentAudio,
    setContentText,
    whisperModelLoaded: whisper.modelLoaded,
    isWhisperLoading: whisper.isModelLoading,
    isTranscribing: whisper.isTranscribing,
  };
}

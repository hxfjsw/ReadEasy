import { useState, useRef, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useWhisper, SubtitleItem } from './useWhisper';

// 高亮句子信息
export interface HighlightedSentence {
  text: string;
  similarity: number;
  startTime: number;
  endTime: number;
}

// 导出 SubtitleItem
export type { SubtitleItem };

export function useReaderAudio(segmentDuration: number = 5, similarityThreshold: number = 0.5) {
  const [audioFile, setAudioFile] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [highlightedSentence, setHighlightedSentence] = useState<HighlightedSentence | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  // 实时字幕生成模式
  const [enableLazyMode, setEnableLazyMode] = useState(false);
  // 字幕高亮开关（默认关闭）
  const [enableHighlight, setEnableHighlight] = useState(false);
  // 当前播放的字幕（用于显示）
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleItem | null>(null);
  // 当前字幕的翻译
  const [subtitleTranslation, setSubtitleTranslation] = useState<string>('');
  const [isTranslatingSubtitle, setIsTranslatingSubtitle] = useState(false);
  // 翻译源（默认使用 Google 翻译）
  const [subtitleTranslateSource, setSubtitleTranslateSource] = useState<'google' | 'ai'>('google');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscribedSegmentRef = useRef<number>(-1);
  const contentTextRef = useRef<string>('');
  const currentSubtitleRef = useRef<SubtitleItem | null>(null);
  
  const whisper = useWhisper(segmentDuration);

  // 选择音频文件
  const handleSelectAudio = useCallback(async (filePath?: string) => {
    try {
      let path = filePath;
      
      // 如果没有提供路径，打开文件选择对话框
      if (!path) {
        const result = await window.electron.ipcRenderer.invoke('file:open', {
          filters: [
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'aac'] },
            { name: 'MP3', extensions: ['mp3'] },
            { name: 'All Files', extensions: ['*'] },
          ]
        });
        if (result.canceled || result.filePaths.length === 0) {
          return;
        }
        path = result.filePaths[0];
      }
      
      if (!path) return;
      
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
          // 清空之前的字幕
          setSubtitles([]);
          currentSubtitleRef.current = null;
        } catch (e) {
          console.error('初始化音频分段失败:', e);
        }
        
        message.success('有声书已加载，请生成字幕');
    } catch (error) {
      console.error('选择音频文件失败:', error);
      message.error('选择音频文件失败');
    }
  }, [whisper]);

  // 翻译字幕 - 使用 ref 存储函数避免闭包问题
  const translateSubtitleRef = useRef(async (text: string) => {
    if (!text?.trim() || text.length < 2) {
      setSubtitleTranslation('');
      return;
    }
    
    setIsTranslatingSubtitle(true);
    
    try {
      console.log('[SubtitleTranslate] 开始翻译:', text.substring(0, 50) + '...');
      const source = subtitleTranslateSource;
      const result = await window.electron.ipcRenderer.invoke(
        source === 'ai' ? 'ai:translate' : 'translate:sentence',
        { text: text.trim(), targetLang: 'zh-CN' }
      );
      
      console.log('[SubtitleTranslate] 翻译结果:', result);
      
      if (result.success) {
        // translate:sentence 返回 { translatedText: string }
        // ai:translate 返回 { translatedText: string } 或字符串
        let translation = '';
        if (typeof result.data === 'string') {
          translation = result.data;
        } else if (result.data?.translatedText) {
          translation = result.data.translatedText;
        }
        console.log('[SubtitleTranslate] 翻译文本:', translation);
        setSubtitleTranslation(translation);
      } else {
        console.error('[SubtitleTranslate] 翻译失败:', result.message);
        setSubtitleTranslation('翻译失败: ' + (result.message || '未知错误'));
      }
    } catch (error) {
      console.error('字幕翻译失败:', error);
      setSubtitleTranslation('翻译失败: ' + (error as Error).message);
    } finally {
      setIsTranslatingSubtitle(false);
    }
  });
  
  // 同步 ref
  useEffect(() => {
    translateSubtitleRef.current = async (text: string) => {
      if (!text?.trim() || text.length < 2) {
        setSubtitleTranslation('');
        return;
      }
      
      setIsTranslatingSubtitle(true);
      
      try {
        console.log('[SubtitleTranslate] 开始翻译:', text.substring(0, 50) + '...');
        const source = subtitleTranslateSource;
        const result = await window.electron.ipcRenderer.invoke(
          source === 'ai' ? 'ai:translate' : 'translate:sentence',
          { text: text.trim(), targetLang: 'zh-CN' }
        );
        
        console.log('[SubtitleTranslate] 翻译结果:', result);
        
        if (result.success) {
          let translation = '';
          if (typeof result.data === 'string') {
            translation = result.data;
          } else if (result.data?.translatedText) {
            translation = result.data.translatedText;
          }
          console.log('[SubtitleTranslate] 翻译文本:', translation);
          setSubtitleTranslation(translation);
        } else {
          console.error('[SubtitleTranslate] 翻译失败:', result.message);
          setSubtitleTranslation('翻译失败: ' + (result.message || '未知错误'));
        }
      } catch (error) {
        console.error('字幕翻译失败:', error);
        setSubtitleTranslation('翻译失败: ' + (error as Error).message);
      } finally {
        setIsTranslatingSubtitle(false);
      }
    };
  }, [subtitleTranslateSource]);

  // 处理字幕匹配和高亮
  const handleSubtitleMatch = useCallback((subtitle: SubtitleItem) => {
    if (!contentTextRef.current || !subtitle.text) return;
    
    console.log(`[Audio] 当前字幕: ${subtitle.text}`);
    
    // 查找匹配的句子
    const match = whisper.findMatchingSentence(subtitle.text, contentTextRef.current, similarityThreshold);
    
    if (match) {
      console.log(`[Audio] 高亮句子 (相似度 ${(match.similarity * 100).toFixed(1)}%):`, match.sentence);
      setHighlightedSentence({
        text: match.sentence,
        similarity: match.similarity,
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
      });
    } else {
      console.log('[Audio] 未找到匹配的句子，字幕文本:', subtitle.text);
    }
  }, [whisper, similarityThreshold]);

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
            
            // 实时字幕生成模式
            if (enableLazyMode) {
              // 使用实时生成
              whisper.getOrTranscribeAtTime(currentTime).then(subtitle => {
                if (subtitle && subtitle.text && subtitle.index !== currentSubtitleRef.current?.index) {
                  currentSubtitleRef.current = subtitle;
                  setCurrentSubtitle(subtitle);
                  // 自动翻译字幕
                  translateSubtitleRef.current(subtitle.text);
                  // 只在启用高亮时才高亮句子
                  if (enableHighlight) {
                    handleSubtitleMatch(subtitle);
                  }
                }
              });
            } else {
              // 查表模式：根据当前时间获取对应字幕（预生成模式）
              const subtitle = whisper.getSubtitleAtTime(currentTime);
              if (subtitle && subtitle.text && subtitle.index !== currentSubtitleRef.current?.index) {
                currentSubtitleRef.current = subtitle;
                setCurrentSubtitle(subtitle);
                // 自动翻译字幕
                translateSubtitleRef.current(subtitle.text);
                // 只在启用高亮时才高亮句子
                if (enableHighlight) {
                  handleSubtitleMatch(subtitle);
                }
              }
            }
          }
        }, 200); // 更频繁的更新以获得更好的同步
      }).catch((error) => {
        console.error('播放失败:', error);
        message.error('音频播放失败');
      });
    }
  }, [isPlayingAudio, whisper, subtitles, enableLazyMode, enableHighlight]);

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

  // 生成字幕
  const generateSubtitles = useCallback(async () => {
    if (!whisper.modelLoaded) {
      message.warning('Whisper 模型未加载，请稍后再试');
      return;
    }
    
    setIsGeneratingSubtitles(true);
    message.info('开始生成字幕，请稍候...');
    
    try {
      const generatedSubtitles = await whisper.generateAllSubtitles(
        (progress, current, total) => {
          setGenerationProgress(progress);
          if (progress % 10 === 0) {
            message.info(`字幕生成进度: ${progress}% (${current}/${total})`);
          }
        }
      );
      
      setSubtitles(generatedSubtitles);
      message.success(`字幕生成完成！共 ${generatedSubtitles.length} 条`);
    } catch (error) {
      console.error('生成字幕失败:', error);
      message.error('生成字幕失败');
    } finally {
      setIsGeneratingSubtitles(false);
    }
  }, [whisper]);

  // 设置当前内容文本（用于句子匹配）
  const setContentText = useCallback((text: string) => {
    contentTextRef.current = text;
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
    setSubtitles([]);
    currentSubtitleRef.current = null;
    lastTranscribedSegmentRef.current = -1;
    contentTextRef.current = '';
    whisper.resetTranscription();
    if (audioProgressIntervalRef.current) {
      clearInterval(audioProgressIntervalRef.current);
      audioProgressIntervalRef.current = null;
    }
  }, [whisper]);

  // 使用 Whisper 识别当前音频（现在由 generateSubtitles 替代）
  const transcribeCurrentAudio = useCallback(async () => {
    // 如果字幕已生成，显示提示，否则引导生成
    if (subtitles.length > 0) {
      message.info(`已生成 ${subtitles.length} 条字幕，可直接播放`);
    } else {
      message.info('请先生成字幕');
    }
  }, [subtitles]);

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
    generateSubtitles,
    subtitles,
    isGeneratingSubtitles,
    generationProgress,
    whisperModelLoaded: whisper.modelLoaded,
    isWhisperLoading: whisper.isModelLoading,
    isTranscribing: whisper.isTranscribing || isGeneratingSubtitles || whisper.isLazyTranscribing,
    // 实时字幕生成模式
    enableLazyMode,
    setEnableLazyMode,
    isLazyTranscribing: whisper.isLazyTranscribing,
    // 字幕高亮开关
    enableHighlight,
    setEnableHighlight,
    // 当前播放的字幕
    currentSubtitle,
    // 字幕翻译
    subtitleTranslation,
    isTranslatingSubtitle,
    subtitleTranslateSource,
    setSubtitleTranslateSource,
  };
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { message } from 'antd';

export function useReaderAudio() {
  const [audioFile, setAudioFile] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        message.success('有声书已加载');
      }
    } catch (error) {
      console.error('选择音频文件失败:', error);
      message.error('选择音频文件失败');
    }
  }, []);

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
            setAudioCurrentTime(audioRef.current.currentTime);
          }
        }, 1000);
      }).catch((error) => {
        console.error('播放失败:', error);
        message.error('音频播放失败');
      });
    }
  }, [isPlayingAudio]);

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
    if (audioProgressIntervalRef.current) {
      clearInterval(audioProgressIntervalRef.current);
      audioProgressIntervalRef.current = null;
    }
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
    handleSelectAudio,
    toggleAudioPlayback,
    pauseAudioForInteraction,
    handleAudioSeek,
    formatTime,
    closeAudio,
  };
}

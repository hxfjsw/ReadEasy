import { useState, useRef, useCallback, useEffect } from 'react';
import { message } from 'antd';
import { pipeline, AutomaticSpeechRecognitionPipeline } from '@xenova/transformers';
import { findMatchByAnchorPoint } from '../utils/anchorMatching';

// 音频分段信息
interface AudioSegment {
  blob: Blob;
  startTime: number;
  endTime: number;
  index: number;
  transcribed: boolean;
  text: string;
}

// 识别结果（带时间段）
export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  index: number;
}

// 字幕条目
export interface SubtitleItem {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  matched?: boolean;
  matchedText?: string;
}

export function useWhisper(segmentDuration: number = 5) {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [transcriptionSegments, setTranscriptionSegments] = useState<TranscriptionSegment[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const whisperPipelineRef = useRef<AutomaticSpeechRecognitionPipeline | null>(null);
  const audioSegmentsRef = useRef<AudioSegment[]>([]);
  const segmentDurationRef = useRef<number>(segmentDuration);

  // 加载 Whisper 模型
  const loadModel = useCallback(async () => {
    if (modelLoaded || isModelLoading) return;
    
    setIsModelLoading(true);
    console.log('[Whisper] 正在加载模型...');
    
    try {
      const transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en'
      );
      
      whisperPipelineRef.current = transcriber;
      setModelLoaded(true);
      console.log('[Whisper] 模型加载完成');
    } catch (error) {
      console.error('[Whisper] 加载模型失败:', error);
      message.error('加载 Whisper 模型失败');
    } finally {
      setIsModelLoading(false);
    }
  }, [modelLoaded, isModelLoading]);

  // 将音频文件切分为指定秒数的段落
  const splitAudioIntoSegments = useCallback(async (audioFile: File): Promise<AudioSegment[]> => {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const segments: AudioSegment[] = [];
    const duration = segmentDurationRef.current; // 使用设置的时长
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const totalDuration = audioBuffer.duration;
    const numSegments = Math.ceil(totalDuration / duration);
    
    for (let i = 0; i < numSegments; i++) {
      const startTime = i * duration;
      const endTime = Math.min((i + 1) * duration, totalDuration);
      const segmentLength = Math.floor((endTime - startTime) * sampleRate);
      const startSample = Math.floor(startTime * sampleRate);
      
      const segmentBuffer = audioContext.createBuffer(numChannels, segmentLength, sampleRate);
      
      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        const segmentChannelData = segmentBuffer.getChannelData(channel);
        
        for (let j = 0; j < segmentLength; j++) {
          segmentChannelData[j] = channelData[startSample + j];
        }
      }
      
      const wavBlob = audioBufferToWavBlob(segmentBuffer);
      
      segments.push({
        blob: wavBlob,
        startTime,
        endTime,
        index: i,
        transcribed: false,
        text: '',
      });
    }
    
    return segments;
  }, []);

  // 将 AudioBuffer 转换为 WAV Blob
  const audioBufferToWavBlob = (audioBuffer: AudioBuffer): Blob => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = audioBuffer.length * numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    const offset = 44;
    const channelData: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }
    
    let index = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + index, intSample, true);
        index += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // 识别单个音频段落
  const transcribeSegment = useCallback(async (segment: AudioSegment): Promise<string> => {
    if (!whisperPipelineRef.current) {
      throw new Error('Whisper 模型未加载');
    }
    
    const blobUrl = URL.createObjectURL(segment.blob);
    
    try {
      const result = await whisperPipelineRef.current(blobUrl, {
        return_timestamps: false,
      });
      
      return (result as { text: string }).text?.trim() || '';
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }, []);

  // 初始化音频分段（不切分，只获取总时长）
  const initAudioSegments = useCallback(async (audioFile: File, newSegmentDuration?: number) => {
    if (!modelLoaded) {
      await loadModel();
    }
    
    // 如果传入了新的分片时长，更新 ref
    if (newSegmentDuration) {
      segmentDurationRef.current = newSegmentDuration;
    }
    
    try {
      const segments = await splitAudioIntoSegments(audioFile);
      audioSegmentsRef.current = segments;
      setTranscriptionSegments([]);
      console.log(`[Whisper] 音频已切分为 ${segments.length} 段（每段 ${segmentDurationRef.current} 秒）`);
      return segments.length;
    } catch (error) {
      console.error('[Whisper] 切分音频失败:', error);
      return 0;
    }
  }, [modelLoaded, loadModel, splitAudioIntoSegments]);

  // 识别指定时间段（根据当前播放时间）
  const transcribeAtTime = useCallback(async (currentTime: number): Promise<TranscriptionSegment | null> => {
    if (!whisperPipelineRef.current || audioSegmentsRef.current.length === 0) {
      return null;
    }
    
    // 找到当前时间对应的段落
    const segment = audioSegmentsRef.current.find(
      s => currentTime >= s.startTime && currentTime < s.endTime
    );
    
    if (!segment || segment.transcribed) {
      return null;
    }
    
    setIsTranscribing(true);
    
    try {
      console.log(`[Whisper] 识别第 ${segment.index + 1} 段 (${formatTime(segment.startTime)}-${formatTime(segment.endTime)})`);
      
      const text = await transcribeSegment(segment);
      
      // 标记为已识别
      segment.transcribed = true;
      segment.text = text;
      
      const result: TranscriptionSegment = {
        text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        index: segment.index,
      };
      
      setTranscriptionSegments(prev => [...prev, result]);
      console.log(`[Whisper] 第 ${segment.index + 1} 段识别结果:`, text);
      
      return result;
    } catch (error) {
      console.error(`[Whisper] 识别第 ${segment.index + 1} 段失败:`, error);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [transcribeSegment]);

  // 根据当前播放时间获取对应的识别文本
  const getTranscriptionAtTime = useCallback((currentTime: number): TranscriptionSegment | null => {
    return transcriptionSegments.find(
      s => currentTime >= s.startTime && currentTime < s.endTime
    ) || null;
  }, [transcriptionSegments]);

  // 在文本中找到与识别结果最匹配的段落（使用锚点定位算法）
  // 找最长连续匹配的单词序列作为锚点，然后向两边扩展
  const findMatchingSentence = useCallback((
    transcription: string, 
    contentText: string, 
    similarityThreshold: number = 0.5
  ): { sentence: string; similarity: number } | null => {
    // 将相似度阈值转换为最小覆盖率
    // 例如：阈值 0.5 表示至少 50% 的单词需要匹配
    const minCoverage = similarityThreshold;
    
    const match = findMatchByAnchorPoint(transcription, contentText, 3, minCoverage);
    
    if (match) {
      console.log(`[Match] 锚点长度: ${match.anchorLength}, 覆盖率: ${(match.coverage * 100).toFixed(1)}%`);
      return { sentence: match.text, similarity: match.coverage };
    }
    
    return null;
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 生成完整字幕（预识别所有段落）
  const generateAllSubtitles = useCallback(async (
    onProgress?: (progress: number, current: number, total: number) => void
  ): Promise<SubtitleItem[]> => {
    if (!whisperPipelineRef.current || audioSegmentsRef.current.length === 0) {
      return [];
    }
    
    setIsGeneratingSubtitles(true);
    setGenerationProgress(0);
    const generatedSubtitles: SubtitleItem[] = [];
    const total = audioSegmentsRef.current.length;
    
    try {
      for (let i = 0; i < total; i++) {
        const segment = audioSegmentsRef.current[i];
        
        // 识别当前段落
        const text = await transcribeSegment(segment);
        
        // 标记为已识别
        segment.transcribed = true;
        segment.text = text;
        
        const subtitle: SubtitleItem = {
          index: i,
          startTime: segment.startTime,
          endTime: segment.endTime,
          text: text,
        };
        
        generatedSubtitles.push(subtitle);
        
        const progress = Math.round(((i + 1) / total) * 100);
        setGenerationProgress(progress);
        onProgress?.(progress, i + 1, total);
        
        console.log(`[Whisper] 字幕 ${i + 1}/${total} (${formatTime(segment.startTime)}-${formatTime(segment.endTime)}): ${text}`);
      }
      
      setSubtitles(generatedSubtitles);
      setTranscriptionSegments(generatedSubtitles.map(s => ({
        text: s.text,
        startTime: s.startTime,
        endTime: s.endTime,
        index: s.index,
      })));
      
      console.log(`[Whisper] 字幕生成完成，共 ${generatedSubtitles.length} 条`);
      return generatedSubtitles;
    } catch (error) {
      console.error('[Whisper] 生成字幕失败:', error);
      return generatedSubtitles;
    } finally {
      setIsGeneratingSubtitles(false);
    }
  }, [transcribeSegment]);

  // 根据时间获取对应字幕
  const getSubtitleAtTime = useCallback((currentTime: number): SubtitleItem | null => {
    return subtitles.find(
      s => currentTime >= s.startTime && currentTime < s.endTime
    ) || null;
  }, [subtitles]);

  // 清理
  const resetTranscription = useCallback(() => {
    audioSegmentsRef.current = [];
    setTranscriptionSegments([]);
    setSubtitles([]);
    setGenerationProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      whisperPipelineRef.current = null;
    };
  }, []);

  return {
    loadModel,
    initAudioSegments,
    transcribeAtTime,
    getTranscriptionAtTime,
    findMatchingSentence,
    generateAllSubtitles,
    getSubtitleAtTime,
    resetTranscription,
    transcriptionSegments,
    subtitles,
    isGeneratingSubtitles,
    generationProgress,
    isModelLoading,
    isTranscribing,
    modelLoaded,
  };
}

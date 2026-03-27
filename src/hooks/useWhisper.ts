import { useState, useRef, useCallback, useEffect } from 'react';
import { message } from 'antd';
import { pipeline, AutomaticSpeechRecognitionPipeline } from '@xenova/transformers';

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

export function useWhisper(segmentDuration: number = 5) {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [transcriptionSegments, setTranscriptionSegments] = useState<TranscriptionSegment[]>([]);
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

  // Levenshtein 距离算法
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

  // 计算字符串相似度（包含子串匹配）
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    if (s1 === s2) return 1;
    
    // 子串匹配：如果一个是另一个的子串，给予高相似度
    if (s1.includes(s2) || s2.includes(s1)) {
      const shorter = s1.length < s2.length ? s1 : s2;
      const longer = s1.length < s2.length ? s2 : s1;
      // 子串占长串的比例，最低0.5，最高1
      return 0.5 + (shorter.length / longer.length) * 0.5;
    }
    
    const len = Math.max(s1.length, s2.length);
    const distance = levenshteinDistance(s1, s2);
    return (len - distance) / len;
  };

  // 在文本中找到与识别结果最匹配的句子
  const findMatchingSentence = useCallback((transcription: string, contentText: string, similarityThreshold: number = 0.5): { sentence: string; similarity: number } | null => {
    // 将内容按句子分割
    const sentences = contentText.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
    
    let bestMatch: { sentence: string; similarity: number } | null = null;
    
    for (const sentence of sentences) {
      const similarity = calculateSimilarity(
        transcription,
        sentence
      );
      
      if (similarity >= similarityThreshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { sentence: sentence.trim(), similarity };
      }
    }
    
    return bestMatch;
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 清理
  const resetTranscription = useCallback(() => {
    audioSegmentsRef.current = [];
    setTranscriptionSegments([]);
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
    resetTranscription,
    transcriptionSegments,
    isModelLoading,
    isTranscribing,
    modelLoaded,
  };
}

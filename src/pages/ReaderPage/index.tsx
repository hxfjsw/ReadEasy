import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useSettingsStore } from '../../stores/settingsStore';

import { useReaderAudio } from '../../hooks/useReaderAudio';
import { useReaderFile } from '../../hooks/useReaderFile';
import { useReaderVocabulary } from '../../hooks/useReaderVocabulary';
import { useReaderSettings } from '../../hooks/useReaderSettings';
import { useReaderTTS } from '../../hooks/useReaderTTS';
import { getThemeStyles } from '../../utils/readerHelpers';
import { ReaderPageProps } from '../../types/reader';
import { Toolbar } from './components/Toolbar';
import { ContentArea } from './components/ContentArea';
import { SentencePopup } from './components/SentencePopup';
import { ChapterDrawer } from './components/ChapterDrawer';
import { SettingsDrawer } from './components/SettingsDrawer';
import { WordPopupSidebar } from './components/WordPopupSidebar';
import { SubtitleModal } from './components/SubtitleModal';

// 导出 HighlightedSentence 类型
export type { HighlightedSentence } from '../../hooks/useReaderAudio';



const ReaderPage: React.FC<ReaderPageProps> = ({ initialFilePath, onClearInitialFile }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const sentencePopupRef = useRef<HTMLDivElement>(null);
  
  const { vocabularyLevel } = useSettingsStore();
  
  const file = useReaderFile();
  const vocab = useReaderVocabulary();
  const settings = useReaderSettings();
  const audio = useReaderAudio(settings.segmentDuration, settings.similarityThreshold);
  const tts = useReaderTTS();

  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false);
  const [subtitleModalOpen, setSubtitleModalOpen] = useState(false);

  
  const [selectedWord, setSelectedWord] = useState('');
  const [selectedContext, setSelectedContext] = useState('');
  const [popupVisible, setPopupVisible] = useState(false);
  
  const [selectedSentence, setSelectedSentence] = useState('');
  const [translatedSentence, setTranslatedSentence] = useState('');
  const [sentencePopupVisible, setSentencePopupVisible] = useState(false);
  const [sentenceTranslating, setSentenceTranslating] = useState(false);
  const [sentenceTranslateSource, setSentenceTranslateSource] = useState<'google' | 'ai'>('ai');

  useEffect(() => {
    if (initialFilePath) {
      file.loadFile(initialFilePath);
      onClearInitialFile?.();
    }
  }, [initialFilePath]);

  // 当文件内容变化时，设置内容文本用于音频句子匹配
  useEffect(() => {
    if (file.fileContent) {
      audio.setContentText(file.fileContent);
    }
  }, [file.fileContent, audio.setContentText]);

  const handleWordClick = useCallback((word: string, context: string) => {
    audio.pauseAudioForInteraction();
    setSelectedWord(word);
    setSelectedContext(context);
    setPopupVisible(true);
  }, [audio]);

  const handleSentenceTranslate = useCallback(async (text: string, source?: 'google' | 'ai') => {
    if (!text?.trim() || text.length < 2) return;
    
    audio.pauseAudioForInteraction();
    
    const useSource = source || sentenceTranslateSource;
    setSelectedSentence(text);
    setSentenceTranslating(true);
    setSentencePopupVisible(true);
    
    try {
      const result = await window.electron.ipcRenderer.invoke(
        useSource === 'ai' ? 'ai:translate' : 'translate:sentence',
        { text: text.trim(), targetLang: 'zh-CN' }
      );
      
      setTranslatedSentence(result.success 
        ? (result.data?.translatedText || result.data || '翻译完成')
        : '翻译失败'
      );
    } catch {
      message.error('翻译失败');
      setTranslatedSentence('翻译失败');
    } finally {
      setSentenceTranslating(false);
    }
  }, [sentenceTranslateSource, audio]);

  const handleMouseUp = useCallback(() => {
    const text = window.getSelection()?.toString().trim();
    if (text && (text.includes(' ') || text.length > 15)) {
      setTimeout(() => handleSentenceTranslate(text), 200);
    }
  }, [handleSentenceTranslate]);

  const themeStyles = getThemeStyles(settings.theme);

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        fileName={file.fileName}
        currentPage={file.currentPage}
        totalPages={file.totalPages}
        chapters={file.chapters}

        audioFile={audio.audioFile}
        isPlayingAudio={audio.isPlayingAudio}
        audioCurrentTime={audio.audioCurrentTime}
        audioDuration={audio.audioDuration}
        theme={settings.theme}
        loadingState={file.loadingState}
        onFileSelect={file.handleFileSelect}
        onChapterClick={() => setChapterDrawerOpen(true)}
        onAudioSelect={audio.handleSelectAudio}
        onAudioToggle={audio.toggleAudioPlayback}
        onAudioSeek={audio.handleAudioSeek}
        onAudioClose={audio.closeAudio}
        onFormatTime={audio.formatTime}
        onSettingsClick={() => settings.setSettingsDrawerOpen(true)}
        onThemeToggle={() => settings.updateTheme(settings.theme === 'dark' ? 'light' : 'dark')}
        onGenerateSubtitles={audio.generateSubtitles}
        onShowSubtitles={() => setSubtitleModalOpen(true)}
        isWhisperLoading={audio.isWhisperLoading}
        isTranscribing={audio.isTranscribing}
        isGeneratingSubtitles={audio.isGeneratingSubtitles}
        generationProgress={audio.generationProgress}
        hasSubtitles={audio.subtitles.length > 0}
        // TTS
        isTTSReading={tts.isReadingAloud}
        isTTSPaused={tts.isPaused}
        onTTSStart={() => file.fileContent && tts.startReadingAloud(file.fileContent)}
        onTTSPause={() => tts.isPaused ? tts.startReadingAloud(file.fileContent || '') : tts.pauseReadingAloud()}
        onTTSStop={tts.stopReadingAloud}
      />

      <div className="flex flex-1 overflow-auto">
        <ContentArea
          loadingState={file.loadingState}
          fileContent={file.fileContent}

          themeStyles={themeStyles}
          fontSize={settings.fontSize}
          lineHeight={settings.lineHeight}
          currentPage={file.currentPage}
          totalPages={file.totalPages}
          contentRef={contentRef}
          vocabularyLevel={vocabularyLevel}
          knownWords={vocab.knownWords}
          vocabularyAnalysis={vocab.vocabularyAnalysis}
          highlightedSentence={audio.highlightedSentence}
          similarityThreshold={settings.similarityThreshold}
          theme={settings.theme}
          onMouseUp={handleMouseUp}
          onFileSelect={file.handleFileSelect}
          goToPreviousPage={file.goToPreviousPage}
          goToNextPage={file.goToNextPage}
          onWordClick={handleWordClick}
        />

        <WordPopupSidebar
          word={selectedWord}
          context={selectedContext}
          visible={popupVisible}
          bookName={file.bookName}
          onClose={() => setPopupVisible(false)}
          onMasteredStatusChange={vocab.updateKnownWords}
        />
      </div>

      {sentencePopupVisible && (
        <SentencePopup
          ref={sentencePopupRef}
          selectedSentence={selectedSentence}
          translatedSentence={translatedSentence}
          sentenceTranslating={sentenceTranslating}
          sentenceTranslateSource={sentenceTranslateSource}
          onClose={() => setSentencePopupVisible(false)}
          onSwitchSource={(s) => {
            setSentenceTranslateSource(s);
            handleSentenceTranslate(selectedSentence, s);
          }}
        />
      )}

      <ChapterDrawer
        open={chapterDrawerOpen}
        chapters={file.chapters}
        currentChapter={file.currentChapter}
        chapterStartPages={file.chapterStartPages}
        totalPages={file.totalPages}
        onClose={() => setChapterDrawerOpen(false)}
        onChapterSelect={file.jumpToChapter}
      />

      <SettingsDrawer
        open={settings.settingsDrawerOpen}
        fontSize={settings.fontSize}
        lineHeight={settings.lineHeight}
        theme={settings.theme}
        segmentDuration={settings.segmentDuration}
        similarityThreshold={settings.similarityThreshold}
        onClose={() => settings.setSettingsDrawerOpen(false)}
        onFontSizeChange={settings.updateFontSize}
        onLineHeightChange={settings.updateLineHeight}
        onThemeChange={settings.updateTheme}
        onSegmentDurationChange={settings.updateSegmentDuration}
        onSimilarityThresholdChange={settings.updateSimilarityThreshold}
      />

      <SubtitleModal
        open={subtitleModalOpen}
        subtitles={audio.subtitles}
        isGenerating={audio.isGeneratingSubtitles}
        progress={audio.generationProgress}
        currentTime={audio.audioCurrentTime}
        onClose={() => setSubtitleModalOpen(false)}
        onGenerate={audio.generateSubtitles}
      />
    </div>
  );
};

export default ReaderPage;

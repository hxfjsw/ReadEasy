import { Button, Tag, Slider, Badge, Progress } from 'antd';
import { UploadOutlined, FileTextOutlined, MenuOutlined, SettingOutlined, MoonOutlined, SunOutlined, PlayCircleOutlined, PauseCircleOutlined, CustomerServiceOutlined, EyeOutlined, FileAddOutlined, SoundOutlined, StopOutlined } from '@ant-design/icons';
import { LoadingState, Chapter } from '../../../types/reader';

interface ToolbarProps {
  fileName: string;
  currentPage: number;
  totalPages: number;
  chapters: Chapter[];
  theme: 'light' | 'dark' | 'sepia';
  audioFile: string;
  isPlayingAudio: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  loadingState: LoadingState;
  onFileSelect: () => void;
  onChapterClick: () => void;
  onAudioSelect: () => void; // 现在打开音频选择 Modal
  onAudioToggle: () => void;
  onAudioSeek: (value: number) => void;
  onAudioClose: () => void;
  onFormatTime: (seconds: number) => string;
  onSettingsClick: () => void;
  onThemeToggle: () => void;
  onGenerateSubtitles?: () => void;
  onShowSubtitles?: () => void;
  isWhisperLoading?: boolean;
  isTranscribing?: boolean;
  isGeneratingSubtitles?: boolean;
  generationProgress?: number;
  hasSubtitles?: boolean;
  // TTS 相关
  isTTSReading?: boolean;
  isTTSPaused?: boolean;
  onTTSStart?: () => void;
  onTTSPause?: () => void;
  onTTSStop?: () => void;
  // 当前书籍路径（用于有声书功能）
  bookPath?: string;
  // 实时字幕生成模式
  enableLazyMode?: boolean;
  onToggleLazyMode?: () => void;
  isLazyTranscribing?: boolean;
  // 字幕高亮开关
  enableHighlight?: boolean;
  onToggleHighlight?: () => void;
  // 当前播放的字幕
  currentSubtitle?: { text: string; startTime: number; endTime: number } | null;
  // 字幕翻译
  subtitleTranslation?: string;
  isTranslatingSubtitle?: boolean;
  subtitleTranslateSource?: 'google' | 'ai';
  onToggleSubtitleTranslateSource?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  fileName,
  currentPage,
  totalPages,
  chapters,
  theme,
  audioFile,
  isPlayingAudio,
  audioCurrentTime,
  audioDuration,

  loadingState,
  onFileSelect,
  onChapterClick,
  onAudioSelect,
  onAudioToggle,
  onAudioSeek,
  onAudioClose,
  onFormatTime,
  onSettingsClick,
  onThemeToggle,
  onGenerateSubtitles,
  onShowSubtitles,
  isWhisperLoading,
  isTranscribing,
  isGeneratingSubtitles,
  generationProgress,
  hasSubtitles,
  // TTS
  isTTSReading = false,
  isTTSPaused = false,
  onTTSStart,
  onTTSPause,
  onTTSStop,
  // 实时字幕生成模式
  enableLazyMode = false,
  onToggleLazyMode,
  isLazyTranscribing = false,
  // 字幕高亮开关
  enableHighlight = false,
  onToggleHighlight,
  // 当前播放的字幕
  currentSubtitle,
  // 字幕翻译
  subtitleTranslation = '',
  isTranslatingSubtitle = false,
  subtitleTranslateSource = 'google',
  onToggleSubtitleTranslateSource,
}) => {
  const bgClass = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const subtitleBgClass = theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800';
  
  return (
    <>
    <div className={`h-14 border-b flex items-center px-4 justify-between ${bgClass}`}>
      <div className="flex items-center gap-2">
        <Button icon={<UploadOutlined />} onClick={onFileSelect} disabled={loadingState.isLoading}>
          打开文件
        </Button>
        {chapters.length > 0 && (
          <Button icon={<MenuOutlined />} onClick={onChapterClick} disabled={loadingState.isLoading}>
            章节
          </Button>
        )}
        {fileName && <Tag icon={<FileTextOutlined />} className="ml-2">{fileName}</Tag>}
      </div>
      
      <div className="flex items-center gap-2">
        {totalPages > 0 && (
          <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            {currentPage + 1} / {totalPages} 页
          </span>
        )}
        
        <TTSControl
          isReading={isTTSReading}
          isPaused={isTTSPaused}
          theme={theme}
          onStart={onTTSStart}
          onPause={onTTSPause}
          onStop={onTTSStop}
        />
        
        <AudioControl
          audioFile={audioFile}
          isPlayingAudio={isPlayingAudio}
          audioCurrentTime={audioCurrentTime}
          audioDuration={audioDuration}
          theme={theme}
          onSelect={onAudioSelect}
          onToggle={onAudioToggle}
          onSeek={onAudioSeek}
          onClose={onAudioClose}
          onFormatTime={onFormatTime}
          onGenerateSubtitles={onGenerateSubtitles}
          onShowSubtitles={onShowSubtitles}
          isWhisperLoading={isWhisperLoading}
          isTranscribing={isTranscribing}
          isGeneratingSubtitles={isGeneratingSubtitles}
          generationProgress={generationProgress}
          hasSubtitles={hasSubtitles}
          enableLazyMode={enableLazyMode}
          onToggleLazyMode={onToggleLazyMode}
          isLazyTranscribing={isLazyTranscribing}
          enableHighlight={enableHighlight}
          onToggleHighlight={onToggleHighlight}
        />
        
        <Button icon={<SettingOutlined />} onClick={onSettingsClick} />
        <Button icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />} onClick={onThemeToggle} />
      </div>
    </div>
    
    {/* 字幕显示行 */}
    {audioFile && currentSubtitle?.text && (
      <>
        <div className={`px-4 py-2 text-sm border-b ${subtitleBgClass}`}>
          <span className="font-medium text-gray-500 mr-2">字幕:</span>
          <span>{currentSubtitle.text}</span>
        </div>
        {/* 字幕翻译行 */}
        <div className={`px-4 py-2 text-sm border-b ${subtitleBgClass} flex items-center justify-between`}>
          <div className="flex-1">
            <span className="font-medium text-gray-500 mr-2">翻译:</span>
            <span className="text-blue-600">
              {isTranslatingSubtitle ? '翻译中...' : (subtitleTranslation || '等待翻译...')}
            </span>
          </div>
          <Button 
            type="link" 
            size="small" 
            onClick={onToggleSubtitleTranslateSource}
            className="text-xs"
          >
            {subtitleTranslateSource === 'google' ? '谷歌翻译' : 'AI 翻译'}
          </Button>
        </div>
      </>
    )}
    </>
  );
};

// TTS 朗读控制组件
const TTSControl: React.FC<{
  isReading: boolean;
  isPaused: boolean;
  theme: 'light' | 'dark' | 'sepia';
  onStart?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}> = ({ 
  isReading, 
  isPaused,
  theme, 
  onStart, 
  onPause, 
  onStop 
}) => {
  // 未开始朗读时显示开始按钮
  if (!isReading) {
    return (
      <Button 
        icon={<SoundOutlined />} 
        size="small" 
        onClick={onStart}
        title="朗读全文"
      >
        朗读
      </Button>
    );
  }
  
  // 正在朗读时显示暂停/继续和停止按钮
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
      <Button 
        type="primary" 
        size="small" 
        icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />} 
        onClick={onPause}
        title={isPaused ? '继续朗读' : '暂停朗读'}
      >
        {isPaused ? '继续' : '暂停'}
      </Button>
      <Button 
        type="text" 
        size="small" 
        danger 
        icon={<StopOutlined />}
        onClick={onStop}
        title="停止朗读"
      >
        停止
      </Button>
    </div>
  );
};

const AudioControl: React.FC<{
  audioFile: string;
  isPlayingAudio: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  theme: 'light' | 'dark' | 'sepia';
  onSelect: () => void;
  onToggle: () => void;
  onSeek: (value: number) => void;
  onClose: () => void;
  onFormatTime: (seconds: number) => string;
  onGenerateSubtitles?: () => void;
  onShowSubtitles?: () => void;
  isWhisperLoading?: boolean;
  isTranscribing?: boolean;
  isGeneratingSubtitles?: boolean;
  generationProgress?: number;
  hasSubtitles?: boolean;
  // 实时字幕生成模式
  enableLazyMode?: boolean;
  onToggleLazyMode?: () => void;
  isLazyTranscribing?: boolean;
  // 字幕高亮开关
  enableHighlight?: boolean;
  onToggleHighlight?: () => void;
}> = ({ 
  audioFile, 
  isPlayingAudio, 
  audioCurrentTime, 
  audioDuration, 
  theme, 
  onSelect, 
  onToggle, 
  onSeek, 
  onClose, 
  onFormatTime, 
  onGenerateSubtitles,
  onShowSubtitles,
  isWhisperLoading, 
  isTranscribing,
  isGeneratingSubtitles,
  generationProgress,
  hasSubtitles,
  enableLazyMode = false,
  onToggleLazyMode,
  isLazyTranscribing = false,
  enableHighlight = false,
  onToggleHighlight,
}) => {
  if (!audioFile) {
    return (
      <Button icon={<CustomerServiceOutlined />} size="small" onClick={onSelect}>有声书</Button>
    );
  }
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
      <Button type="primary" size="small" icon={isPlayingAudio ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={onToggle}>
        {isPlayingAudio ? '暂停' : '播放'}
      </Button>
      <div className="flex items-center gap-2" style={{ width: 200 }}>
        <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{onFormatTime(audioCurrentTime)}</span>
        <Slider min={0} max={audioDuration || 100} value={audioCurrentTime} onChange={onSeek} style={{ flex: 1, margin: '0 8px' }} />
        <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{onFormatTime(audioDuration)}</span>
      </div>
      <Button type="text" size="small" danger onClick={onClose}>关闭</Button>
      
      {/* 语音识别状态指示器 */}
      {isWhisperLoading && (
        <Badge status="processing" text="加载模型" />
      )}
      {isGeneratingSubtitles && (
        <div className="flex items-center gap-2" style={{ width: 120 }}>
          <span className="text-xs text-gray-500">生成字幕</span>
          <Progress percent={generationProgress} size="small" showInfo={false} />
        </div>
      )}
      {isLazyTranscribing && (
        <Badge status="processing" text="实时识别中" />
      )}
      {isTranscribing && !isGeneratingSubtitles && !isLazyTranscribing && (
        <Badge status="success" text="识别中" />
      )}
      
      {/* 实时模式切换按钮 */}
      <Button
        type={enableLazyMode ? "primary" : "default"}
        size="small"
        onClick={onToggleLazyMode}
        title={enableLazyMode ? "实时字幕生成模式：读到哪里生成到哪里" : "预生成模式：先生成全部字幕再播放"}
      >
        {enableLazyMode ? "实时" : "预生成"}
      </Button>
      
      {/* 高亮开关按钮 */}
      <Button
        type={enableHighlight ? "primary" : "default"}
        size="small"
        onClick={onToggleHighlight}
        title={enableHighlight ? "已开启字幕高亮" : "已关闭字幕高亮"}
      >
        {enableHighlight ? "高亮开" : "高亮关"}
      </Button>
      
      {/* 字幕按钮 */}
      {!isWhisperLoading && !isGeneratingSubtitles && !enableLazyMode && audioFile && (
        <>
          {!hasSubtitles ? (
            <Button 
              type="primary"
              size="small"
              icon={<FileAddOutlined />}
              onClick={onGenerateSubtitles}
            >
              生成字幕
            </Button>
          ) : (
            <Button 
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={onShowSubtitles}
            >
              查看字幕
            </Button>
          )}
        </>
      )}
    </div>
  );
};

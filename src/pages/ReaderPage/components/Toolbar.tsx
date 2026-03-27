import { Button, Tag, Slider, Badge } from 'antd';
import { UploadOutlined, FileTextOutlined, MenuOutlined, SettingOutlined, MoonOutlined, SunOutlined, PlayCircleOutlined, PauseCircleOutlined, CustomerServiceOutlined, AudioOutlined } from '@ant-design/icons';
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
  onAudioSelect: () => void;
  onAudioToggle: () => void;
  onAudioSeek: (value: number) => void;
  onAudioClose: () => void;
  onFormatTime: (seconds: number) => string;
  onSettingsClick: () => void;
  onThemeToggle: () => void;
  onTranscribeAudio?: () => void;
  isWhisperLoading?: boolean;
  isTranscribing?: boolean;
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
  onTranscribeAudio,
  isWhisperLoading,
  isTranscribing,
}) => {
  const bgClass = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  
  return (
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
          onTranscribe={onTranscribeAudio}
          isWhisperLoading={isWhisperLoading}
          isTranscribing={isTranscribing}
        />
        
        <Button icon={<SettingOutlined />} onClick={onSettingsClick} />
        <Button icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />} onClick={onThemeToggle} />
      </div>
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
  onTranscribe?: () => void;
  isWhisperLoading?: boolean;
  isTranscribing?: boolean;
}> = ({ audioFile, isPlayingAudio, audioCurrentTime, audioDuration, theme, onSelect, onToggle, onSeek, onClose, onFormatTime, onTranscribe, isWhisperLoading, isTranscribing }) => {
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
      {isTranscribing && (
        <Badge status="success" text="识别中" />
      )}
      {!isWhisperLoading && !isTranscribing && onTranscribe && (
        <Button 
          type="link" 
          size="small"
          icon={<AudioOutlined />}
          onClick={onTranscribe}
          title="预加载语音识别模型"
        >
          预加载模型
        </Button>
      )}
    </div>
  );
};

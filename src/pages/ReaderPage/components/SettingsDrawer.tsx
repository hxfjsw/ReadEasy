import { Drawer, Slider, Select, Divider } from 'antd';

interface SettingsDrawerProps {
  open: boolean;
  fontSize: number;
  lineHeight: number;
  theme: 'light' | 'dark' | 'sepia';
  segmentDuration: number;
  similarityThreshold: number;
  onClose: () => void;
  onFontSizeChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
  onThemeChange: (theme: 'light' | 'dark' | 'sepia') => void;
  onSegmentDurationChange: (value: number) => void;
  onSimilarityThresholdChange: (value: number) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  fontSize,
  lineHeight,
  theme,
  segmentDuration,
  similarityThreshold,
  onClose,
  onFontSizeChange,
  onLineHeightChange,
  onThemeChange,
  onSegmentDurationChange,
  onSimilarityThresholdChange,
}) => {
  return (
    <Drawer title="阅读设置" placement="right" onClose={onClose} open={open} width={300}>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">字体大小: {fontSize}px</label>
          <Slider min={12} max={32} value={fontSize} onChange={onFontSizeChange} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">行间距: {lineHeight}</label>
          <Slider min={1.2} max={2.5} step={0.1} value={lineHeight} onChange={onLineHeightChange} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">主题</label>
          <Select className="w-full" value={theme} onChange={onThemeChange} options={[{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }, { label: '护眼', value: 'sepia' }]} />
        </div>
        
        <Divider />
        
        <div className="text-sm font-medium text-gray-500 mb-2">语音识别设置</div>
        
        <div>
          <label className="block text-sm font-medium mb-2">分片时长: {segmentDuration} 秒</label>
          <Slider min={1} max={15} step={1} value={segmentDuration} onChange={onSegmentDurationChange} />
          <div className="text-xs text-gray-400">音频分段识别的时长，越小识别越频繁</div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">相似度阈值: {Math.round(similarityThreshold * 100)}%</label>
          <Slider min={0.05} max={0.5} step={0.05} value={similarityThreshold} onChange={onSimilarityThresholdChange} />
          <div className="text-xs text-gray-400">匹配文本的最小相似度，越低越容易匹配</div>
        </div>
      </div>
    </Drawer>
  );
};

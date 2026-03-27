import { Drawer, Slider, Select } from 'antd';

interface SettingsDrawerProps {
  open: boolean;
  fontSize: number;
  lineHeight: number;
  theme: 'light' | 'dark' | 'sepia';
  onClose: () => void;
  onFontSizeChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
  onThemeChange: (theme: 'light' | 'dark' | 'sepia') => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  fontSize,
  lineHeight,
  theme,
  onClose,
  onFontSizeChange,
  onLineHeightChange,
  onThemeChange,
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
      </div>
    </Drawer>
  );
};

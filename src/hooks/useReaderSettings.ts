import { useState, useEffect, useCallback } from 'react';

export function useReaderSettings() {
  const [fontSize, setFontSize] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const fontSizeSetting = await window.electron.ipcRenderer.invoke('db:getSetting', 'reader.fontSize');
      const lineHeightSetting = await window.electron.ipcRenderer.invoke('db:getSetting', 'reader.lineHeight');
      const themeSetting = await window.electron.ipcRenderer.invoke('db:getSetting', 'reader.theme');
      
      if (fontSizeSetting) setFontSize(parseInt(fontSizeSetting));
      if (lineHeightSetting) setLineHeight(parseFloat(lineHeightSetting));
      if (themeSetting) setTheme(themeSetting as any);
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  };

  const saveSettings = useCallback(async () => {
    try {
      await window.electron.ipcRenderer.invoke('db:setSetting', 'reader.fontSize', fontSize.toString());
      await window.electron.ipcRenderer.invoke('db:setSetting', 'reader.lineHeight', lineHeight.toString());
      await window.electron.ipcRenderer.invoke('db:setSetting', 'reader.theme', theme);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  }, [fontSize, lineHeight, theme]);

  const updateFontSize = useCallback((size: number) => {
    setFontSize(size);
    window.electron.ipcRenderer.invoke('db:setSetting', 'reader.fontSize', size.toString());
  }, []);

  const updateLineHeight = useCallback((height: number) => {
    setLineHeight(height);
    window.electron.ipcRenderer.invoke('db:setSetting', 'reader.lineHeight', height.toString());
  }, []);

  const updateTheme = useCallback((newTheme: 'light' | 'dark' | 'sepia') => {
    setTheme(newTheme);
    window.electron.ipcRenderer.invoke('db:setSetting', 'reader.theme', newTheme);
  }, []);

  return {
    fontSize,
    lineHeight,
    theme,
    settingsDrawerOpen,
    setSettingsDrawerOpen,
    saveSettings,
    updateFontSize,
    updateLineHeight,
    updateTheme,
  };
}

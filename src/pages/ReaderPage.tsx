import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, message, Tag, Spin, Empty, Drawer, Slider, Select } from 'antd';
import { UploadOutlined, FileTextOutlined, MenuOutlined, SettingOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import WordPopup from '../components/WordPopup';

interface Chapter {
  id: string;
  title: string;
}



const ReaderPage: React.FC = () => {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // EPUB 章节相关
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<number>(0);
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false);
  
  // 阅读设置
  const [fontSize, setFontSize] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  
  // 阅读进度
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 单词弹窗状态
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [popupVisible, setPopupVisible] = useState(false);

  // 加载保存的设置
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

  const saveSettings = async () => {
    try {
      await window.electron.ipcRenderer.invoke('db:setSetting', 'reader.fontSize', fontSize.toString());
      await window.electron.ipcRenderer.invoke('db:setSetting', 'reader.lineHeight', lineHeight.toString());
      await window.electron.ipcRenderer.invoke('db:setSetting', 'reader.theme', theme);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  };

  const handleFileSelect = async () => {
    console.log('[ReaderPage] Opening file dialog...');
    try {
      const result = await window.electron.ipcRenderer.invoke('file:open');
      console.log('[ReaderPage] File dialog result:', result);
      
      if (!result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        console.log('[ReaderPage] Selected file:', path);
        await loadFile(path);
      } else {
        console.log('[ReaderPage] File selection cancelled');
      }
    } catch (error) {
      console.error('[ReaderPage] Failed to select file:', error);
      message.error('选择文件失败');
    }
  };

  const loadFile = async (path: string) => {
    console.log('[ReaderPage] Loading file:', path);
    setLoading(true);
    setFilePath(path);
    try {
      console.log('[ReaderPage] Invoking file:read...');
      const result = await window.electron.ipcRenderer.invoke('file:read', path);
      console.log('[ReaderPage] file:read result:', result);
      
      if (result.success) {
        console.log('[ReaderPage] File loaded successfully, content length:', result.data?.length);
        setFileContent(result.data || '');
        const fileNameFromPath = path.split(/[\\/]/).pop();
        setFileName(fileNameFromPath || '');
        
        // 设置章节信息
        if (result.metadata?.chapters) {
          setChapters(result.metadata.chapters);
          setCurrentChapter(0);
        } else {
          setChapters([]);
        }
        
        // 加载阅读进度
        await loadReadingProgress(path);
        
        message.success('文件加载成功');
      } else {
        console.error('[ReaderPage] Failed to read file:', result.error);
        message.error('读取文件失败: ' + result.error);
      }
    } catch (error) {
      console.error('[ReaderPage] Error loading file:', error);
      message.error('读取文件失败');
    } finally {
      console.log('[ReaderPage] Setting loading to false');
      setLoading(false);
    }
  };

  const loadReadingProgress = async (path: string) => {
    try {
      const record = await window.electron.ipcRenderer.invoke('db:getReadingRecord', path);
      if (record) {
        setReadingProgress(record.progress || 0);
        // 如果有保存的位置，滚动到该位置
        if (record.currentPosition && contentRef.current) {
          const position = parseInt(record.currentPosition);
          setTimeout(() => {
            contentRef.current?.scrollTo(0, position);
          }, 100);
        }
      }
    } catch (error) {
      console.error('加载阅读进度失败:', error);
    }
  };

  const saveReadingProgress = async () => {
    if (!filePath || !fileName) return;
    
    try {
      const scrollPosition = contentRef.current?.scrollTop || 0;
      const scrollHeight = contentRef.current?.scrollHeight || 1;
      const progress = Math.round((scrollPosition / scrollHeight) * 100);
      
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: fileName,
        filePath: filePath,
        format: filePath.split('.').pop() || '',
        progress: progress,
        currentPosition: scrollPosition.toString(),
        lastReadAt: new Date().toISOString(),
      });
      
      setReadingProgress(progress);
    } catch (error) {
      console.error('保存阅读进度失败:', error);
    }
  };

  // 处理滚动，保存阅读进度
  const handleScroll = useCallback(() => {
    saveReadingProgress();
  }, [filePath, fileName]);

  // 处理单词点击
  const handleWordClick = useCallback((word: string, context: string) => {
    console.log('[ReaderPage] Word clicked:', word, 'context:', context);
    setSelectedWord(word);
    setSelectedContext(context);
    setPopupVisible(true);
  }, []);

  // 跳转到指定章节
  const jumpToChapter = (index: number) => {
    setCurrentChapter(index);
    setChapterDrawerOpen(false);
    // 简单实现：按章节比例滚动
    if (contentRef.current && chapters.length > 0) {
      const scrollHeight = contentRef.current.scrollHeight;
      const targetPosition = (index / chapters.length) * scrollHeight;
      contentRef.current.scrollTo(0, targetPosition);
    }
  };

  // 渲染可点击的文本内容
  const renderClickableContent = (text: string) => {
    // 将文本按单词分割，并为每个单词添加点击事件
    const parts = text.split(/(\s+|[.,!?;:"()[\]{}])/);
    
    return parts.map((part, index) => {
      // 检查是否是英文单词
      if (/^[a-zA-Z]+$/.test(part)) {
        // 获取上下文（前后各20个字符）
        const contextStart = Math.max(0, index - 20);
        const contextEnd = Math.min(parts.length, index + 20);
        const context = parts.slice(contextStart, contextEnd).join('');
        
        return (
          <span
            key={index}
            className="cursor-pointer hover:bg-yellow-200 hover:text-blue-600 transition-colors rounded px-0.5"
            onClick={() => handleWordClick(part.toLowerCase(), context)}
            title="点击查看释义"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // 获取主题样式
  const getThemeStyles = () => {
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-gray-900',
          text: 'text-gray-200',
          container: 'bg-gray-800',
        };
      case 'sepia':
        return {
          bg: 'bg-[#f4ecd8]',
          text: 'text-[#5b4636]',
          container: 'bg-[#fdf6e3]',
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          container: 'bg-white',
        };
    }
  };

  const themeStyles = getThemeStyles();

  const renderContent = () => {
    if (!fileContent) {
      return (
        <Empty
          description="请选择或拖拽文件到此处"
          className="mt-20"
        >
          <Button type="primary" onClick={handleFileSelect} icon={<UploadOutlined />}>
            选择文件
          </Button>
        </Empty>
      );
    }

    return (
      <div 
        className={`reader-content p-8 max-w-4xl mx-auto ${themeStyles.container} min-h-full shadow-sm`}
        style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
      >
        <div className={`mb-6 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-2xl font-bold ${themeStyles.text}`}>{fileName}</h2>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            提示：点击英文单词可查看释义并添加到单词本
          </p>
        </div>
        <div className={`${themeStyles.text} whitespace-pre-wrap`}>
          {renderClickableContent(fileContent)}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className={`h-14 border-b flex items-center px-4 justify-between ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <Button 
            icon={<UploadOutlined />} 
            onClick={handleFileSelect}
          >
            打开文件
          </Button>
          {chapters.length > 0 && (
            <Button
              icon={<MenuOutlined />}
              onClick={() => setChapterDrawerOpen(true)}
            >
              章节
            </Button>
          )}
          {fileName && (
            <Tag icon={<FileTextOutlined />} className="ml-2">
              {fileName}
            </Tag>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            进度: {readingProgress}%
          </span>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setSettingsDrawerOpen(true)}
          />
          <Button
            icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={() => {
              const newTheme = theme === 'dark' ? 'light' : 'dark';
              setTheme(newTheme);
              saveSettings();
            }}
          />
        </div>
      </div>

      {/* Content Area */}
      <div 
        ref={contentRef}
        className={`flex-1 overflow-auto ${themeStyles.bg}`}
        onScroll={handleScroll}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spin size="large" tip="加载中..." />
          </div>
        ) : (
          renderContent()
        )}
      </div>

      {/* 章节菜单 Drawer */}
      <Drawer
        title="章节列表"
        placement="left"
        onClose={() => setChapterDrawerOpen(false)}
        open={chapterDrawerOpen}
        width={300}
      >
        <div className="space-y-1">
          {chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              className={`p-3 rounded cursor-pointer transition-colors ${
                currentChapter === index 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => jumpToChapter(index)}
            >
              <div className="text-sm font-medium truncate">
                {index + 1}. {chapter.title}
              </div>
            </div>
          ))}
        </div>
      </Drawer>

      {/* 设置 Drawer */}
      <Drawer
        title="阅读设置"
        placement="right"
        onClose={() => setSettingsDrawerOpen(false)}
        open={settingsDrawerOpen}
        width={300}
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">字体大小: {fontSize}px</label>
            <Slider
              min={12}
              max={32}
              value={fontSize}
              onChange={(value) => {
                setFontSize(value);
                saveSettings();
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">行间距: {lineHeight}</label>
            <Slider
              min={1.2}
              max={2.5}
              step={0.1}
              value={lineHeight}
              onChange={(value) => {
                setLineHeight(value);
                saveSettings();
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">主题</label>
            <Select
              className="w-full"
              value={theme}
              onChange={(value) => {
                setTheme(value);
                saveSettings();
              }}
              options={[
                { label: '浅色', value: 'light' },
                { label: '深色', value: 'dark' },
                { label: '护眼', value: 'sepia' },
              ]}
            />
          </div>
        </div>
      </Drawer>

      {/* 单词弹窗 */}
      <WordPopup
        word={selectedWord}
        context={selectedContext}
        visible={popupVisible}
        onClose={() => setPopupVisible(false)}
      />
    </div>
  );
};

export default ReaderPage;

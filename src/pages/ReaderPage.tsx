import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, message, Tag, Spin, Empty, Drawer, Slider, Select, Tooltip, Progress, Card, Divider } from 'antd';
import { UploadOutlined, FileTextOutlined, MenuOutlined, SettingOutlined, MoonOutlined, SunOutlined, SoundOutlined, TranslationOutlined, CloseOutlined, PlayCircleOutlined, PauseCircleOutlined, StopOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import WordPopup from '../components/WordPopup';
import { useSettingsStore } from '../stores/settingsStore';
import { VocabularyLevel } from '../types';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

interface LoadingState {
  isLoading: boolean;
  stage: 'reading' | 'parsing' | 'rendering' | 'analyzing' | 'complete';
  progress: number;
  message: string;
}

// 词汇等级顺序（从低到高）
const levelOrder = [
  VocabularyLevel.ELEMENTARY,
  VocabularyLevel.MIDDLE,
  VocabularyLevel.HIGH,
  VocabularyLevel.CET4,
  VocabularyLevel.CET6,
  VocabularyLevel.POSTGRADUATE,
  VocabularyLevel.IELTS,
  VocabularyLevel.TOEFL,
  VocabularyLevel.GRE,
  VocabularyLevel.TEM8,
];

interface ReaderPageProps {
  initialFilePath?: string;
  onClearInitialFile?: () => void;
}

const ReaderPage: React.FC<ReaderPageProps> = ({ initialFilePath, onClearInitialFile }) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  
  // 增强的加载状态
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    stage: 'reading',
    progress: 0,
    message: '',
  });
  
  // EPUB 章节相关
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<number>(0);
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false);
  const [chapterStartPages, setChapterStartPages] = useState<number[]>([]); // 每个章节的起始页码
  
  // 阅读设置
  const [fontSize, setFontSize] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  
  // 阅读进度（基于页码）
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 单词弹窗状态
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [popupVisible, setPopupVisible] = useState(false);
  
  // 句子翻译状态
  const [selectedSentence, setSelectedSentence] = useState<string>('');
  const [translatedSentence, setTranslatedSentence] = useState<string>('');
  const [sentencePopupVisible, setSentencePopupVisible] = useState(false);
  const [sentenceTranslating, setSentenceTranslating] = useState(false);
  const [sentenceTranslateSource, setSentenceTranslateSource] = useState<'google' | 'ai'>('google');
  const sentencePopupRef = useRef<HTMLDivElement>(null);
  
  // 全文朗读状态
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const [sentences, setSentences] = useState<string[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  
  // 已掌握单词列表（从用户设置中加载）
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  
  // 从全局设置获取词汇水平
  const { vocabularyLevel, customWords } = useSettingsStore();
  
  // 词汇分析结果缓存
  const [vocabularyAnalysis, setVocabularyAnalysis] = useState<Map<string, string>>(new Map());
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageContents, setPageContents] = useState<string[]>([]);
  const PAGE_SIZE = 3000; // 每页字符数
  
  // 将内容分割成页面
  const splitContentIntoPages = (content: string, pageSize: number): string[] => {
    if (!content || content.length <= pageSize) {
      return [content];
    }
    
    const pages: string[] = [];
    let startIndex = 0;
    
    while (startIndex < content.length) {
      // 尝试在句子结尾处分割（查找句号、问号、感叹号后的空格或换行）
      let endIndex = startIndex + pageSize;
      
      if (endIndex >= content.length) {
        // 剩余内容不足一页，直接添加
        pages.push(content.slice(startIndex));
        break;
      }
      
      // 查找合适的分割点（优先在段落或句子边界）
      let splitIndex = endIndex;
      
      // 先尝试找段落边界（两个换行符）
      const paragraphMatch = content.slice(startIndex, endIndex + 200).match(/\n\s*\n/);
      if (paragraphMatch && paragraphMatch.index) {
        const paragraphEnd = startIndex + paragraphMatch.index + paragraphMatch[0].length;
        if (paragraphEnd > startIndex + pageSize * 0.7 && paragraphEnd <= endIndex + 200) {
          splitIndex = paragraphEnd;
        }
      }
      
      // 如果没有找到段落边界，尝试在句子边界分割
      if (splitIndex === endIndex) {
        const sentenceMatch = content.slice(startIndex, endIndex + 100).match(/[.!?。！？]\s+/);
        if (sentenceMatch && sentenceMatch.index) {
          const sentenceEnd = startIndex + sentenceMatch.index + sentenceMatch[0].length;
          if (sentenceEnd > startIndex + pageSize * 0.7 && sentenceEnd <= endIndex + 100) {
            splitIndex = sentenceEnd;
          }
        }
      }
      
      pages.push(content.slice(startIndex, splitIndex));
      startIndex = splitIndex;
    }
    
    return pages;
  };
  
  // 根据当前页码更新当前章节
  const updateCurrentChapterByPage = (pageNum: number) => {
    for (let i = chapterStartPages.length - 1; i >= 0; i--) {
      if (pageNum >= chapterStartPages[i]) {
        setCurrentChapter(i);
        break;
      }
    }
  };
  
  // 翻页函数
  const goToPreviousPage = () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setFileContent(pageContents[newPage]);
      // 分析新页面的词汇
      analyzeVocabulary(pageContents[newPage]).catch(console.error);
      // 更新当前章节
      updateCurrentChapterByPage(newPage);
      // 保存进度
      saveReadingProgressForPage(newPage);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setFileContent(pageContents[newPage]);
      // 分析新页面的词汇
      analyzeVocabulary(pageContents[newPage]).catch(console.error);
      // 更新当前章节
      updateCurrentChapterByPage(newPage);
      // 保存进度
      saveReadingProgressForPage(newPage);
    }
  };
  
  const goToPage = (pageNum: number) => {
    if (pageNum >= 0 && pageNum < totalPages) {
      setCurrentPage(pageNum);
      setFileContent(pageContents[pageNum]);
      analyzeVocabulary(pageContents[pageNum]).catch(console.error);
      // 更新当前章节
      updateCurrentChapterByPage(pageNum);
      // 保存进度
      saveReadingProgressForPage(pageNum);
    }
  };
  
  // 翻页时保存进度（不更新state，避免循环）
  const saveReadingProgressForPage = async (pageNum: number) => {
    if (!filePath || !fileName) return;
    
    try {
      const progress = totalPages > 0 ? Math.round((pageNum / totalPages) * 100) : 0;
      
      await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
        bookName: fileName,
        filePath: filePath,
        format: filePath.split('.').pop() || '',
        progress: progress,
        currentPosition: pageNum.toString(),
        lastReadAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('保存阅读进度失败:', error);
    }
  };

  // 加载保存的设置和已掌握单词
  useEffect(() => {
    loadSettings();
    loadKnownWords();
  }, []);

  // 处理从书架传入的文件路径
  useEffect(() => {
    if (initialFilePath) {
      loadFile(initialFilePath);
      onClearInitialFile?.();
    }
  }, [initialFilePath]);

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

  const loadKnownWords = async () => {
    try {
      // 从熟词本加载已掌握单词
      const masteredWords = await window.electron.ipcRenderer.invoke('db:getMasteredWords');
      if (masteredWords && masteredWords.length > 0) {
        setKnownWords(new Set(masteredWords.map((w: string) => w.toLowerCase())));
        console.log('[ReaderPage] 加载熟词:', masteredWords.length, '个');
      }
    } catch (error) {
      console.error('加载已掌握单词失败:', error);
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
    const fileNameFromPath = path.split(/[\\/]/).pop() || '';
    
    // 开始加载
    setLoadingState({
      isLoading: true,
      stage: 'reading',
      progress: 0,
      message: '正在读取文件...',
    });
    setFilePath(path);
    
    try {
      console.log('[ReaderPage] Invoking file:read...');
      
      // 第一阶段：读取文件
      setLoadingState(prev => ({ ...prev, progress: 10, message: '正在读取文件...' }));
      
      const result = await window.electron.ipcRenderer.invoke('file:read', path);
      console.log('[ReaderPage] file:read result:', result);
      
      if (!result.success) {
        console.error('[ReaderPage] Failed to read file:', result.error);
        message.error('读取文件失败: ' + result.error);
        setLoadingState({ isLoading: false, stage: 'complete', progress: 0, message: '' });
        return;
      }
      
      // 第二阶段：解析内容
      setLoadingState({
        isLoading: true,
        stage: 'parsing',
        progress: 30,
        message: '正在解析内容...',
      });
      
      console.log('[ReaderPage] File loaded successfully, content length:', result.data?.length);
      
      // 第三阶段：处理分页内容
      setLoadingState({
        isLoading: true,
        stage: 'rendering',
        progress: 60,
        message: '正在处理分页...',
      });
      
      // 设置基础信息
      setFileName(fileNameFromPath);
      
      // 处理 EPUB 章节和分页
      let pages: string[] = [];
      let startPages: number[] = [];
      
      if (result.metadata?.chapters && result.metadata.chapters.length > 0) {
        // EPUB 文件：保留章节结构，分别分页
        const epubChapters = result.metadata.chapters.map((c: any) => ({
          id: c.id,
          title: c.title,
          content: c.content || '',
        }));
        
        // 分别对每个章节分页，并记录起始页码
        let currentPageIndex = 0;
        const allPages: string[] = [];
        
        for (const chapter of epubChapters) {
          startPages.push(currentPageIndex);
          const chapterPages = splitContentIntoPages(chapter.content, PAGE_SIZE);
          allPages.push(...chapterPages);
          currentPageIndex += chapterPages.length;
        }
        
        pages = allPages;
        setChapters(epubChapters);
        console.log('[ReaderPage] EPUB 章节分页完成:', epubChapters.length, '章节,', pages.length, '页');
      } else {
        // 单文件：直接分页
        const fullContent = result.data || '';
        pages = splitContentIntoPages(fullContent, PAGE_SIZE);
        setChapters([{
          id: '1',
          title: fileNameFromPath,
          content: fullContent,
        }]);
        startPages = [0];
      }
      
      setChapterStartPages(startPages);
      setPageContents(pages);
      setTotalPages(pages.length);
      setCurrentPage(0);
      setCurrentChapter(0);
      setFileContent(pages[0] || '');
      
      // 显示完成，结束loading状态
      setLoadingState({
        isLoading: false,
        stage: 'complete',
        progress: 100,
        message: '加载完成',
      });
      
      message.success(`文件加载成功，共 ${pages.length} 页`);
      
      // 添加到书架（阅读记录）
      try {
        await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
          bookName: result.metadata?.title || fileNameFromPath,
          filePath: path,
          format: path.split('.').pop() || '',
          progress: 0,
          currentPosition: '0',
          bookmarks: '[]',
          lastReadAt: new Date().toISOString(),
        });
        console.log('[ReaderPage] 已添加到书架');
      } catch (err) {
        console.error('[ReaderPage] 添加到书架失败:', err);
      }
      
      // 后台分析词汇（只分析当前页）
      setTimeout(() => {
        analyzeVocabulary(pages[0] || '').catch(err => {
          console.error('[ReaderPage] 后台词汇分析失败:', err);
        });
      }, 500);
      
      // 加载阅读进度
      loadReadingProgress(path).catch(err => {
        console.error('[ReaderPage] 加载阅读进度失败:', err);
      });
      
    } catch (error) {
      console.error('[ReaderPage] Error loading file:', error);
      message.error('读取文件失败');
      setLoadingState({ isLoading: false, stage: 'complete', progress: 0, message: '' });
    }
  };

  // 分析词汇，识别生词（非阻塞，失败不影响文件显示）
  const analyzeVocabulary = async (text: string) => {
    try {
      // 限制文本长度，避免AI服务处理过大数据
      const maxLength = 5000;
      const truncatedText = text.slice(0, maxLength);
      
      // 添加超时处理，避免一直等待
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('词汇分析超时')), 10000);
      });
      
      const result = await Promise.race([
        window.electron.ipcRenderer.invoke('ai:analyzeVocabulary', { text: truncatedText }),
        timeoutPromise,
      ]) as any;
      
      // 处理不同的返回格式
      let words: { word: string; level: string }[] = [];
      
      if (result?.words && Array.isArray(result.words)) {
        // 直接返回格式: { words: [...], statistics: {...} }
        words = result.words;
      } else if (result?.data?.words && Array.isArray(result.data.words)) {
        // 包装格式: { success: true, data: { words: [...] } }
        words = result.data.words;
      } else if (result?.success === false) {
        // 明确返回失败
        console.warn('词汇分析返回失败:', result.message || '未知错误');
        return;
      }
      
      if (words.length > 0) {
        const analysis = new Map<string, string>();
        words.forEach((item: { word: string; level: string }) => {
          if (item.word && item.level) {
            analysis.set(item.word.toLowerCase(), item.level);
          }
        });
        setVocabularyAnalysis(analysis);
        console.log('[ReaderPage] 词汇分析完成，识别单词数:', words.length);
      } else {
        console.warn('[ReaderPage] 词汇分析未返回有效单词数据');
      }
    } catch (error) {
      console.error('[ReaderPage] 词汇分析失败（非阻塞）:', error);
      // 词汇分析失败不影响文件显示，只是不标记生词
    }
  };

  const loadReadingProgress = async (path: string) => {
    try {
      const record = await window.electron.ipcRenderer.invoke('db:getReadingRecord', path);
      if (record) {
        // 加载保存的页码
        if (record.currentPosition) {
          const savedPage = parseInt(record.currentPosition);
          if (!isNaN(savedPage) && savedPage >= 0) {
            setTimeout(() => {
              goToPage(savedPage);
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('加载阅读进度失败:', error);
    }
  };

  // 处理单词点击
  const handleWordClick = useCallback((word: string, context: string) => {
    console.log('[ReaderPage] Word clicked:', word, 'context:', context);
    setSelectedWord(word);
    setSelectedContext(context);
    setPopupVisible(true);
  }, []);

  // 处理句子翻译
  const handleSentenceTranslate = async (text: string, source?: 'google' | 'ai') => {
    if (!text || text.trim().length < 2) return;
    
    const useSource = source || sentenceTranslateSource;
    console.log('[ReaderPage] Translating sentence:', text.substring(0, 50) + '...', 'source:', useSource);
    setSelectedSentence(text);
    setSentenceTranslating(true);
    setSentencePopupVisible(true);
    
    try {
      let result;
      
      if (useSource === 'ai') {
        // 使用 AI 翻译
        result = await window.electron.ipcRenderer.invoke('ai:translate', {
          text: text.trim(),
        });
      } else {
        // 使用 Google 翻译
        result = await window.electron.ipcRenderer.invoke('translate:sentence', {
          text: text.trim(),
          targetLang: 'zh-CN',
        });
      }
      
      if (result.success) {
        setTranslatedSentence(result.data?.translatedText || result.data || result.translation || result.text || '翻译完成');
      } else {
        message.error(result.message || '翻译失败');
        setTranslatedSentence('翻译失败');
      }
    } catch (error: any) {
      console.error('[ReaderPage] Sentence translation error:', error);
      message.error('翻译失败: ' + error.message);
      setTranslatedSentence('翻译失败');
    } finally {
      setSentenceTranslating(false);
    }
  };
  
  // 切换句子翻译源并重新翻译
  const switchSentenceTranslateSource = async (newSource: 'google' | 'ai') => {
    setSentenceTranslateSource(newSource);
    if (selectedSentence) {
      await handleSentenceTranslate(selectedSentence, newSource);
    }
  };

  // 处理鼠标释放事件（检测选中文本）
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    // 如果选中了超过一个单词（包含空格或长度较长），则提供翻译
    if (selectedText && selectedText.length > 1 && (
      selectedText.includes(' ') || 
      selectedText.length > 15
    )) {
      // 延迟一点执行，避免和单击冲突
      setTimeout(() => {
        handleSentenceTranslate(selectedText);
      }, 200);
    }
  }, []);

  // 关闭句子翻译弹窗
  const closeSentencePopup = useCallback(() => {
    setSentencePopupVisible(false);
    setSelectedSentence('');
    setTranslatedSentence('');
  }, []);

  // 播放单词发音
  const playPronunciation = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
      message.warning('您的浏览器不支持语音播放');
    }
  };

  // 将文本分割成句子
  const splitIntoSentences = (text: string): string[] => {
    // 按句号、问号、感叹号分割，但保留这些标点
    const sentenceRegex = /[^.!?]+[.!?]+["']?\s*/g;
    const matches = text.match(sentenceRegex);
    if (matches) {
      return matches.map(s => s.trim()).filter(s => s.length > 0);
    }
    // 如果没有匹配到，按行分割
    return text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  };

  // 开始全文朗读
  const startReadingAloud = () => {
    if (!fileContent || !('speechSynthesis' in window)) {
      message.warning('您的浏览器不支持语音播放');
      return;
    }
    
    // 如果正在暂停状态，继续播放
    if (isPaused && isReadingAloud) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }
    
    // 分割句子
    const sentenceList = splitIntoSentences(fileContent);
    setSentences(sentenceList);
    setIsReadingAloud(true);
    setIsPaused(false);
    setCurrentSentenceIndex(0);
    
    // 开始朗读第一句
    speakSentence(0, sentenceList);
  };

  // 朗读单个句子
  const speakSentence = (index: number, sentenceList: string[]) => {
    if (index >= sentenceList.length) {
      // 朗读完成
      setIsReadingAloud(false);
      setIsPaused(false);
      setCurrentSentenceIndex(-1);
      return;
    }
    
    setCurrentSentenceIndex(index);
    
    const utterance = new SpeechSynthesisUtterance(sentenceList[index]);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    utterance.onend = () => {
      // 播放下一句
      if (isReadingAloud && !isPaused) {
        speakSentence(index + 1, sentenceList);
      }
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setIsReadingAloud(false);
        setIsPaused(false);
      }
    };
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    
    // 滚动到当前句子
    scrollToSentence(sentenceList[index]);
  };

  // 暂停朗读
  const pauseReadingAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  // 停止朗读
  const stopReadingAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsReadingAloud(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
    utteranceRef.current = null;
  };

  // 滚动到当前朗读的句子
  const scrollToSentence = (sentence: string) => {
    if (!contentRef.current) return;
    
    // 查找包含该句子的元素
    const contentDiv = contentRef.current;
    const textNodes: Node[] = [];
    
    // 获取所有文本节点
    const walker = document.createTreeWalker(
      contentDiv,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent?.includes(sentence.slice(0, 30))) {
        textNodes.push(node);
        break;
      }
    }
    
    if (textNodes.length > 0) {
      const range = document.createRange();
      range.selectNode(textNodes[0]);
      const rect = range.getBoundingClientRect();
      const containerRect = contentDiv.getBoundingClientRect();
      
      // 滚动到视图中
      const scrollTop = contentDiv.scrollTop + rect.top - containerRect.top - 100;
      contentDiv.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  };

  // 组件卸载时停止朗读
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 判断单词是否是生词
  const isUnknownWord = (word: string): boolean => {
    const lowerWord = word.toLowerCase();
    
    // 如果在已掌握列表中，不是生词
    if (knownWords.has(lowerWord) || customWords.includes(lowerWord)) {
      return false;
    }
    
    // 获取单词等级
    const wordLevel = vocabularyAnalysis.get(lowerWord);
    if (!wordLevel) return false; // 未知等级的单词不标记
    
    // 获取用户等级索引
    const userLevelIndex = levelOrder.indexOf(vocabularyLevel);
    const wordLevelIndex = levelOrder.indexOf(wordLevel as VocabularyLevel);
    
    // 如果单词等级高于用户等级，则是生词
    return wordLevelIndex > userLevelIndex;
  };

  // 获取单词等级颜色
  const getWordLevelColor = (word: string): string => {
    const level = vocabularyAnalysis.get(word.toLowerCase());
    const colors: Record<string, string> = {
      elementary: '#52c41a',
      middle: '#73d13d',
      high: '#597ef7',
      cet4: '#9254de',
      cet6: '#f759ab',
      postgraduate: '#ff4d4f',
      ielts: '#ff7a45',
      toefl: '#ffa940',
      gre: '#ff4d4f',
      tem8: '#cf1322',
    };
    return colors[level || ''] || '';
  };

  // 跳转到指定章节
  const jumpToChapter = (index: number) => {
    if (index >= 0 && index < chapterStartPages.length) {
      const targetPage = chapterStartPages[index];
      setCurrentChapter(index);
      setChapterDrawerOpen(false);
      // 跳转到章节起始页
      goToPage(targetPage);
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
        
        const unknown = isUnknownWord(part);
        const levelColor = getWordLevelColor(part);
        
        return (
          <Tooltip 
            key={index} 
            title={
              <span>
                {part}
                <Button 
                  type="text" 
                  size="small" 
                  icon={<SoundOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    playPronunciation(part);
                  }}
                  style={{ color: 'white', marginLeft: 8 }}
                />
              </span>
            }
          >
            <span
              className={`cursor-pointer hover:bg-yellow-200 hover:text-blue-600 transition-colors rounded px-0.5 ${
                unknown ? 'border-b-2 border-red-400 bg-red-50' : ''
              }`}
              style={levelColor ? { borderBottom: `2px solid ${levelColor}` } : {}}
              onClick={() => handleWordClick(part.toLowerCase(), context)}
            >
              {part}
            </span>
          </Tooltip>
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

  // 渲染带高亮的朗读内容
  const renderHighlightedContent = () => {
    return (
      <div className="flex flex-col h-full">
        {/* 页面内容 - 简洁模式 */}
        <div 
          className={`flex-1 reader-content p-8 max-w-4xl mx-auto ${themeStyles.container} shadow-sm overflow-hidden`}
          style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
        >
          <div className={`${themeStyles.text} whitespace-pre-wrap`}>
            {sentences.map((sentence, index) => (
              <span
                key={index}
                ref={index === currentSentenceIndex ? highlightRef : null}
                className={`transition-all duration-300 rounded px-1 ${
                  index === currentSentenceIndex
                    ? 'bg-yellow-200 text-yellow-900 font-medium'
                    : index < currentSentenceIndex
                    ? 'text-gray-400'
                    : ''
                }`}
              >
                {renderClickableContent(sentence)}
                {' '}
              </span>
            ))}
          </div>
        </div>
        
        {/* 分页控制栏 */}
        {totalPages > 1 && (
          <div className={`h-14 border-t flex items-center justify-center gap-4 ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <Button
              icon={<LeftOutlined />}
              onClick={goToPreviousPage}
              disabled={currentPage === 0}
            >
              上一页
            </Button>
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              第 {currentPage + 1} / {totalPages} 页
            </span>
            <Button
              icon={<RightOutlined />}
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    );
  };

  // 渲染加载状态
  const renderLoading = () => {
    const stageMessages: Record<string, string> = {
      reading: '正在读取文件...',
      parsing: '正在解析内容...',
      rendering: '正在渲染内容...',
      analyzing: '正在分析词汇...',
      complete: '加载完成',
    };

    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <Spin size="large" />
        <div className="text-center space-y-3 w-80">
          <p className="text-lg font-medium text-gray-700">
            {loadingState.message || stageMessages[loadingState.stage]}
          </p>
          <Progress 
            percent={loadingState.progress} 
            status="active"
            strokeColor={{ from: '#108ee9', to: '#87d068' }}
          />
          <p className="text-sm text-gray-500">
            大文件可能需要一些时间，请耐心等待
          </p>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    console.log('[ReaderPage] Rendering content, fileContent length:', fileContent?.length);
    
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

    // 如果使用全文朗读，渲染带高亮的版本
    if (isReadingAloud && sentences.length > 0) {
      return renderHighlightedContent();
    }

    return (
      <div className="flex flex-col h-full">
        {/* 页面内容 - 简洁模式，隐藏顶部信息栏 */}
        <div 
          className={`flex-1 reader-content p-8 max-w-4xl mx-auto ${themeStyles.container} shadow-sm overflow-hidden`}
          style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
        >
          <div className={`${themeStyles.text} whitespace-pre-wrap`}>
            {renderClickableContent(fileContent)}
          </div>
        </div>
        
        {/* 分页控制栏 */}
        {totalPages > 1 && (
          <div className={`h-14 border-t flex items-center justify-center gap-4 ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <Button
              icon={<LeftOutlined />}
              onClick={goToPreviousPage}
              disabled={currentPage === 0}
            >
              上一页
            </Button>
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              第 {currentPage + 1} / {totalPages} 页
            </span>
            <Button
              icon={<RightOutlined />}
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    );
  };

  console.log('[ReaderPage] Rendering, loading:', loadingState.isLoading);

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
            disabled={loadingState.isLoading}
          >
            打开文件
          </Button>
          {chapters.length > 0 && (
            <Button
              icon={<MenuOutlined />}
              onClick={() => setChapterDrawerOpen(true)}
              disabled={loadingState.isLoading}
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
          {totalPages > 0 && (
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {currentPage + 1} / {totalPages} 页
            </span>
          )}
          
          {/* 全文朗读按钮 */}
          {fileContent && (
            <>
              {!isReadingAloud ? (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={startReadingAloud}
                >
                  朗读
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={startReadingAloud}
                    >
                      继续
                    </Button>
                  ) : (
                    <Button
                      icon={<PauseCircleOutlined />}
                      onClick={pauseReadingAloud}
                    >
                      暂停
                    </Button>
                  )}
                  <Button
                    danger
                    icon={<StopOutlined />}
                    onClick={stopReadingAloud}
                  >
                    停止
                  </Button>
                </>
              )}
            </>
          )}
          
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

      {/* Main Content Area with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content */}
        <div 
          ref={contentRef}
          className={`flex-1 overflow-hidden ${themeStyles.bg} relative`}
          onMouseUp={handleMouseUp}
        >
          {loadingState.isLoading ? (
            renderLoading()
          ) : (
            renderContent()
          )}
          
          {/* 句子翻译弹窗 */}
          {sentencePopupVisible && (
            <Card
              ref={sentencePopupRef}
              className="absolute z-50 shadow-lg max-w-md"
              style={{
                top: '20%',
                left: '50%',
                transform: 'translateX(-50%)',
                minWidth: '320px',
              }}
              title={
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TranslationOutlined />
                    句子翻译
                  </span>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={closeSentencePopup}
                  />
                </div>
              }
            >
              <div className="space-y-3">
                {/* 翻译源切换 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">翻译源:</span>
                  <Button 
                    size="small" 
                    type={sentenceTranslateSource === 'google' ? 'primary' : 'default'}
                    onClick={() => switchSentenceTranslateSource('google')}
                  >
                    Google
                  </Button>
                  <Button 
                    size="small" 
                    type={sentenceTranslateSource === 'ai' ? 'primary' : 'default'}
                    onClick={() => switchSentenceTranslateSource('ai')}
                  >
                    AI
                  </Button>
                </div>
                
                <Divider className="my-2" />
                
                {/* 原文 */}
                <div>
                  <div className="text-xs text-gray-400 mb-1">原文</div>
                  <div className="text-sm text-gray-800 leading-relaxed">
                    {selectedSentence}
                  </div>
                </div>
                
                <Divider className="my-2" />
                
                {/* 译文 */}
                <div>
                  <div className="text-xs text-gray-400 mb-1">
                    译文 {sentenceTranslateSource === 'ai' && <Tag color="blue" className="text-xs">AI</Tag>}
                  </div>
                  {sentenceTranslating ? (
                    <Spin size="small" tip="翻译中..." />
                  ) : (
                    <div className="text-sm text-blue-700 leading-relaxed">
                      {translatedSentence}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
        
        {/* 单词详情侧边栏 */}
        <WordPopup
          word={selectedWord}
          context={selectedContext}
          visible={popupVisible}
          onClose={() => setPopupVisible(false)}
          onPlayPronunciation={playPronunciation}
          mode="sidebar"
          bookName={fileName}
          onMasteredStatusChange={(word, isMastered) => {
            // 更新本地熟词集合
            setKnownWords(prev => {
              const newSet = new Set(prev);
              if (isMastered) {
                newSet.add(word.toLowerCase());
              } else {
                newSet.delete(word.toLowerCase());
              }
              return newSet;
            });
          }}
        />
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
          {chapters.map((chapter, index) => {
            const startPage = chapterStartPages[index] || 0;
            const endPage = index < chapters.length - 1 
              ? (chapterStartPages[index + 1] || totalPages) - 1 
              : totalPages - 1;
            const isCurrent = currentChapter === index;
            
            return (
              <div
                key={chapter.id}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  isCurrent
                    ? 'bg-blue-100 text-blue-700' 
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => jumpToChapter(index)}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate flex-1">
                    {index + 1}. {chapter.title}
                  </div>
                  <div className={`text-xs ml-2 ${isCurrent ? 'text-blue-500' : 'text-gray-400'}`}>
                    P{startPage + 1}{startPage !== endPage && `-${endPage + 1}`}
                  </div>
                </div>
              </div>
            );
          })}
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

    </div>
  );
};

export default ReaderPage;

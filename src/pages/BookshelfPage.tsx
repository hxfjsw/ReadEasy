import { useState, useEffect } from 'react';
import { 
  Card, 
  Empty, 
  Button, 
  Popconfirm, 
  message, 
  Spin, 
  Tooltip,
  Tag,
  Modal,
  List,
  Space,
  Select,
  Table
} from 'antd';
import { 
  DeleteOutlined, 
  FileTextOutlined, 
  ReadOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  FileUnknownOutlined,
  BookOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import type { ReadingRecord } from '../types';
import WordPopup from '../components/WordPopup';
import { verb, noun, adjective } from 'wink-lemmatizer';

// 辅助函数：尝试将单词还原为原型
const lemmatizeWord = (word: string): string => {
  // 依次尝试动词、名词、形容词还原
  const verbForm = verb(word);
  if (verbForm !== word) return verbForm;
  
  const nounForm = noun(word);
  if (nounForm !== word) return nounForm;
  
  const adjForm = adjective(word);
  if (adjForm !== word) return adjForm;
  
  return word;
};

interface BookshelfItem extends ReadingRecord {
  id: number;
  bookName: string;
  filePath: string;
  file_path?: string;  // 数据库返回的是下划线格式
  format: string;
  progress: number;
  lastReadAt: Date;
  last_read_at?: Date; // 数据库返回的是下划线格式
}

interface BookshelfPageProps {
  onOpenBook?: (filePath: string) => void;
}

const BookshelfPage: React.FC<BookshelfPageProps> = ({ onOpenBook }) => {
  const [books, setBooks] = useState<BookshelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookshelfItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // 单词提取相关状态
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  interface ExtractedWord {
    word: string;
    count: number;
    example?: string; // 存储单词在文中的例句
    definitionCn?: string; // 中文释义
  }
  const [extractedWords, setExtractedWords] = useState<ExtractedWord[]>([]);
  const [originalExtractedWords, setOriginalExtractedWords] = useState<ExtractedWord[]>([]); // 保存原始顺序
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [extractPageSize, setExtractPageSize] = useState(50);
  const [extractSortOrder, setExtractSortOrder] = useState<'original' | 'alphabetical' | 'frequency'>('original');
  const [loadingDefinitions, setLoadingDefinitions] = useState(false);
  const [ignoringInvalidWords, setIgnoringInvalidWords] = useState(false);
  const [ignoredInvalidCount, setIgnoredInvalidCount] = useState(0);
  
  // 单词查询弹窗状态
  const [wordPopupVisible, setWordPopupVisible] = useState(false);
  const [selectedWordForPopup, setSelectedWordForPopup] = useState('');

  // 加载书架数据
  const loadBooks = async () => {
    console.log('[Bookshelf] loadBooks 开始...');
    setLoading(true);
    try {
      const records = await window.electron.ipcRenderer.invoke('db:getReadingRecords');
      console.log('[Bookshelf] 获取到记录:', records);
      
      // 过滤掉没有 filePath 的记录，并按最后阅读时间排序
      const validRecords = (records || [])
        .filter((record: BookshelfItem) => {
          // 数据库返回下划线格式，需要同时检查两种格式
          const path = record.filePath || record.file_path;
          const hasPath = path && path.trim() !== '';
          if (!hasPath) {
            console.log('[Bookshelf] 过滤掉无路径记录:', record);
          }
          return hasPath;
        })
        .map((record: BookshelfItem): BookshelfItem => {
          // 处理日期：数据库返回的是 Unix 时间戳（秒），需要转换为毫秒
          const rawDate = record.lastReadAt || record.last_read_at;
          let parsedDate: Date;
          if (typeof rawDate === 'number') {
            parsedDate = rawDate < 1e10 ? new Date(rawDate * 1000) : new Date(rawDate);
          } else if (typeof rawDate === 'string') {
            parsedDate = new Date(rawDate);
          } else {
            parsedDate = new Date();
          }
          
          return {
            ...record,
            // 统一转换为驼峰格式（filter 已经确保有 path）
            filePath: (record.filePath || record.file_path) as string,
            lastReadAt: parsedDate,
          };
        })
        .sort((a: BookshelfItem, b: BookshelfItem) => {
          return new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime();
        });
      
      console.log('[Bookshelf] 有效记录数:', validRecords.length);
      setBooks(validRecords);
    } catch (error) {
      console.error('[Bookshelf] 加载书架失败:', error);
      message.error('加载书架失败');
    } finally {
      setLoading(false);
      console.log('[Bookshelf] loadBooks 结束');
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  // 打开书籍
  const handleOpenBook = (book: BookshelfItem) => {
    // 检查文件路径是否存在
    if (!book.filePath) {
      message.error('文件路径不存在');
      console.error('Book filePath is undefined:', book);
      return;
    }
    
    // 检查文件是否存在
    const checkFile = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke('file:read', book.filePath);
        if (result.success) {
          if (onOpenBook) {
            onOpenBook(book.filePath);
          } else {
            // 如果没有传入 onOpenBook，发送一个全局事件通知 ReaderPage
            window.dispatchEvent(new CustomEvent('openBookFromBookshelf', { 
              detail: { filePath: book.filePath } 
            }));
          }
        } else {
          message.error('文件不存在或已被移动');
        }
      } catch (error) {
        console.error('打开文件失败:', error);
        message.error('打开文件失败');
      }
    };
    checkFile();
  };

  // 删除书籍
  const handleDeleteBook = async (id: number) => {
    try {
      await window.electron.ipcRenderer.invoke('db:deleteReadingRecord', id);
      message.success('已从书架移除');
      loadBooks();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 打开文件选择对话框添加新书
  const handleAddBook = async () => {
    try {
      console.log('[Bookshelf] 打开文件对话框...');
      const result = await window.electron.ipcRenderer.invoke('file:open');
      console.log('[Bookshelf] 文件选择结果:', result);
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        console.log('[Bookshelf] 选择的文件:', filePath);
        
        // 读取文件信息
        const fileResult = await window.electron.ipcRenderer.invoke('file:read', filePath);
        console.log('[Bookshelf] 文件读取结果:', fileResult);
        
        if (fileResult.success) {
          const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
          const bookData = {
            bookName: fileResult.metadata?.title || fileName,
            filePath: filePath,
            format: filePath.split('.').pop() || '',
            progress: 0,
            currentPosition: '0',
            bookmarks: '[]',
          };
          console.log('[Bookshelf] 准备添加到书架:', bookData);
          
          // 添加到书架
          const addResult = await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', bookData);
          console.log('[Bookshelf] 添加结果:', addResult);
          
          if (addResult) {
            message.success('已添加到书架');
            console.log('[Bookshelf] 开始刷新书架...');
            // 立即重新加载书架数据
            await loadBooks();
            console.log('[Bookshelf] 书架刷新完成, 当前书籍数:', books.length);
          } else {
            message.error('添加到书架失败');
          }
        } else {
          message.error('读取文件失败: ' + (fileResult.error || '未知错误'));
        }
      }
    } catch (error) {
      console.error('[Bookshelf] 添加书籍失败:', error);
      message.error('添加书籍失败');
    }
  };

  // 格式化时间
  // 数据库返回的是 Unix 时间戳（秒），需要转换为毫秒
  const parseDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    // 如果是数字（Unix 时间戳），转换为毫秒
    if (typeof dateValue === 'number') {
      // 判断是秒还是毫秒（Unix 时间戳秒级通常小于 1e10）
      return dateValue < 1e10 ? new Date(dateValue * 1000) : new Date(dateValue);
    }
    return new Date(dateValue);
  };

  const formatTime = (date: Date | number | string) => {
    const parsedDate = parseDate(date);
    const now = new Date();
    const diff = now.getTime() - parsedDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 0 ? '刚刚' : `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return parsedDate.toLocaleDateString('zh-CN');
    }
  };

  // 获取文件图标
  const getFileIcon = (format: string) => {
    const ext = format.toLowerCase();
    if (ext === 'epub') {
      return <FileTextOutlined style={{ fontSize: 48, color: '#52c41a' }} />;
    } else if (ext === 'txt') {
      return <FileTextOutlined style={{ fontSize: 48, color: '#1890ff' }} />;
    } else if (ext === 'mobi') {
      return <FileTextOutlined style={{ fontSize: 48, color: '#722ed1' }} />;
    }
    return <FileUnknownOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />;
  };

  // 显示书籍详情
  const showBookDetail = (book: BookshelfItem) => {
    setSelectedBook(book);
    setDetailModalOpen(true);
  };

  // 批量查询单词释义 - 优先使用 ECDICT，其次本地数据库，最后 AI 接口
  const batchLoadDefinitions = async (words: ExtractedWord[]) => {
    setLoadingDefinitions(true);
    try {
      const updatedWords = [...words];
      const wordList = words.map(w => w.word.toLowerCase());

      // 第一步：尝试使用 ECDICT 批量查询
      try {
        const ecdictResult = await window.electron.ipcRenderer.invoke('ecdict:batchLookup', wordList);
        if (ecdictResult?.success && ecdictResult.data) {
          const ecdictData = ecdictResult.data;
          for (let i = 0; i < updatedWords.length; i++) {
            const word = updatedWords[i].word.toLowerCase();
            if (ecdictData[word]?.definitionCn) {
              updatedWords[i] = { ...updatedWords[i], definitionCn: ecdictData[word].definitionCn };
            }
          }
          // 更新界面显示 ECDICT 查询结果
          setExtractedWords([...updatedWords]);
          setOriginalExtractedWords([...updatedWords]);
        }
      } catch (error) {
        console.log('ECDICT 查询失败，降级到本地数据库:', error);
      }

      // 第二步：对 ECDICT 未找到的单词，查询本地数据库和 AI
      const missingWords = updatedWords.filter(w => !w.definitionCn);
      if (missingWords.length > 0) {
        // 分批查询，每批 10 个单词
        const batchSize = 10;
        
        for (let i = 0; i < missingWords.length; i += batchSize) {
          const batch = missingWords.slice(i, i + batchSize);
          const promises = batch.map(async (item) => {
            try {
              // 先尝试从本地数据库查询
              const wordFromDB = await window.electron.ipcRenderer.invoke('db:getWord', item.word.toLowerCase());
              if (wordFromDB?.definitionCn) {
                return { word: item.word, definitionCn: wordFromDB.definitionCn };
              }
              // 本地数据库没有，尝试用基础查询接口
              const result = await window.electron.ipcRenderer.invoke('ai:defineWordBasic', { word: item.word });
              if (result?.success && result.data?.definitions?.[0]?.meaningCn) {
                return { word: item.word, definitionCn: result.data.definitions[0].meaningCn };
              }
              return null;
            } catch {
              return null;
            }
          });
          
          const results = await Promise.all(promises);
          // 更新已查询的单词释义
          for (const result of results) {
            if (result) {
              const index = updatedWords.findIndex(w => w.word === result.word);
              if (index !== -1) {
                updatedWords[index] = { ...updatedWords[index], definitionCn: result.definitionCn };
              }
            }
          }
          
          // 每完成一批就更新界面，让用户看到进度
          setExtractedWords([...updatedWords]);
          setOriginalExtractedWords([...updatedWords]);
        }
      }
    } catch (error) {
      console.error('批量加载释义失败:', error);
    } finally {
      setLoadingDefinitions(false);
    }
  };

  // 打开单词提取对话框
  const openExtractWordsModal = async (book: BookshelfItem) => {
    setSelectedBook(book);
    setExtractModalOpen(true);
    setExtractLoading(true);
    setSelectedWords([]);
    
    try {
      // 加载已有的熟词并过滤
      const masteredWords = await window.electron.ipcRenderer.invoke('db:getMasteredWords');
      const masteredSet = new Set(masteredWords.map((w: string) => w.toLowerCase()));
      
      // 读取文件内容
      const fileResult = await window.electron.ipcRenderer.invoke('file:read', book.filePath);
      if (fileResult.success) {
        // 提取所有英文单词、次数和例句
        const content = fileResult.data || '';
        const wordData = extractWordsFromText(content);
        // 转换为数组格式
        const allWords: ExtractedWord[] = Array.from(wordData.entries())
          .map(([word, data]) => ({ word, count: data.count, example: data.example, definitionCn: undefined }));
        // 计算排除的熟词数量
        const filteredCount = allWords.filter(item => masteredSet.has(item.word)).length;
        setExcludedCount(filteredCount);
        // 过滤掉熟词本中的单词
        let filteredWords = allWords
          .filter(item => !masteredSet.has(item.word));
        // 保存原始顺序（按出现顺序）
        setOriginalExtractedWords(filteredWords);
        // 根据排序方式排序
        if (extractSortOrder === 'alphabetical') {
          filteredWords = filteredWords.sort((a, b) => a.word.localeCompare(b.word));
        } else if (extractSortOrder === 'frequency') {
          filteredWords = filteredWords.sort((a, b) => b.count - a.count);
        }
        setExtractedWords(filteredWords);
        
        // 自动加载释义（前 50 个单词）
        if (filteredWords.length > 0) {
          setTimeout(() => {
            batchLoadDefinitions(filteredWords.slice(0, 50));
          }, 100);
        }
      } else {
        message.error('读取文件失败');
        setExtractedWords([]);
        setExcludedCount(0);
      }
    } catch (error) {
      console.error('提取单词失败:', error);
      message.error('提取单词失败');
      setExtractedWords([]);
      setExcludedCount(0);
    } finally {
      setExtractLoading(false);
    }
  };

  // 当排序方式改变时重新排序单词列表
  useEffect(() => {
    if (originalExtractedWords.length > 0) {
      let sortedWords = [...originalExtractedWords];
      if (extractSortOrder === 'alphabetical') {
        sortedWords = sortedWords.sort((a, b) => a.word.localeCompare(b.word));
      } else if (extractSortOrder === 'frequency') {
        sortedWords = sortedWords.sort((a, b) => b.count - a.count);
      }
      setExtractedWords(sortedWords);
    }
  }, [extractSortOrder, originalExtractedWords]);

  // 一键排除无效词（ECDICT 中找不到的词）
  const handleIgnoreInvalidWords = async () => {
    if (extractedWords.length === 0) return;
    
    setIgnoringInvalidWords(true);
    try {
      // 获取所有单词
      const allWords = extractedWords.map(w => w.word.toLowerCase());
      
      // 批量查询 ECDICT
      const ecdictResult = await window.electron.ipcRenderer.invoke('ecdict:batchLookup', allWords);
      
      if (ecdictResult?.success) {
        const foundWords = new Set(Object.keys(ecdictResult.data || {}));
        
        // 找出 ECDICT 中找不到的词（无效词）
        const invalidWords = extractedWords.filter(w => !foundWords.has(w.word.toLowerCase()));
        
        if (invalidWords.length === 0) {
          message.info('没有发现无效词，所有单词都能在词典中找到');
          return;
        }
        
        // 将无效词加入废词本
        const invalidWordStrings = invalidWords.map(w => w.word);
        const result = await window.electron.ipcRenderer.invoke(
          'db:batchAddIgnoredWords', 
          invalidWordStrings, 
          selectedBook?.bookName
        );
        
        if (result.success) {
          // 从当前列表中移除无效词
          const validWords = extractedWords.filter(w => foundWords.has(w.word.toLowerCase()));
          setExtractedWords(validWords);
          setOriginalExtractedWords(validWords);
          setIgnoredInvalidCount(invalidWords.length);
          message.success(`已排除 ${invalidWords.length} 个无效词，已加入废词本`);
        } else {
          message.error('加入废词本失败');
        }
      }
    } catch (error) {
      console.error('排除无效词失败:', error);
      message.error('排除无效词失败');
    } finally {
      setIgnoringInvalidWords(false);
    }
  };

    // 从文本中提取单词和例句
  const extractWordsFromText = (text: string): Map<string, { count: number; example?: string }> => {
    const wordData = new Map<string, { count: number; example?: string }>();
    
    // 先将文本分割成句子
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // 匹配纯英文单词（4个字母以上，避免过于简单的词）
    const matches = text.match(/[a-zA-Z]{4,}/g);
    if (matches) {
      matches.forEach(word => {
        const lowerWord = word.toLowerCase();
        // 过滤纯重复字母和常见无意义组合
        if (!/^(.)+$/.test(lowerWord) && lowerWord.length >= 4 && lowerWord.length <= 20) {
          // 使用 lemmatizer 还原单词原型
          const lemma = lemmatizeWord(lowerWord);
          
          const existing = wordData.get(lemma);
          if (existing) {
            existing.count++;
          } else {
            // 找到包含该单词的例句
            let example: string | undefined;
            for (const sentence of sentences) {
              if (sentence.toLowerCase().includes(lowerWord)) {
                // 清理并截取例句（最多120字符）
                example = sentence.trim().replace(/\s+/g, ' ');
                if (example.length > 120) {
                  example = example.slice(0, 120) + '...';
                }
                break;
              }
            }
            wordData.set(lemma, { count: 1, example });
          }
        }
      });
    }
    return wordData;
  };

  // 添加选中的单词到熟词本
  const handleAddSelectedWords = async () => {
    if (selectedWords.length === 0) {
      message.warning('请先选择单词');
      return;
    }
    
    let addedCount = 0;
    let existedCount = 0;
    
    for (const word of selectedWords) {
      try {
        const result = await window.electron.ipcRenderer.invoke('db:addMasteredWord', word);
        if (result.success) {
          if (result.existed) {
            existedCount++;
          } else {
            addedCount++;
          }
        }
      } catch (error) {
        console.error(`添加单词 ${word} 失败:`, error);
      }
    }
    
    message.success(`添加完成：新增 ${addedCount} 个，已存在 ${existedCount} 个`);
    
    // 刷新提取列表，排除已添加的熟词
    if (selectedBook) {
      openExtractWordsModal(selectedBook);
    }
    
    // 清空选择
    setSelectedWords([]);
    
    // 触发熟词本刷新事件
    window.dispatchEvent(new CustomEvent('masteredWordsUpdated'));
  };

  // 打开单词查询弹窗
  const handleViewWord = (word: string) => {
    setSelectedWordForPopup(word);
    setWordPopupVisible(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 标题栏 */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <ReadOutlined className="text-2xl text-blue-500" />
          <h2 className="text-xl font-bold text-gray-800">我的书架</h2>
          <Tag color="blue">{books.length} 本书</Tag>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleAddBook}
        >
          添加书籍
        </Button>
      </div>

      {/* 书架内容 */}
      <div className="flex-1 overflow-auto p-6">
        {books.length === 0 ? (
          <Empty
            description="书架空空如也"
            className="mt-20"
          >
            <Button type="primary" onClick={handleAddBook}>
              添加第一本书
            </Button>
          </Empty>
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 4 }}
            dataSource={books}
            renderItem={(book) => (
              <List.Item>
                <Card
                  hoverable
                  className="book-card group relative overflow-hidden"
                  onClick={() => handleOpenBook(book)}
                >
                  <div className="flex gap-4">
                    {/* 左侧：文件图标 */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center rounded">
                        {getFileIcon(book.format)}
                      </div>
                    </div>
                    
                    {/* 右侧：书籍信息 */}
                    <div className="flex-1 min-w-0">
                      {/* 书名 */}
                      <Tooltip title={book.bookName}>
                        <h3 className="font-bold text-gray-800 truncate mb-1">
                          {book.bookName}
                        </h3>
                      </Tooltip>
                      
                      {/* 文件路径 */}
                      <p className="text-gray-400 text-xs truncate mb-2" title={book.filePath}>
                        {book.filePath}
                      </p>
                      
                      {/* 元信息 */}
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <ClockCircleOutlined />
                        <span>{formatTime(book.lastReadAt)}</span>
                        <Tag>{book.format.toUpperCase()}</Tag>
                        {book.progress > 0 && (
                          <Tag color="green">{book.progress}%</Tag>
                        )}
                      </div>
                      
                      {/* 操作按钮 */}
                      <Space size="small" wrap>
                        <Button 
                          type="primary" 
                          size="small"
                          icon={<ReadOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBook(book);
                          }}
                        >
                          阅读
                        </Button>
                        <Button 
                          size="small"
                          icon={<BookOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            openExtractWordsModal(book);
                          }}
                        >
                          提取单词
                        </Button>
                        <Button 
                          size="small"
                          icon={<ClockCircleOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            showBookDetail(book);
                          }}
                        >
                          详情
                        </Button>
                        <Popconfirm
                          title="确定从书架移除这本书吗？"
                          description="此操作不会删除原文件"
                          onConfirm={(e) => {
                            e?.stopPropagation();
                            handleDeleteBook(book.id);
                          }}
                          onCancel={(e) => e?.stopPropagation()}
                          okText="移除"
                          cancelText="取消"
                        >
                          <Button 
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          >
                            移除
                          </Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </div>

      {/* 书籍详情模态框 */}
      <Modal
        title="书籍详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
          <Button 
            key="read" 
            type="primary" 
            icon={<ReadOutlined />}
            onClick={() => {
              setDetailModalOpen(false);
              if (selectedBook) {
                handleOpenBook(selectedBook);
              }
            }}
          >
            开始阅读
          </Button>,
        ]}
      >
        {selectedBook && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center rounded">
                {getFileIcon(selectedBook.format)}
              </div>
              <div>
                <h3 className="font-bold text-lg">{selectedBook.bookName}</h3>
                <Tag>{selectedBook.format.toUpperCase()}</Tag>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">文件路径:</span>
                <span className="text-gray-700 max-w-xs truncate" title={selectedBook.filePath}>
                  {selectedBook.filePath}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">阅读进度:</span>
                <span className="text-gray-700">{selectedBook.progress}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">最后阅读:</span>
                <span className="text-gray-700">
                  {formatTime(selectedBook.lastReadAt)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 单词提取模态框 */}
      <Modal
        title={`提取单词 - ${selectedBook?.bookName || ''}`}
        open={extractModalOpen}
        onCancel={() => {
          setExtractModalOpen(false);
          setSelectedWords([]);
        }}
        width={900}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setExtractModalOpen(false);
              setSelectedWords([]);
            }}
          >
            取消
          </Button>,
          <Button
            key="ignore-invalid"
            loading={ignoringInvalidWords}
            disabled={ignoringInvalidWords || extractedWords.length === 0}
            onClick={handleIgnoreInvalidWords}
            danger
          >
            排除无效词
          </Button>,
          <Button
            key="load-definitions"
            loading={loadingDefinitions}
            disabled={loadingDefinitions || extractedWords.length === 0}
            onClick={() => batchLoadDefinitions(extractedWords)}
          >
            加载全部释义
          </Button>,
          <Button 
            key="add" 
            type="primary" 
            icon={<CheckCircleOutlined />}
            disabled={selectedWords.length === 0}
            onClick={handleAddSelectedWords}
          >
            添加到熟词本 ({selectedWords.length})
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">
              共提取到 <strong>{extractedWords.length}</strong> 个单词
              {excludedCount > 0 && `（已自动排除熟词本中的 ${excludedCount} 个单词）`}
              {ignoredInvalidCount > 0 && `，已排除 ${ignoredInvalidCount} 个无效词到废词本`}
            </span>
            <div className="flex items-center gap-4">
              <Select
                size="small"
                value={extractSortOrder}
                onChange={setExtractSortOrder}
                options={[
                  { value: 'original', label: '文中顺序' },
                  { value: 'alphabetical', label: '字母排序' },
                  { value: 'frequency', label: '出现频率' },
                ]}
                style={{ width: 100 }}
              />
              <Select
                size="small"
                value={extractPageSize}
                onChange={setExtractPageSize}
                options={[
                  { value: 20, label: '20条/页' },
                  { value: 50, label: '50条/页' },
                  { value: 100, label: '100条/页' },
                  { value: 200, label: '200条/页' },
                  { value: 500, label: '500条/页' },
                ]}
                style={{ width: 100 }}
              />
              <span className="text-gray-500 text-sm">
                已选择 {selectedWords.length} 个
              </span>
            </div>
          </div>
          
          {extractLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spin tip="正在提取单词..." />
            </div>
          ) : extractedWords.length === 0 ? (
            <Empty description="未提取到单词" />
          ) : (
            <div className="max-h-[500px] overflow-y-auto border rounded-lg">
              <Table
                dataSource={extractedWords}
                rowKey="word"
                size="small"
                pagination={{
                  pageSize: extractPageSize,
                  showSizeChanger: false,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                }}
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: selectedWords,
                  onChange: (selectedRowKeys) => {
                    setSelectedWords(selectedRowKeys as string[]);
                  },
                }}
                columns={[
                  {
                    title: '单词',
                    dataIndex: 'word',
                    key: 'word',
                    width: 150,
                    render: (word: string, record: ExtractedWord) => (
                      <Tooltip title={record.example ? `"${record.example}"` : '无例句'} placement="topLeft" mouseEnterDelay={0.5}>
                        <span className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => handleViewWord(word)}>
                          {word}
                        </span>
                      </Tooltip>
                    ),
                  },
                  {
                    title: '中文释义',
                    dataIndex: 'definitionCn',
                    key: 'definitionCn',
                    ellipsis: true,
                    render: (definitionCn: string | undefined) => (
                      <span className="text-gray-600 text-sm">
                        {definitionCn || '-'}
                      </span>
                    ),
                  },
                  {
                    title: '出现次数',
                    dataIndex: 'count',
                    key: 'count',
                    width: 100,
                    sorter: (a: ExtractedWord, b: ExtractedWord) => a.count - b.count,
                    render: (count: number) => (
                      <Tag color="blue">{count} 次</Tag>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* 单词查询弹窗 */}
      <WordPopup
        word={selectedWordForPopup}
        visible={wordPopupVisible}
        onClose={() => setWordPopupVisible(false)}
        bookName={selectedBook?.bookName}
      />
    </div>
  );
};

export default BookshelfPage;

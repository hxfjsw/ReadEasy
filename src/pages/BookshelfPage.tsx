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
  Modal
} from 'antd';
import { 
  DeleteOutlined, 
  FileTextOutlined, 
  ReadOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  FileUnknownOutlined
} from '@ant-design/icons';
import type { ReadingRecord } from '../types';

interface BookshelfItem extends ReadingRecord {
  id: number;
  bookName: string;
  filePath: string;
  format: string;
  progress: number;
  lastReadAt: Date;
}

interface BookshelfPageProps {
  onOpenBook?: (filePath: string) => void;
}

const BookshelfPage: React.FC<BookshelfPageProps> = ({ onOpenBook }) => {
  const [books, setBooks] = useState<BookshelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookshelfItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 加载书架数据
  const loadBooks = async () => {
    setLoading(true);
    try {
      const records = await window.electron.ipcRenderer.invoke('db:getReadingRecords');
      // 过滤掉没有 filePath 的记录，并按最后阅读时间排序
      const validRecords = (records || [])
        .filter((record: BookshelfItem) => record.filePath && record.filePath.trim() !== '')
        .sort((a: BookshelfItem, b: BookshelfItem) => {
          return new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime();
        });
      setBooks(validRecords);
    } catch (error) {
      console.error('加载书架失败:', error);
      message.error('加载书架失败');
    } finally {
      setLoading(false);
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
      const result = await window.electron.ipcRenderer.invoke('file:open');
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        // 读取文件信息
        const fileResult = await window.electron.ipcRenderer.invoke('file:read', filePath);
        if (fileResult.success) {
          const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
          // 添加到书架
          const addResult = await window.electron.ipcRenderer.invoke('db:addOrUpdateReadingRecord', {
            bookName: fileResult.metadata?.title || fileName,
            filePath: filePath,
            format: filePath.split('.').pop() || '',
            progress: 0,
            currentPosition: '0',
            bookmarks: '[]',
          });
          
          if (addResult) {
            message.success('已添加到书架');
            // 立即重新加载书架数据
            await loadBooks();
          } else {
            message.error('添加到书架失败');
          }
        } else {
          message.error('读取文件失败: ' + (fileResult.error || '未知错误'));
        }
      }
    } catch (error) {
      console.error('添加书籍失败:', error);
      message.error('添加书籍失败');
    }
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
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
      return new Date(date).toLocaleDateString('zh-CN');
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {books.map((book) => (
              <Card
                key={book.id}
                hoverable
                className="book-card group relative overflow-hidden"
                onClick={() => handleOpenBook(book)}
                cover={
                  <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                    {getFileIcon(book.format)}
                  </div>
                }
                actions={[
                  <Tooltip title="阅读" key="read">
                    <Button 
                      type="text" 
                      icon={<ReadOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenBook(book);
                      }}
                    >
                      阅读
                    </Button>
                  </Tooltip>,
                  <Tooltip title="详情" key="detail">
                    <Button 
                      type="text" 
                      icon={<ClockCircleOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        showBookDetail(book);
                      }}
                    >
                      详情
                    </Button>
                  </Tooltip>,
                  <Popconfirm
                    key="delete"
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
                      type="text" 
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    >
                      移除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={
                    <Tooltip title={book.bookName}>
                      <div className="truncate font-medium">{book.bookName}</div>
                    </Tooltip>
                  }
                  description={
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <ClockCircleOutlined />
                        <span>{formatTime(book.lastReadAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag>{book.format.toUpperCase()}</Tag>
                        {book.progress > 0 && (
                          <Tag color="green">{book.progress}%</Tag>
                        )}
                      </div>
                    </div>
                  }
                />
              </Card>
            ))}
          </div>
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
                  {new Date(selectedBook.lastReadAt).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BookshelfPage;

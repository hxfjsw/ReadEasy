import { Card, Button, Tooltip, Tag, Space, Popconfirm } from 'antd';
import { ReadOutlined, BookOutlined, ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { BookshelfItem } from '../types';
import { getFileIcon, formatTime } from '../utils';

interface BookCardProps {
  book: BookshelfItem;
  onOpenBook: (book: BookshelfItem) => void;
  onExtractWords: (book: BookshelfItem) => void;
  onShowDetail: (book: BookshelfItem) => void;
  onDeleteBook: (id: number) => void;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onOpenBook,
  onExtractWords,
  onShowDetail,
  onDeleteBook,
}) => {
  return (
    <Card
      hoverable
      className="book-card group relative overflow-hidden"
      onClick={() => onOpenBook(book)}
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="w-16 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center rounded">
            {getFileIcon(book.format)}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <Tooltip title={book.bookName}>
            <h3 className="font-bold text-gray-800 truncate mb-1">
              {book.bookName}
            </h3>
          </Tooltip>
          
          <p className="text-gray-400 text-xs truncate mb-2" title={book.filePath}>
            {book.filePath}
          </p>
          
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <ClockCircleOutlined />
            <span>{formatTime(book.lastReadAt)}</span>
            <Tag>{book.format.toUpperCase()}</Tag>
            {book.progress > 0 && (
              <Tag color="green">{book.progress}%</Tag>
            )}
          </div>
          
          <Space size="small" wrap>
            <Button 
              type="primary" 
              size="small"
              icon={<ReadOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onOpenBook(book);
              }}
            >
              阅读
            </Button>
            <Button 
              size="small"
              icon={<BookOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onExtractWords(book);
              }}
            >
              提取单词
            </Button>
            <Button 
              size="small"
              icon={<ClockCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onShowDetail(book);
              }}
            >
              详情
            </Button>
            <Popconfirm
              title="确定从书架移除这本书吗？"
              description="此操作不会删除原文件"
              onConfirm={(e) => {
                e?.stopPropagation();
                onDeleteBook(book.id);
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
  );
};

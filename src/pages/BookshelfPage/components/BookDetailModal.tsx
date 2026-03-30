import { Modal, Button, Tag } from 'antd';
import { ReadOutlined } from '@ant-design/icons';
import type { BookshelfItem } from '../types';
import { getFileIcon, formatTime } from '../utils';

interface BookDetailModalProps {
  open: boolean;
  book: BookshelfItem | null;
  onClose: () => void;
  onRead: (book: BookshelfItem) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  open,
  book,
  onClose,
  onRead,
}) => {
  return (
    <Modal
      title="书籍详情"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button 
          key="read" 
          type="primary" 
          icon={<ReadOutlined />}
          onClick={() => book && onRead(book)}
          disabled={!book}
        >
          开始阅读
        </Button>,
      ]}
    >
      {book && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center rounded">
              {getFileIcon(book.format)}
            </div>
            <div>
              <h3 className="font-bold text-lg">{book.bookName}</h3>
              <Tag>{book.format.toUpperCase()}</Tag>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">文件路径:</span>
              <span className="text-gray-700 max-w-xs truncate" title={book.filePath}>
                {book.filePath}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">阅读进度:</span>
              <span className="text-gray-700">{book.progress}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">最后阅读:</span>
              <span className="text-gray-700">
                {formatTime(book.lastReadAt)}
              </span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

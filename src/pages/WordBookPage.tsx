import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Empty, message, Popconfirm } from 'antd';
import { BookOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons';
import { WordBook, WordBookItem } from '../types';

const WordBookPage: React.FC = () => {
  const [wordBooks, setWordBooks] = useState<WordBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [words, setWords] = useState<WordBookItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWordBooks();
  }, []);

  useEffect(() => {
    if (selectedBookId) {
      loadWordsInBook(selectedBookId);
    }
  }, [selectedBookId]);

  const loadWordBooks = async () => {
    try {
      const books = await (window.electron.ipcRenderer.invoke as any)('db:getWordBooks');
      setWordBooks(books);
      if (books.length > 0 && !selectedBookId) {
        setSelectedBookId(books[0].id);
      }
    } catch (error) {
      message.error('加载单词本失败');
    }
  };

  const loadWordsInBook = async (bookId: number) => {
    setLoading(true);
    try {
      const bookWords = await (window.electron.ipcRenderer.invoke as any)('db:getWordsInBook', bookId);
      setWords(bookWords);
    } catch (error) {
      message.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWord = async (wordId: number) => {
    if (!selectedBookId) return;
    try {
      await (window.electron.ipcRenderer.invoke as any)('db:removeWordFromBook', selectedBookId, wordId);
      message.success('删除成功');
      loadWordsInBook(selectedBookId);
    } catch (error) {
      message.error('删除失败');
    }
  };

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      elementary: 'green',
      middle: 'cyan',
      high: 'blue',
      cet4: 'geekblue',
      cet6: 'purple',
      postgraduate: 'magenta',
      ielts: 'orange',
      toefl: 'gold',
      gre: 'red',
      tem8: 'volcano',
    };
    return colors[level] || 'default';
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      elementary: '小学',
      middle: '初中',
      high: '高中',
      cet4: '四级',
      cet6: '六级',
      postgraduate: '考研',
      ielts: '雅思',
      toefl: '托福',
      gre: 'GRE',
      tem8: '专八',
    };
    return labels[level] || level;
  };

  return (
    <div className="h-full flex">
      {/* Sidebar - Word Book List */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-700">单词本列表</h3>
        </div>
        <div className="flex-1 overflow-auto">
          {wordBooks.map((book) => (
            <div
              key={book.id}
              onClick={() => setSelectedBookId(book.id)}
              className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedBookId === book.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOutlined className="text-blue-500" />
                <span className="font-medium text-gray-800">{book.name}</span>
              </div>
              {book.description && (
                <p className="text-sm text-gray-500 mt-1 truncate">{book.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content - Word List */}
      <div className="flex-1 bg-gray-50 p-6 overflow-auto">
        {words.length === 0 ? (
          <Empty description="暂无单词，在阅读时点击生词即可添加" className="mt-20" />
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {wordBooks.find((b) => b.id === selectedBookId)?.name}
                <Tag className="ml-2">{words.length} 个单词</Tag>
              </h2>
              <Button icon={<ExportOutlined />}>导出</Button>
            </div>

            <List
              grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
              dataSource={words}
              loading={loading}
              renderItem={(word) => (
                <List.Item>
                  <Card
                    size="small"
                    className="w-full"
                    actions={[
                      <Popconfirm
                        title="确定删除这个单词吗？"
                        onConfirm={() => handleDeleteWord(word.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} size="small">
                          删除
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{word.word}</h3>
                        {word.phoneticUs && (
                          <p className="text-sm text-gray-500">/{word.phoneticUs}/</p>
                        )}
                      </div>
                      <Tag color={getLevelColor(word.level)}>{getLevelLabel(word.level)}</Tag>
                    </div>
                    {word.definitionCn && (
                      <p className="text-gray-600 mt-2 text-sm line-clamp-2">{word.definitionCn}</p>
                    )}
                    {word.context && (
                      <p className="text-gray-400 mt-2 text-xs italic line-clamp-1">
                        原文: {word.context}
                      </p>
                    )}
                  </Card>
                </List.Item>
              )}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default WordBookPage;

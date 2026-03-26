import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Empty, message, Popconfirm, Modal, Form, Input, Divider } from 'antd';
import { BookOutlined, DeleteOutlined, ExportOutlined, PlusOutlined, FileTextOutlined, SoundOutlined } from '@ant-design/icons';
import { WordBook, WordBookItem } from '../types';

const WordBookPage: React.FC = () => {
  const [wordBooks, setWordBooks] = useState<WordBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [words, setWords] = useState<WordBookItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 创建单词本弹窗
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);
  
  // 单词详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordBookItem | null>(null);

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
      const books = await window.electron.ipcRenderer.invoke('db:getWordBooks');
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
      const bookWords = await window.electron.ipcRenderer.invoke('db:getWordsInBook', bookId);
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
      await window.electron.ipcRenderer.invoke('db:removeWordFromBook', selectedBookId, wordId);
      message.success('删除成功');
      loadWordsInBook(selectedBookId);
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleCreateWordBook = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      
      await window.electron.ipcRenderer.invoke('db:addWordBook', {
        name: values.name,
        description: values.description || '',
        source: 'manual',
        createdAt: new Date().toISOString(),
      });
      
      message.success('单词本创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadWordBooks();
    } catch (error) {
      message.error('创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleExport = (format: 'txt' | 'csv' | 'json') => {
    if (words.length === 0) {
      message.warning('单词本为空，无法导出');
      return;
    }

    const bookName = wordBooks.find((b) => b.id === selectedBookId)?.name || '单词本';
    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'txt':
        content = words.map(w => {
          let line = `${w.word}`;
          if (w.phoneticUs) line += ` [${w.phoneticUs}]`;
          if (w.definitionCn) line += ` - ${w.definitionCn}`;
          if (w.context) line += `\n  原文: ${w.context}`;
          return line;
        }).join('\n\n');
        filename = `${bookName}.txt`;
        mimeType = 'text/plain';
        break;
      
      case 'csv':
        content = 'Word,Phonetic,Definition,Level,Context\n';
        content += words.map(w => {
          const row = [
            w.word,
            w.phoneticUs || '',
            (w.definitionCn || '').replace(/,/g, ';'),
            w.level,
            (w.context || '').replace(/,/g, ';'),
          ];
          return row.map(field => `"${field}"`).join(',');
        }).join('\n');
        filename = `${bookName}.csv`;
        mimeType = 'text/csv';
        break;
      
      case 'json':
        content = JSON.stringify(words.map(w => ({
          word: w.word,
          phonetic: w.phoneticUs,
          definition: w.definitionCn,
          level: w.level,
          context: w.context,
        })), null, 2);
        filename = `${bookName}.json`;
        mimeType = 'application/json';
        break;
    }

    // 创建下载链接
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(`已导出为 ${format.toUpperCase()} 格式`);
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

  // 播放单词发音
  const playWordPronunciation = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
      message.warning('您的浏览器不支持语音播放');
    }
  };

  // 显示单词详情
  const showWordDetail = (word: WordBookItem) => {
    setSelectedWord(word);
    setDetailModalVisible(true);
  };

  // 关闭单词详情
  const closeWordDetail = () => {
    setDetailModalVisible(false);
    setSelectedWord(null);
  };

  return (
    <div className="h-full flex">
      {/* Sidebar - Word Book List */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-medium text-gray-700">单词本列表</h3>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建
          </Button>
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
              <div className="flex gap-2">
                <Button 
                  icon={<FileTextOutlined />}
                  onClick={() => handleExport('txt')}
                >
                  导出 TXT
                </Button>
                <Button 
                  icon={<ExportOutlined />}
                  onClick={() => handleExport('csv')}
                >
                  导出 CSV
                </Button>
                <Button 
                  icon={<ExportOutlined />}
                  onClick={() => handleExport('json')}
                >
                  导出 JSON
                </Button>
              </div>
            </div>

            <List
              grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
              dataSource={words}
              loading={loading}
              renderItem={(word) => (
                <List.Item>
                  <Card
                    size="small"
                    className="w-full cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => showWordDetail(word)}
                    actions={[
                      <Button
                        type="text"
                        icon={<SoundOutlined />}
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          playWordPronunciation(word.word);
                        }}
                      >
                        朗读
                      </Button>,
                      <Popconfirm
                        title="确定删除这个单词吗？"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          handleDeleteWord(word.id);
                        }}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button 
                          type="text" 
                          danger 
                          icon={<DeleteOutlined />} 
                          size="small"
                          onClick={(e) => e.stopPropagation()}
                        >
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

      {/* 创建单词本弹窗 */}
      <Modal
        title="创建新单词本"
        open={createModalVisible}
        onOk={handleCreateWordBook}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        confirmLoading={creating}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="单词本名称"
            rules={[{ required: true, message: '请输入单词本名称' }]}
          >
            <Input placeholder="例如：雅思词汇" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述（可选）"
          >
            <Input.TextArea rows={3} placeholder="添加一些描述..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 单词详情弹窗 */}
      <Modal
        title={null}
        open={detailModalVisible}
        onCancel={closeWordDetail}
        footer={[
          <Button key="close" onClick={closeWordDetail}>
            关闭
          </Button>,
          <Button
            key="play"
            type="primary"
            icon={<SoundOutlined />}
            onClick={() => selectedWord && playWordPronunciation(selectedWord.word)}
          >
            朗读
          </Button>,
        ]}
        width={500}
      >
        {selectedWord && (
          <div className="py-4">
            {/* 单词标题 */}
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-3xl font-bold text-gray-800">{selectedWord.word}</h2>
              <Tag color={getLevelColor(selectedWord.level)}>
                {getLevelLabel(selectedWord.level)}
              </Tag>
            </div>

            {/* 音标 */}
            {(selectedWord.phoneticUs || selectedWord.phoneticUk) && (
              <div className="mb-4 text-gray-600">
                {selectedWord.phoneticUs && (
                  <span className="mr-4">美 /{selectedWord.phoneticUs}/</span>
                )}
                {selectedWord.phoneticUk && (
                  <span>英 /{selectedWord.phoneticUk}/</span>
                )}
              </div>
            )}

            <Divider />

            {/* 释义 */}
            {selectedWord.definitionCn && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">中文释义</h4>
                <p className="text-gray-800 leading-relaxed">{selectedWord.definitionCn}</p>
              </div>
            )}

            {selectedWord.definitionEn && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">英文释义</h4>
                <p className="text-gray-800 leading-relaxed">{selectedWord.definitionEn}</p>
              </div>
            )}

            {/* 原文上下文 */}
            {selectedWord.context && (
              <>
                <Divider />
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">原文上下文</h4>
                  <p className="text-gray-600 italic bg-gray-50 p-3 rounded">
                    "{selectedWord.context}"
                  </p>
                </div>
              </>
            )}

            {/* 添加时间 */}
            <Divider />
            <div className="text-xs text-gray-400">
              添加于: {new Date(selectedWord.addedAt).toLocaleString('zh-CN')}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WordBookPage;

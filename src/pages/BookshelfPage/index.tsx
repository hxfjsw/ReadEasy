import { useState } from 'react';
import { Button, Empty, List, Spin, Tag } from 'antd';
import { ReadOutlined, PlusOutlined } from '@ant-design/icons';
import WordPopup from '../../components/WordPopup';
import { useBookshelf } from './hooks/useBookshelf';
import { useWordExtraction } from './hooks/useWordExtraction';
import { BookCard } from './components/BookCard';
import { BookDetailModal } from './components/BookDetailModal';
import { WordExtractModal } from './components/WordExtractModal';
import type { BookshelfPageProps } from './types';

const BookshelfPage: React.FC<BookshelfPageProps> = ({ onOpenBook }) => {
  const [wordPopupVisible, setWordPopupVisible] = useState(false);
  const [selectedWordForPopup, setSelectedWordForPopup] = useState('');

  const {
    books,
    loading,
    selectedBook,
    detailModalOpen,
    setDetailModalOpen,
    handleDeleteBook,
    handleAddBook,
    handleOpenBook,
    showBookDetail,
  } = useBookshelf();

  const {
    extractModalOpen,
    setExtractModalOpen,
    extractLoading,
    extractedWords,
    selectedWords,
    setSelectedWords,
    excludedCount,
    extractPageSize,
    setExtractPageSize,
    extractSortOrder,
    setExtractSortOrder,
    loadingDefinitions,
    ignoringInvalidWords,
    ignoredInvalidCount,
    openExtractWordsModal,
    batchLoadDefinitions,
    handleIgnoreInvalidWords,
    handleAddSelectedWords,
  } = useWordExtraction(selectedBook);

  const handleOpenBookWithCallback = (book: Parameters<typeof handleOpenBook>[0]) => {
    handleOpenBook(book, onOpenBook);
  };

  const handleExtractWords = (book: Parameters<typeof openExtractWordsModal>[0]) => {
    showBookDetail(book);
    openExtractWordsModal(book);
  };

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
                <BookCard
                  book={book}
                  onOpenBook={handleOpenBookWithCallback}
                  onExtractWords={handleExtractWords}
                  onShowDetail={showBookDetail}
                  onDeleteBook={handleDeleteBook}
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* 书籍详情弹窗 */}
      <BookDetailModal
        open={detailModalOpen}
        book={selectedBook}
        onClose={() => setDetailModalOpen(false)}
        onRead={handleOpenBookWithCallback}
      />

      {/* 单词提取弹窗 */}
      <WordExtractModal
        open={extractModalOpen}
        bookName={selectedBook?.bookName || ''}
        extractedWords={extractedWords}
        selectedWords={selectedWords}
        onSelectedWordsChange={setSelectedWords}
        excludedCount={excludedCount}
        ignoredInvalidCount={ignoredInvalidCount}
        extractLoading={extractLoading}
        loadingDefinitions={loadingDefinitions}
        ignoringInvalidWords={ignoringInvalidWords}
        extractPageSize={extractPageSize}
        extractSortOrder={extractSortOrder}
        onPageSizeChange={setExtractPageSize}
        onSortOrderChange={setExtractSortOrder}
        onLoadDefinitions={() => batchLoadDefinitions(extractedWords)}
        onIgnoreInvalidWords={handleIgnoreInvalidWords}
        onAddToMastered={handleAddSelectedWords}
        onClose={() => {
          setExtractModalOpen(false);
          setSelectedWords([]);
        }}
        onViewWord={handleViewWord}
      />

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

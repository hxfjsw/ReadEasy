import { Modal, Button, Select, Spin, Empty, Table, Tooltip, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { ExtractedWord } from '../types';

interface WordExtractModalProps {
  open: boolean;
  bookName: string;
  extractedWords: ExtractedWord[];
  selectedWords: string[];
  onSelectedWordsChange: (words: string[]) => void;
  excludedCount: number;
  ignoredInvalidCount: number;
  extractLoading: boolean;
  loadingDefinitions: boolean;
  ignoringInvalidWords: boolean;
  extractPageSize: number;
  extractSortOrder: 'original' | 'alphabetical' | 'frequency';
  onPageSizeChange: (size: number) => void;
  onSortOrderChange: (order: 'original' | 'alphabetical' | 'frequency') => void;
  onLoadDefinitions: () => void;
  onIgnoreInvalidWords: () => void;
  onAddToMastered: () => void;
  onClose: () => void;
  onViewWord: (word: string) => void;
}

export const WordExtractModal: React.FC<WordExtractModalProps> = ({
  open,
  bookName,
  extractedWords,
  selectedWords,
  onSelectedWordsChange,
  excludedCount,
  ignoredInvalidCount,
  extractLoading,
  loadingDefinitions,
  ignoringInvalidWords,
  extractPageSize,
  extractSortOrder,
  onPageSizeChange,
  onSortOrderChange,
  onLoadDefinitions,
  onIgnoreInvalidWords,
  onAddToMastered,
  onClose,
  onViewWord,
}) => {
  return (
    <Modal
      title={`提取单词 - ${bookName || ''}`}
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="ignore-invalid"
          loading={ignoringInvalidWords}
          disabled={ignoringInvalidWords || extractedWords.length === 0}
          onClick={onIgnoreInvalidWords}
          danger
        >
          排除无效词
        </Button>,
        <Button
          key="load-definitions"
          loading={loadingDefinitions}
          disabled={loadingDefinitions || extractedWords.length === 0}
          onClick={onLoadDefinitions}
        >
          加载全部释义
        </Button>,
        <Button 
          key="add" 
          type="primary" 
          icon={<CheckCircleOutlined />}
          disabled={selectedWords.length === 0}
          onClick={onAddToMastered}
        >
          添加到熟词本 ({selectedWords.length})
        </Button>,
      ]}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            共提取到 <strong>{extractedWords.length + excludedCount}</strong> 个单词
            {excludedCount > 0 && `（其中 ${excludedCount} 个在熟词本中已排除）`}
            {ignoredInvalidCount > 0 && `，已排除 ${ignoredInvalidCount} 个无效词到废词本`}
          </span>
          <div className="flex items-center gap-4">
            <Select
              size="small"
              value={extractSortOrder}
              onChange={onSortOrderChange}
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
              onChange={onPageSizeChange}
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
                onChange: (selectedRowKeys) => onSelectedWordsChange(selectedRowKeys as string[]),
              }}
              columns={[
                {
                  title: '单词',
                  dataIndex: 'word',
                  key: 'word',
                  width: 150,
                  render: (word: string, record: ExtractedWord) => (
                    <Tooltip title={record.example ? `"${record.example}"` : '无例句'} placement="topLeft" mouseEnterDelay={0.5}>
                      <span className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => onViewWord(word)}>
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
  );
};

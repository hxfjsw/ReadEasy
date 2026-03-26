import { useState, useEffect } from 'react';
import { Button, List, Card, Empty, Input, message, Popconfirm, Tag, Statistic, Row, Col } from 'antd';
import { DeleteOutlined, SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';

const MasteredWordsPage: React.FC = () => {
  const [masteredWords, setMasteredWords] = useState<string[]>([]);
  const [filteredWords, setFilteredWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 加载熟词本
  const loadMasteredWords = async () => {
    try {
      setLoading(true);
      const words = await window.electron.ipcRenderer.invoke('db:getMasteredWords');
      setMasteredWords(words);
      setFilteredWords(words);
    } catch (error) {
      console.error('加载熟词本失败:', error);
      message.error('加载熟词本失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasteredWords();
  }, []);

  // 搜索过滤
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredWords(masteredWords);
    } else {
      const filtered = masteredWords.filter(word => 
        word.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredWords(filtered);
    }
  }, [searchTerm, masteredWords]);

  // 移除熟词
  const handleRemove = async (word: string) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('db:removeMasteredWord', word);
      if (result) {
        message.success(`"${word}" 已从熟词本移除`);
        loadMasteredWords();
      } else {
        message.error('移除失败');
      }
    } catch (error) {
      console.error('移除熟词失败:', error);
      message.error('移除失败');
    }
  };

  // 清空所有熟词
  const handleClearAll = async () => {
    try {
      // 逐个删除所有熟词
      for (const word of masteredWords) {
        await window.electron.ipcRenderer.invoke('db:removeMasteredWord', word);
      }
      message.success('已清空熟词本');
      loadMasteredWords();
    } catch (error) {
      console.error('清空熟词本失败:', error);
      message.error('清空失败');
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CheckCircleOutlined className="text-2xl text-green-500" />
          <h1 className="text-2xl font-bold">熟词本</h1>
          <Tag color="green">{masteredWords.length} 个单词</Tag>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="搜索单词..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          {masteredWords.length > 0 && (
            <Popconfirm
              title="确定清空熟词本？"
              description="此操作不可恢复，所有熟词将被移除。"
              onConfirm={handleClearAll}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger>清空</Button>
            </Popconfirm>
          )}
        </div>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="熟词总数"
              value={masteredWords.length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="搜索结果"
              value={filteredWords.length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="说明"
              value="阅读器中不再标记为生词"
              valueStyle={{ fontSize: 14, color: '#666' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 单词列表 */}
      <Card className="flex-1 overflow-hidden">
        {filteredWords.length === 0 ? (
          <Empty
            description={
              searchTerm 
                ? '没有找到匹配的单词' 
                : '熟词本为空，阅读时可将已掌握的单词标记为熟词'
            }
            className="mt-20"
          />
        ) : (
          <List
            loading={loading}
            dataSource={filteredWords}
            renderItem={(word) => (
              <List.Item
                actions={[
                  <Popconfirm
                    key="remove"
                    title="确定移除？"
                    description={`将 "${word}" 从熟词本移除，该单词将再次标记为生词。`}
                    onConfirm={() => handleRemove(word)}
                    okText="移除"
                    cancelText="取消"
                  >
                    <Button 
                      type="text" 
                      danger 
                      icon={<DeleteOutlined />}
                    >
                      移除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<span className="text-lg font-medium">{word}</span>}
                  description="已掌握，阅读时不会标记为生词"
                />
              </List.Item>
            )}
            pagination={{
              pageSize: 20,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 个单词`,
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default MasteredWordsPage;

import { useState, useEffect } from 'react';
import { Button, List, Card, Empty, Input, message, Popconfirm, Tag, Upload, Pagination } from 'antd';
import { DeleteOutlined, SearchOutlined, CheckCircleOutlined, PlusOutlined, DownloadOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons';


const MasteredWordsPage: React.FC = () => {
  const [masteredWords, setMasteredWords] = useState<string[]>([]);
  const [filteredWords, setFilteredWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newWord, setNewWord] = useState('');
  const [adding, setAdding] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);


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
    
    // 监听熟词本更新事件（从其他页面添加单词时触发刷新）
    const handleRefresh = () => {
      loadMasteredWords();
    };
    window.addEventListener('masteredWordsUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('masteredWordsUpdated', handleRefresh);
    };
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
    // 搜索时重置到第一页
    setCurrentPage(1);
  }, [searchTerm, masteredWords]);

  // 计算当前页数据
  const paginatedWords = filteredWords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 添加单个单词
  const handleAddWord = async () => {
    if (!newWord.trim()) {
      message.warning('请输入单词');
      return;
    }
    
    setAdding(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('db:addMasteredWord', newWord.trim());
      if (result.success) {
        if (result.existed) {
          message.info(`"${newWord}" 已经是熟词`);
        } else {
          message.success(`"${newWord}" 已添加到熟词本`);
          setNewWord('');
          loadMasteredWords();
        }
      } else {
        message.error('添加失败');
      }
    } catch (error) {
      console.error('添加熟词失败:', error);
      message.error('添加失败');
    } finally {
      setAdding(false);
    }
  };

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

  // 导出熟词本
  const handleExport = () => {
    if (masteredWords.length === 0) {
      message.warning('熟词本为空，无法导出');
      return;
    }

    const content = masteredWords.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `熟词本_${masteredWords.length}个单词.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success('熟词本已导出');
  };

  // 导入熟词本
  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      // 支持换行、逗号、分号分隔
      const words = text
        .split(/[\n,;]/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w && /^[a-zA-Z]+$/.test(w));
      
      if (words.length === 0) {
        message.warning('文件中没有找到有效的单词');
        return false;
      }

      let addedCount = 0;
      let existedCount = 0;

      for (const word of words) {
        const result = await window.electron.ipcRenderer.invoke('db:addMasteredWord', word);
        if (result.success) {
          if (result.existed) {
            existedCount++;
          } else {
            addedCount++;
          }
        }
      }

      loadMasteredWords();
      message.success(`导入完成：新增 ${addedCount} 个，已存在 ${existedCount} 个`);
      return false; // 阻止默认上传行为
    } catch (error) {
      console.error('导入失败:', error);
      message.error('导入失败');
      return false;
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
          <Button 
            icon={<ReloadOutlined />}
            onClick={loadMasteredWords}
            loading={loading}
          >
            刷新
          </Button>
          <Button 
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={masteredWords.length === 0}
          >
            导出
          </Button>
          <Upload
            accept=".txt,.csv,.json"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button icon={<UploadOutlined />}>导入</Button>
          </Upload>
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

      {/* 添加单词 */}
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <Input
            placeholder="输入单词添加到熟词本..."
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onPressEnter={handleAddWord}
            style={{ width: 300 }}
          />
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleAddWord}
            loading={adding}
          >
            添加
          </Button>
          <span className="text-gray-400 text-sm">按 Enter 快速添加</span>
        </div>
      </Card>

      {/* 单词列表 */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        {filteredWords.length === 0 ? (
          <Empty
            description={
              searchTerm 
                ? '没有找到匹配的单词' 
                : '熟词本为空，阅读时可将已掌握的单词标记为熟词，或手动添加'
            }
            className="mt-20"
          />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <List
                loading={loading}
                dataSource={paginatedWords}
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
                    />
                  </List.Item>
                )}
                pagination={false}
              />
            </div>
            {/* 自定义分页 */}
            <div className="flex justify-center mt-4 pt-4 border-t">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredWords.length}
                showSizeChanger
                showQuickJumper
                pageSizeOptions={['20', '50', '100', '200']}
                onChange={(page, size) => {
                  setCurrentPage(page);
                  if (size !== pageSize) {
                    setPageSize(size);
                    setCurrentPage(1);
                  }
                }}
                showTotal={(total, range) => 
                  `第 ${range[0]}-${range[1]} 条，共 ${total} 个单词`
                }
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default MasteredWordsPage;

import { useState, useEffect } from 'react';
import { Button, List, Card, Empty, Input, message, Popconfirm, Tag, Upload, Pagination, Spin, Tooltip } from 'antd';
import { DeleteOutlined, SearchOutlined, DeleteFilled, PlusOutlined, DownloadOutlined, UploadOutlined, ReloadOutlined, SoundOutlined } from '@ant-design/icons';

interface WordDetail {
  word: string;
  phoneticUs?: string;
  phoneticUk?: string;
  definitionCn?: string;
  tag?: string;
  frq?: number;
  source?: string;
}

const IgnoredWordsPage: React.FC = () => {
  const [ignoredWords, setIgnoredWords] = useState<string[]>([]);
  const [filteredWords, setFilteredWords] = useState<string[]>([]);
  const [wordDetails, setWordDetails] = useState<Map<string, WordDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newWord, setNewWord] = useState('');
  const [adding, setAdding] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 加载废词本
  const loadIgnoredWords = async () => {
    try {
      setLoading(true);
      const words = await window.electron.ipcRenderer.invoke('db:getIgnoredWords');
      setIgnoredWords(words);
      setFilteredWords(words);
      // 加载单词详情
      await loadWordDetails(words);
    } catch (error) {
      console.error('加载废词本失败:', error);
      message.error('加载废词本失败');
    } finally {
      setLoading(false);
    }
  };

  // 批量加载单词详情（从 ECDICT）
  const loadWordDetails = async (words: string[]) => {
    if (words.length === 0) return;
    setDetailsLoading(true);
    try {
      // 使用 ECDICT 批量查询
      const result = await window.electron.ipcRenderer.invoke('ecdict:batchLookup', words);
      if (result?.success && result.data) {
        const details = new Map<string, WordDetail>();
        Object.entries(result.data).forEach(([key, value]: [string, any]) => {
          details.set(key, {
            word: value.word,
            phoneticUs: value.phoneticUs,
            phoneticUk: value.phoneticUk,
            definitionCn: value.definitionCn,
            tag: value.tag,
            frq: value.frq,
          });
        });
        setWordDetails(details);
      }
    } catch (error) {
      console.error('加载单词详情失败:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  // 播放单词发音
  const playPronunciation = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
      message.warning('您的浏览器不支持语音播放');
    }
  };

  // 解析 tag 为标签数组
  const parseTags = (tagString?: string): string[] => {
    if (!tagString) return [];
    return tagString.split(/\s+/).filter(t => t);
  };

  useEffect(() => {
    loadIgnoredWords();
  }, []);

  // 搜索过滤
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredWords(ignoredWords);
    } else {
      const filtered = ignoredWords.filter(word => 
        word.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredWords(filtered);
    }
    // 搜索时重置到第一页
    setCurrentPage(1);
  }, [searchTerm, ignoredWords]);

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
      const result = await window.electron.ipcRenderer.invoke('db:addIgnoredWord', newWord.trim());
      if (result.success) {
        if (result.existed) {
          message.info(`"${newWord}" 已经在废词本中`);
        } else {
          message.success(`"${newWord}" 已添加到废词本`);
          setNewWord('');
          loadIgnoredWords();
        }
      } else {
        message.error('添加失败');
      }
    } catch (error) {
      console.error('添加废词失败:', error);
      message.error('添加失败');
    } finally {
      setAdding(false);
    }
  };

  // 移除废词
  const handleRemove = async (word: string) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('db:removeIgnoredWord', word);
      if (result) {
        message.success(`"${word}" 已从废词本移除`);
        loadIgnoredWords();
      } else {
        message.error('移除失败');
      }
    } catch (error) {
      console.error('移除废词失败:', error);
      message.error('移除失败');
    }
  };

  // 清空所有废词
  const handleClearAll = async () => {
    try {
      for (const word of ignoredWords) {
        await window.electron.ipcRenderer.invoke('db:removeIgnoredWord', word);
      }
      message.success('已清空废词本');
      loadIgnoredWords();
    } catch (error) {
      console.error('清空废词本失败:', error);
      message.error('清空失败');
    }
  };

  // 导出废词本
  const handleExport = () => {
    if (ignoredWords.length === 0) {
      message.warning('废词本为空，无法导出');
      return;
    }

    const content = ignoredWords.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `废词本_${ignoredWords.length}个单词.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success('废词本已导出');
  };

  // 导入废词本
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
        const result = await window.electron.ipcRenderer.invoke('db:addIgnoredWord', word);
        if (result.success) {
          if (result.existed) {
            existedCount++;
          } else {
            addedCount++;
          }
        }
      }

      loadIgnoredWords();
      message.success(`导入完成：新增 ${addedCount} 个，已存在 ${existedCount} 个`);
      return false; // 阻止默认上传行为
    } catch (error) {
      console.error('导入失败:', error);
      message.error('导入失败');
      return false;
    }
  };

  // Tag 标签映射
  const tagLabels: Record<string, string> = {
    'zk': '中考',
    'gk': '高考',
    'cet4': '四级',
    'cet6': '六级',
    'ky': '考研',
    'ielts': '雅思',
    'toefl': '托福',
    'gre': 'GRE',
    'tem8': '专八',
    'oxford': '牛津3000',
    'collins': '柯林斯',
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DeleteFilled className="text-2xl text-red-500" />
          <h1 className="text-2xl font-bold">废词本</h1>
          <Tag color="red">{ignoredWords.length} 个单词</Tag>
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
            onClick={loadIgnoredWords}
            loading={loading}
          >
            刷新
          </Button>
          <Button 
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={ignoredWords.length === 0}
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
          {ignoredWords.length > 0 && (
            <Popconfirm
              title="确定清空废词本？"
              description="此操作不可恢复，所有废词将被移除。"
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
            placeholder="输入单词添加到废词本..."
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
            danger
          >
            添加
          </Button>
          <span className="text-gray-400 text-sm">按 Enter 快速添加</span>
        </div>
      </Card>

      {/* 说明卡片 */}
      <Card className="mb-6 bg-yellow-50 border-yellow-200">
        <div className="text-sm text-gray-600">
          <p className="font-medium text-yellow-700 mb-2">💡 废词本说明：</p>
          <p>废词本用于存放拼写错误、作者自创词或不需要学习的单词。</p>
          <p>在提取单词时，点击"排除无效词"按钮可将 ECDICT 词典中找不到的单词自动加入废词本。</p>
        </div>
      </Card>

      {/* 单词列表 */}
      <Card className="flex-1 flex flex-col" bodyStyle={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {filteredWords.length === 0 ? (
          <Empty
            description={
              searchTerm 
                ? '没有找到匹配的单词' 
                : '废词本为空，提取单词时可一键排除无效词，或手动添加'
            }
            className="mt-20"
          />
        ) : (
          <>
            <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
              <Spin spinning={detailsLoading} tip="加载单词详情...">
                <List
                  loading={loading}
                  dataSource={paginatedWords}
                  renderItem={(word) => {
                    const detail = wordDetails.get(word.toLowerCase());
                    const tags = parseTags(detail?.tag);
                    const hasDefinition = !!detail?.definitionCn;
                    
                    return (
                      <List.Item
                        actions={[
                          <Tooltip title="朗读" key="sound">
                            <Button
                              type="text"
                              icon={<SoundOutlined />}
                              onClick={() => playPronunciation(word)}
                            />
                          </Tooltip>,
                          <Popconfirm
                            key="remove"
                            title="确定移除？"
                            description={`将 "${word}" 从废词本移除。`}
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
                          title={
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg font-medium">{word}</span>
                              {detail?.phoneticUs && (
                                <span className="text-gray-500 text-sm">/{detail.phoneticUs}/</span>
                              )}
                              {/* 词频标签 */}
                              {detail?.frq && detail.frq > 0 && detail.frq <= 5000 && (
                                <Tooltip title={`词频排名: ${detail.frq}`}>
                                  <Tag color="blue" className="text-xs">Frq: {detail.frq}</Tag>
                                </Tooltip>
                              )}
                              {/* 等级标签 */}
                              {tags.map(tag => (
                                <Tag key={tag} color="green" className="text-xs">
                                  {tagLabels[tag] || tag}
                                </Tag>
                              ))}
                              {/* 是否找到释义标记 */}
                              {hasDefinition ? (
                                <Tag color="success" className="text-xs">✓ 有效词</Tag>
                              ) : (
                                <Tag color="error" className="text-xs">✗ 无效词</Tag>
                              )}
                            </div>
                          }
                          description={
                            detail?.definitionCn ? (
                              <span className="text-gray-600 text-sm line-clamp-1">
                                {detail.definitionCn}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm italic">
                                未找到释义（ECDICT 中不存在）
                              </span>
                            )
                          }
                        />
                      </List.Item>
                    );
                  }}
                  pagination={false}
                />
              </Spin>
            </div>
            {/* 自定义分页 */}
            <div className="flex justify-center mt-4 pt-4 border-t border-gray-200">
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

export default IgnoredWordsPage;

import { useState, useEffect } from 'react';
import { Modal, Spin, Button, Tag, message, Select } from 'antd';
import { PlusOutlined, BookOutlined, SoundOutlined, CloseOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { WordDefinition, WordBook, Word } from '../types';

interface WordPopupProps {
  word: string;
  context?: string;
  visible: boolean;
  onClose: () => void;
  onPlayPronunciation?: (word: string) => void;
  mode?: 'modal' | 'sidebar';
  bookName?: string; // 当前书籍名称，用于自动创建单词本
  onMasteredStatusChange?: (word: string, isMastered: boolean) => void; // 熟词状态变化回调
}

const WordPopup: React.FC<WordPopupProps> = ({ 
  word, 
  context, 
  visible, 
  onClose, 
  onPlayPronunciation,
  mode = 'modal',
  bookName,
  onMasteredStatusChange
}) => {
  const [loading, setLoading] = useState(false);
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [wordBooks, setWordBooks] = useState<WordBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [addingToBook, setAddingToBook] = useState(false);
  const [source, setSource] = useState<'wordbook' | 'ai' | null>(null);
  const [isMastered, setIsMastered] = useState(false);
  const [masteringWord, setMasteringWord] = useState(false);

  // 获取单词定义和熟词状态
  useEffect(() => {
    if (visible && word) {
      fetchDefinition();
      fetchWordBooks();
      checkMasteredStatus();
    }
  }, [visible, word]);
  
  // 检查是否是熟词
  const checkMasteredStatus = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('db:isMasteredWord', word.toLowerCase());
      setIsMastered(result);
    } catch (error) {
      console.error('检查熟词状态失败:', error);
    }
  };

  // 将数据库单词转换为 WordDefinition 格式
  const convertWordToDefinition = (wordData: Word): WordDefinition => {
    // 解析中文释义（格式可能是 "pos meaning; pos meaning" 或 JSON）
    let definitions: Array<{pos: string; meaningCn: string; meaningEn: string; examples: string[]}> = [];
    
    try {
      // 尝试解析为 JSON
      const parsed = JSON.parse(wordData.definitionCn || '[]');
      if (Array.isArray(parsed)) {
        definitions = parsed;
      } else {
        // 旧格式：用分号分隔
        definitions = (wordData.definitionCn || '').split('; ').map((def) => ({
          pos: def.split(' ')[0] || '',
          meaningCn: def.split(' ').slice(1).join(' ') || def,
          meaningEn: '',
          examples: [],
        }));
      }
    } catch {
      // 解析失败，使用简单分割
      definitions = (wordData.definitionCn || '').split('; ').map((def) => ({
        pos: def.split(' ')[0] || '',
        meaningCn: def.split(' ').slice(1).join(' ') || def,
        meaningEn: '',
        examples: [],
      }));
    }

    // 解析词根分析
    let rootAnalysis = wordData.rootAnalysis;
    if (typeof rootAnalysis === 'string' && rootAnalysis) {
      try {
        rootAnalysis = JSON.parse(rootAnalysis);
      } catch {
        rootAnalysis = undefined;
      }
    }

    // 解析相关词
    let relatedWords = wordData.relatedWords;
    if (typeof relatedWords === 'string' && relatedWords) {
      try {
        relatedWords = JSON.parse(relatedWords);
      } catch {
        relatedWords = undefined;
      }
    }

    return {
      word: wordData.word,
      phoneticUk: wordData.phoneticUk,
      phoneticUs: wordData.phoneticUs,
      definitions: definitions.filter(d => d.meaningCn),
      level: wordData.level,
      etymology: wordData.etymology,
      rootAnalysis,
      relatedWords,
      contextAnalysis: undefined, // 单词本中的单词可能没有上下文分析
      contextTranslation: undefined,
      synonyms: [],
      antonyms: [],
    };
  };

  const fetchDefinition = async () => {
    setLoading(true);
    setSource(null);
    
    try {
      // 1. 先查询单词本
      const wordFromDB = await window.electron.ipcRenderer.invoke('db:getWord', word.toLowerCase());
      
      if (wordFromDB) {
        console.log('[WordPopup] 从单词本找到单词:', wordFromDB);
        setDefinition(convertWordToDefinition(wordFromDB));
        setSource('wordbook');
        setLoading(false);
        return;
      }
      
      // 2. 单词本中没有，调用 AI 接口
      console.log('[WordPopup] 单词本中未找到，调用 AI 接口:', word);
      const result = await window.electron.ipcRenderer.invoke('ai:defineWord', {
        word,
        context,
      });
      
      if (result.success) {
        setDefinition(result.data);
        setSource('ai');
        // 自动保存到以书名命名的单词本
        await autoSaveToBookByName(result.data);
      } else {
        message.error('获取单词定义失败: ' + (result.message || result.error || '未知错误'));
      }
    } catch (error) {
      message.error('获取单词定义失败');
    } finally {
      setLoading(false);
    }
  };

  // 标记为熟词
  const handleMarkAsMastered = async () => {
    if (!word) return;
    
    setMasteringWord(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('db:addMasteredWord', word.toLowerCase());
      if (result.success) {
        setIsMastered(true);
        message.success(`"${word}" 已标记为熟词`);
        onMasteredStatusChange?.(word, true);
      } else {
        message.error('标记熟词失败');
      }
    } catch (error) {
      console.error('标记熟词失败:', error);
      message.error('标记熟词失败');
    } finally {
      setMasteringWord(false);
    }
  };
  
  // 取消熟词标记
  const handleUnmarkAsMastered = async () => {
    if (!word) return;
    
    try {
      const result = await window.electron.ipcRenderer.invoke('db:removeMasteredWord', word.toLowerCase());
      if (result) {
        setIsMastered(false);
        message.success(`"${word}" 已取消熟词标记`);
        onMasteredStatusChange?.(word, false);
      } else {
        message.error('取消熟词标记失败');
      }
    } catch (error) {
      console.error('取消熟词标记失败:', error);
      message.error('取消熟词标记失败');
    }
  };

  // 自动保存到以书名命名的单词本（没有则创建）
  const autoSaveToBookByName = async (def: WordDefinition) => {
    if (!bookName) {
      console.log('没有书名，跳过自动保存');
      return;
    }
    
    try {
      // 1. 查找是否已存在该书名的单词本
      const books = await window.electron.ipcRenderer.invoke('db:getWordBooks');
      let targetBook = books.find((b: WordBook) => b.name === bookName);
      
      // 2. 不存在则创建
      if (!targetBook) {
        console.log(`创建新单词本: ${bookName}`);
        const result = await window.electron.ipcRenderer.invoke('db:addWordBook', {
          name: bookName,
          description: `《${bookName}》阅读时自动收藏的单词`,
        });
        if (result && result.success) {
          // 重新获取单词本列表
          const updatedBooks = await window.electron.ipcRenderer.invoke('db:getWordBooks');
          targetBook = updatedBooks.find((b: WordBook) => b.name === bookName);
        }
      }
      
      if (!targetBook) {
        console.error('创建单词本失败');
        return;
      }
      
      // 3. 添加单词到单词本
      const wordResult = await window.electron.ipcRenderer.invoke('db:addWord', {
        word: def.word,
        phoneticUk: def.phoneticUk,
        phoneticUs: def.phoneticUs,
        definitionCn: JSON.stringify(def.definitions),
        definitionEn: '',
        level: def.level || 'unknown',
        source: 'user',
        etymology: def.etymology,
        rootAnalysis: def.rootAnalysis,
        relatedWords: def.relatedWords,
      });

      if (wordResult && wordResult.success) {
        await window.electron.ipcRenderer.invoke('db:addWordToBook', 
          targetBook.id, 
          wordResult.id,
          context,
          def.contextAnalysis,
          def.contextTranslation
        );
        message.success(`已自动保存到"${targetBook.name}"`);
      }
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  };

  const fetchWordBooks = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('db:getWordBooks');
      setWordBooks(result);
      if (result.length > 0 && !selectedBookId) {
        setSelectedBookId(result[0].id);
      }
    } catch (error) {
      console.error('获取单词本失败:', error);
    }
  };

  const handleAddToWordBook = async () => {
    if (!selectedBookId) {
      message.warning('请先选择单词本');
      return;
    }
    if (!definition) {
      message.warning('单词定义尚未加载完成');
      return;
    }

    setAddingToBook(true);
    try {
      const wordResult = await window.electron.ipcRenderer.invoke('db:addWord', {
        word: definition.word,
        phoneticUk: definition.phoneticUk,
        phoneticUs: definition.phoneticUs,
        definitionCn: JSON.stringify(definition.definitions),
        definitionEn: '',
        level: definition.level || 'unknown',
        source: 'user',
        etymology: definition.etymology,
        rootAnalysis: definition.rootAnalysis,
        relatedWords: definition.relatedWords,
      });

      if (wordResult && wordResult.success) {
        await window.electron.ipcRenderer.invoke('db:addWordToBook', 
          selectedBookId, 
          wordResult.id,
          context,
          definition.contextAnalysis,
          definition.contextTranslation
        );
        message.success(`已将 "${word}" 添加到单词本`);
        onClose();
      }
    } catch (error) {
      message.error('添加到单词本失败');
    } finally {
      setAddingToBook(false);
    }
  };

  const renderSourceBadge = () => {
    if (!source) return null;
    
    if (source === 'wordbook') {
      return <Tag color="green">来自单词本</Tag>;
    }
    return <Tag color="blue">AI 解析</Tag>;
  };

  const renderDefinition = () => {
    if (!definition) return null;

    return (
      <div className="space-y-4">
        {/* 单词标题 */}
        <div className="border-b pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold">{definition.word}</h2>
            {definition.level && (
              <Tag color="blue">{definition.level}</Tag>
            )}
            {isMastered && (
              <Tag color="green" icon={<CheckCircleOutlined />}>熟词</Tag>
            )}
            {renderSourceBadge()}
            {onPlayPronunciation && (
              <Button
                type="text"
                icon={<SoundOutlined />}
                onClick={() => onPlayPronunciation(definition.word)}
                title="播放发音"
              />
            )}
          </div>
          <div className="flex gap-4 text-gray-500 mt-1">
            {definition.phoneticUk && (
              <span>英 {definition.phoneticUk}</span>
            )}
            {definition.phoneticUs && (
              <span>美 {definition.phoneticUs}</span>
            )}
          </div>
        </div>

        {/* 释义 */}
        <div>
          <h3 className="font-semibold mb-2">释义</h3>
          <div className="space-y-2">
            {definition.definitions.map((def, index) => (
              <div key={index} className="flex gap-2">
                <Tag color="default">{def.pos}</Tag>
                <div>
                  <div className="text-gray-800">{def.meaningCn}</div>
                  {def.meaningEn && (
                    <div className="text-gray-500 text-sm">{def.meaningEn}</div>
                  )}
                  {def.examples && def.examples.length > 0 && (
                    <div className="mt-1 text-gray-600 text-sm italic">
                      {def.examples[0]}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 词源和词根词缀分析 */}
        {(definition.etymology || definition.rootAnalysis) && (
          <div className="bg-purple-50 p-3 rounded border-l-4 border-purple-400">
            <div className="text-purple-600 text-sm mb-2 font-medium">词源与词根词缀</div>
            
            {/* 词源 */}
            {definition.etymology && (
              <div className="mb-2 text-gray-700 text-sm">
                <span className="font-medium">词源: </span>{definition.etymology}
              </div>
            )}
            
            {/* 词根词缀拆解 */}
            {definition.rootAnalysis && (
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  {definition.rootAnalysis.prefix && (
                    <div className="flex items-center">
                      <span className="text-blue-600 font-bold">{definition.rootAnalysis.prefix.value}</span>
                      <span className="text-gray-400 mx-1">+</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="text-red-600 font-bold">{definition.rootAnalysis.root.value}</span>
                    {definition.rootAnalysis.root.origin && (
                      <span className="text-xs text-gray-400 ml-1">({definition.rootAnalysis.root.origin})</span>
                    )}
                  </div>
                  {definition.rootAnalysis.suffix && (
                    <div className="flex items-center">
                      <span className="text-gray-400 mx-1">+</span>
                      <span className="text-green-600 font-bold">{definition.rootAnalysis.suffix.value}</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {definition.rootAnalysis.prefix && (
                    <div>前缀 <strong>{definition.rootAnalysis.prefix.value}</strong>: {definition.rootAnalysis.prefix.meaning}</div>
                  )}
                  <div>词根 <strong>{definition.rootAnalysis.root.value}</strong>: {definition.rootAnalysis.root.meaning}</div>
                  {definition.rootAnalysis.suffix && (
                    <div>后缀 <strong>{definition.rootAnalysis.suffix.value}</strong>: {definition.rootAnalysis.suffix.meaning}</div>
                  )}
                  <div className="mt-1 text-gray-700 italic">{definition.rootAnalysis.explanation}</div>
                </div>
              </div>
            )}
            
            {/* 相关词 */}
            {definition.relatedWords && definition.relatedWords.length > 0 && (
              <div className="mt-2 pt-2 border-t border-purple-200">
                <div className="text-xs text-purple-500 mb-1">相关词汇</div>
                <div className="flex flex-wrap gap-2">
                  {definition.relatedWords.map((rw, index) => (
                    <div key={index} className="bg-white px-2 py-1 rounded text-xs">
                      <span className="font-medium text-gray-800">{rw.word}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-500">{rw.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 同义词/反义词 */}
        {(definition.synonyms?.length || definition.antonyms?.length) && (
          <div className="flex gap-4">
            {definition.synonyms && definition.synonyms.length > 0 && (
              <div>
                <span className="text-gray-500">同义词: </span>
                {definition.synonyms.map(s => (
                  <Tag key={s} className="text-xs">{s}</Tag>
                ))}
              </div>
            )}
            {definition.antonyms && definition.antonyms.length > 0 && (
              <div>
                <span className="text-gray-500">反义词: </span>
                {definition.antonyms.map(a => (
                  <Tag key={a} className="text-xs">{a}</Tag>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 上下文分析和翻译 */}
        {context && (
          <div className="space-y-3">
            {/* 原文上下文 */}
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-gray-500 text-sm mb-1">原文上下文</div>
              <div className="text-gray-700 italic">{context}</div>
            </div>

            {/* 上下文翻译 */}
            {definition.contextTranslation && (
              <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                <div className="text-blue-600 text-sm mb-1 font-medium">上下文翻译</div>
                <div className="text-gray-800">{definition.contextTranslation}</div>
              </div>
            )}

            {/* 上下文分析 */}
            {definition.contextAnalysis && (
              <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                <div className="text-green-600 text-sm mb-1 font-medium">上下文分析</div>
                <div className="text-gray-800 leading-relaxed">{definition.contextAnalysis}</div>
              </div>
            )}
          </div>
        )}

        {/* 熟词操作 */}
        <div className="border-t pt-4 mt-4">
          {isMastered ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircleOutlined />
                <span>已掌握该单词</span>
              </div>
              <Button onClick={handleUnmarkAsMastered}>
                取消熟词
              </Button>
            </div>
          ) : (
            <Button
              icon={<CheckCircleOutlined />}
              loading={masteringWord}
              onClick={handleMarkAsMastered}
              block
            >
              标记为熟词（不再提示）
            </Button>
          )}
        </div>

        {/* 添加到单词本 - 仅 AI 来源时显示 */}
        {source === 'ai' && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-3 flex-wrap">
              <BookOutlined />
              <span>添加到单词本:</span>
              <Select
                style={{ width: 150 }}
                placeholder="选择单词本"
                value={selectedBookId}
                onChange={setSelectedBookId}
                options={wordBooks.map(book => ({
                  label: book.name,
                  value: book.id,
                }))}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                loading={addingToBook}
                onClick={handleAddToWordBook}
                disabled={!selectedBookId}
              >
                添加
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 侧边栏模式
  if (mode === 'sidebar') {
    if (!visible) return null;
    
    return (
      <div className="w-96 h-full border-l bg-white flex flex-col">
        {/* 头部 */}
        <div className="h-14 border-b flex items-center justify-between px-4 bg-gray-50">
          <span className="font-medium text-gray-700">单词详情</span>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={onClose}
          />
        </div>
        
        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spin size="large" tip="查询中..." />
            </div>
          ) : (
            renderDefinition()
          )}
        </div>
      </div>
    );
  }

  // 弹框模式
  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" tip="查询中..." />
        </div>
      ) : (
        renderDefinition()
      )}
    </Modal>
  );
};

export default WordPopup;

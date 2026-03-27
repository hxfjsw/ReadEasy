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
  bookName?: string;
  onMasteredStatusChange?: (word: string, isMastered: boolean) => void;
}

// 加载状态类型
type LoadingStage = 'idle' | 'basic' | 'detailed' | 'complete';

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
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const [basicDef, setBasicDef] = useState<Partial<WordDefinition> | null>(null);
  const [detailedDef, setDetailedDef] = useState<Partial<WordDefinition> | null>(null);
  const [wordBooks, setWordBooks] = useState<WordBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [addingToBook, setAddingToBook] = useState(false);
  const [source, setSource] = useState<'wordbook' | 'ai' | null>(null);
  const [isMastered, setIsMastered] = useState(false);
  const [masteringWord, setMasteringWord] = useState(false);

  // 获取单词定义和熟词状态
  useEffect(() => {
    if (visible && word) {
      fetchDefinitionStepByStep();
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
    let definitions: Array<{pos: string; meaningCn: string; meaningEn: string; examples: string[]}> = [];
    
    try {
      const parsed = JSON.parse(wordData.definitionCn || '[]');
      if (Array.isArray(parsed)) {
        definitions = parsed;
      } else {
        definitions = (wordData.definitionCn || '').split('; ').map((def) => ({
          pos: def.split(' ')[0] || '',
          meaningCn: def.split(' ').slice(1).join(' ') || def,
          meaningEn: '',
          examples: [],
        }));
      }
    } catch {
      definitions = (wordData.definitionCn || '').split('; ').map((def) => ({
        pos: def.split(' ')[0] || '',
        meaningCn: def.split(' ').slice(1).join(' ') || def,
        meaningEn: '',
        examples: [],
      }));
    }

    let rootAnalysis = wordData.rootAnalysis;
    if (typeof rootAnalysis === 'string' && rootAnalysis) {
      try {
        rootAnalysis = JSON.parse(rootAnalysis);
      } catch {
        rootAnalysis = undefined;
      }
    }

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
      contextAnalysis: undefined,
      contextTranslation: undefined,
      synonyms: [],
      antonyms: [],
    };
  };

  // 分步获取单词定义
  const fetchDefinitionStepByStep = async () => {
    setLoadingStage('basic');
    setBasicDef(null);
    setDetailedDef(null);
    setSource(null);
    
    try {
      // 1. 先查询单词本
      const wordFromDB = await window.electron.ipcRenderer.invoke('db:getWord', word.toLowerCase());
      
      if (wordFromDB) {
        console.log('[WordPopup] 从单词本找到单词:', wordFromDB);
        const fullDef = convertWordToDefinition(wordFromDB);
        setBasicDef(fullDef);
        setDetailedDef(fullDef);
        setSource('wordbook');
        setLoadingStage('complete');
        return;
      }
      
      // 2. 单词本中没有，先获取基础定义（快速显示）
      console.log('[WordPopup] 获取基础定义:', word);
      const basicResult = await window.electron.ipcRenderer.invoke('ai:defineWordBasic', {
        word,
      });
      
      if (basicResult.success) {
        setBasicDef(basicResult.data);
        setSource('ai');
        setLoadingStage('detailed');
        
        // 3. 获取详细定义（词源、词根等）
        console.log('[WordPopup] 获取详细定义:', word);
        const detailedResult = await window.electron.ipcRenderer.invoke('ai:defineWordDetailed', {
          word,
          context,
        });
        
        if (detailedResult.success) {
          setDetailedDef(detailedResult.data);
          
          // 合并定义用于保存
          const fullDefinition: WordDefinition = {
            ...(basicResult.data as WordDefinition),
            ...detailedResult.data,
          };
          
          // 自动保存到单词本
          await autoSaveToBookByName(fullDefinition);
        }
      } else {
        message.error('获取单词定义失败: ' + (basicResult.message || basicResult.error || '未知错误'));
      }
    } catch (error) {
      console.error('[WordPopup] 获取定义失败:', error);
      message.error('获取单词定义失败');
    } finally {
      setLoadingStage('complete');
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

  // 自动保存到以书名命名的单词本
  const autoSaveToBookByName = async (def: WordDefinition) => {
    if (!bookName) return;
    
    try {
      const books = await window.electron.ipcRenderer.invoke('db:getWordBooks');
      let targetBook = books.find((b: WordBook) => b.name === bookName);
      
      if (!targetBook) {
        const result = await window.electron.ipcRenderer.invoke('db:addWordBook', {
          name: bookName,
          description: `《${bookName}》阅读时自动收藏的单词`,
        });
        if (result && result.success) {
          const updatedBooks = await window.electron.ipcRenderer.invoke('db:getWordBooks');
          targetBook = updatedBooks.find((b: WordBook) => b.name === bookName);
        }
      }
      
      if (!targetBook) return;
      
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
    
    const definition = basicDef || detailedDef;
    if (!definition) {
      message.warning('单词定义尚未加载完成');
      return;
    }

    setAddingToBook(true);
    try {
      const fullDef: WordDefinition = {
        ...(basicDef || {}),
        ...(detailedDef || {}),
      } as WordDefinition;
      
      const wordResult = await window.electron.ipcRenderer.invoke('db:addWord', {
        word: fullDef.word,
        phoneticUk: fullDef.phoneticUk,
        phoneticUs: fullDef.phoneticUs,
        definitionCn: JSON.stringify(fullDef.definitions),
        definitionEn: '',
        level: fullDef.level || 'unknown',
        source: 'user',
        etymology: fullDef.etymology,
        rootAnalysis: fullDef.rootAnalysis,
        relatedWords: fullDef.relatedWords,
      });

      if (wordResult && wordResult.success) {
        await window.electron.ipcRenderer.invoke('db:addWordToBook', 
          selectedBookId, 
          wordResult.id,
          context,
          fullDef.contextAnalysis,
          fullDef.contextTranslation
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

  // 渲染基础定义（始终显示）
  const renderBasicDefinition = () => {
    if (!basicDef) return null;

    return (
      <div className="border-b pb-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold">{basicDef.word || word}</h2>
          {basicDef.level && (
            <Tag color="blue">{basicDef.level}</Tag>
          )}
          {isMastered && (
            <Tag color="green" icon={<CheckCircleOutlined />}>熟词</Tag>
          )}
          {renderSourceBadge()}
          {onPlayPronunciation && (
            <Button
              type="text"
              icon={<SoundOutlined />}
              onClick={() => onPlayPronunciation(basicDef.word || word)}
              title="播放发音"
            />
          )}
        </div>
        <div className="flex gap-4 text-gray-500 mt-1">
          {basicDef.phoneticUk && (
            <span>英 {basicDef.phoneticUk}</span>
          )}
          {basicDef.phoneticUs && (
            <span>美 {basicDef.phoneticUs}</span>
          )}
        </div>
        
        {/* 释义 */}
        {basicDef.definitions && basicDef.definitions.length > 0 && (
          <div className="mt-3">
            <h3 className="font-semibold mb-2">释义</h3>
            <div className="space-y-2">
              {basicDef.definitions.map((def, index) => (
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
        )}
      </div>
    );
  };

  // 渲染详细定义（加载完成后显示）
  const renderDetailedDefinition = () => {
    if (!detailedDef) return null;

    return (
      <div className="space-y-4">
        {/* 词源和词根词缀分析 */}
        {(detailedDef.etymology || detailedDef.rootAnalysis) && (
          <div className="bg-purple-50 p-3 rounded border-l-4 border-purple-400">
            <div className="text-purple-600 text-sm mb-2 font-medium">词源与词根词缀</div>
            
            {/* 词源 */}
            {detailedDef.etymology && (
              <div className="mb-2 text-gray-700 text-sm">
                <span className="font-medium">词源: </span>{detailedDef.etymology}
              </div>
            )}
            
            {/* 词根词缀拆解 */}
            {detailedDef.rootAnalysis && (
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  {detailedDef.rootAnalysis.prefix && (
                    <div className="flex items-center">
                      <span className="text-blue-600 font-bold">{detailedDef.rootAnalysis.prefix.value}</span>
                      <span className="text-gray-400 mx-1">+</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="text-red-600 font-bold">{detailedDef.rootAnalysis.root.value}</span>
                    {detailedDef.rootAnalysis.root.origin && (
                      <span className="text-xs text-gray-400 ml-1">({detailedDef.rootAnalysis.root.origin})</span>
                    )}
                  </div>
                  {detailedDef.rootAnalysis.suffix && (
                    <div className="flex items-center">
                      <span className="text-gray-400 mx-1">+</span>
                      <span className="text-green-600 font-bold">{detailedDef.rootAnalysis.suffix.value}</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {detailedDef.rootAnalysis.prefix && (
                    <div>前缀 <strong>{detailedDef.rootAnalysis.prefix.value}</strong>: {detailedDef.rootAnalysis.prefix.meaning}</div>
                  )}
                  <div>词根 <strong>{detailedDef.rootAnalysis.root.value}</strong>: {detailedDef.rootAnalysis.root.meaning}</div>
                  {detailedDef.rootAnalysis.suffix && (
                    <div>后缀 <strong>{detailedDef.rootAnalysis.suffix.value}</strong>: {detailedDef.rootAnalysis.suffix.meaning}</div>
                  )}
                  <div className="mt-1 text-gray-700 italic">{detailedDef.rootAnalysis.explanation}</div>
                </div>
              </div>
            )}
            
            {/* 相关词 */}
            {detailedDef.relatedWords && detailedDef.relatedWords.length > 0 && (
              <div className="mt-2 pt-2 border-t border-purple-200">
                <div className="text-xs text-purple-500 mb-1">相关词汇</div>
                <div className="flex flex-wrap gap-2">
                  {detailedDef.relatedWords.map((rw, index) => (
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
        {(detailedDef.synonyms?.length || detailedDef.antonyms?.length) && (
          <div className="flex gap-4">
            {detailedDef.synonyms && detailedDef.synonyms.length > 0 && (
              <div>
                <span className="text-gray-500">同义词: </span>
                {detailedDef.synonyms.map(s => (
                  <Tag key={s} className="text-xs">{s}</Tag>
                ))}
              </div>
            )}
            {detailedDef.antonyms && detailedDef.antonyms.length > 0 && (
              <div>
                <span className="text-gray-500">反义词: </span>
                {detailedDef.antonyms.map(a => (
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
            {detailedDef.contextTranslation && (
              <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                <div className="text-blue-600 text-sm mb-1 font-medium">上下文翻译</div>
                <div className="text-gray-800">{detailedDef.contextTranslation}</div>
              </div>
            )}

            {/* 上下文分析 */}
            {detailedDef.contextAnalysis && (
              <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                <div className="text-green-600 text-sm mb-1 font-medium">上下文分析</div>
                <div className="text-gray-800 leading-relaxed">{detailedDef.contextAnalysis}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染加载状态指示器
  const renderLoadingIndicator = () => {
    if (loadingStage === 'complete' || loadingStage === 'idle') return null;
    
    return (
      <div className="flex items-center gap-2 text-gray-500 py-2">
        <Spin size="small" />
        <span className="text-sm">
          {loadingStage === 'basic' && '正在查询基础释义...'}
          {loadingStage === 'detailed' && '正在查询词源、词根分析...'}
        </span>
      </div>
    );
  };

  // 渲染熟词操作
  const renderMasteredSection = () => {
    if (!basicDef) return null;
    
    return (
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
    );
  };

  // 渲染添加到单词本
  const renderAddToBookSection = () => {
    if (source !== 'ai' || !basicDef) return null;
    
    return (
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
    );
  };

  // 渲染完整内容
  const renderContent = () => {
    if (loadingStage === 'idle' || (!basicDef && loadingStage !== 'complete')) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" tip="查询中..." />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {renderBasicDefinition()}
        {renderLoadingIndicator()}
        {renderDetailedDefinition()}
        {renderMasteredSection()}
        {renderAddToBookSection()}
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
          {renderContent()}
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
      destroyOnHidden
    >
      {renderContent()}
    </Modal>
  );
};

export default WordPopup;

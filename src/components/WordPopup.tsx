import { useState, useEffect } from 'react';
import { Modal, Spin, Button, Tag, message, Select } from 'antd';
import { PlusOutlined, BookOutlined, SoundOutlined } from '@ant-design/icons';
import type { WordDefinition, WordBook } from '../types';

interface WordPopupProps {
  word: string;
  context?: string;
  visible: boolean;
  onClose: () => void;
  onPlayPronunciation?: (word: string) => void;
}

const WordPopup: React.FC<WordPopupProps> = ({ word, context, visible, onClose, onPlayPronunciation }) => {
  const [loading, setLoading] = useState(false);
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [wordBooks, setWordBooks] = useState<WordBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [addingToBook, setAddingToBook] = useState(false);

  // 获取单词定义
  useEffect(() => {
    if (visible && word) {
      fetchDefinition();
      fetchWordBooks();
    }
  }, [visible, word]);

  const fetchDefinition = async () => {
    setLoading(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('ai:defineWord', {
        word,
        context,
      });
      if (result.success) {
        setDefinition(result.data);
      } else {
        message.error('获取单词定义失败: ' + (result.message || result.error || '未知错误'));
      }
    } catch (error) {
      message.error('获取单词定义失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchWordBooks = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('db:getWordBooks');
      setWordBooks(result);
      // 默认选择第一个单词本
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
      // 先添加单词到数据库
      const wordResult = await window.electron.ipcRenderer.invoke('db:addWord', {
        word: definition.word,
        phoneticUk: definition.phoneticUk,
        phoneticUs: definition.phoneticUs,
        definitionCn: definition.definitions.map(d => `${d.pos} ${d.meaningCn}`).join('; '),
        definitionEn: definition.definitions.map(d => d.meaningEn).join('; '),
        level: definition.level || 'unknown',
        source: 'user',
      });

      if (wordResult) {
        // 添加到单词本
        await window.electron.ipcRenderer.invoke('db:addWordToBook', 
          selectedBookId, 
          wordResult.id,
          context
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

  const renderDefinition = () => {
    if (!definition) return null;

    return (
      <div className="space-y-4">
        {/* 单词标题 */}
        <div className="border-b pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{definition.word}</h2>
            {definition.level && (
              <Tag color="blue">{definition.level}</Tag>
            )}
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
                  <div className="text-gray-500 text-sm">{def.meaningEn}</div>
                  {def.examples.length > 0 && (
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
                  {definition.relatedWords.map((rw, idx) => (
                    <div key={idx} className="bg-white px-2 py-1 rounded text-xs">
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

        {/* 添加到单词本 */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-3">
            <BookOutlined />
            <span>添加到单词本:</span>
            <Select
              style={{ width: 200 }}
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
      </div>
    );
  };

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

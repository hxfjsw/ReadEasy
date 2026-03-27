import { forwardRef } from 'react';
import { Button, Tag, Spin, Card, Divider } from 'antd';
import { CloseOutlined, TranslationOutlined } from '@ant-design/icons';

interface SentencePopupProps {
  selectedSentence: string;
  translatedSentence: string;
  sentenceTranslating: boolean;
  sentenceTranslateSource: 'google' | 'ai';

  onClose: () => void;
  onSwitchSource: (source: 'google' | 'ai') => void;
}

export const SentencePopup = forwardRef<HTMLDivElement, SentencePopupProps>(
  ({ selectedSentence, translatedSentence, sentenceTranslating, sentenceTranslateSource, onClose, onSwitchSource }, ref) => {
    return (
      <Card
        ref={ref}
        className="absolute z-50 shadow-lg max-w-md"
        style={{ top: '20%', left: '50%', transform: 'translateX(-50%)', minWidth: '320px' }}
        title={
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2"><TranslationOutlined />句子翻译</span>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">翻译源:</span>
            <Button size="small" type={sentenceTranslateSource === 'google' ? 'primary' : 'default'} onClick={() => onSwitchSource('google')}>Google</Button>
            <Button size="small" type={sentenceTranslateSource === 'ai' ? 'primary' : 'default'} onClick={() => onSwitchSource('ai')}>AI</Button>
          </div>
          <Divider className="my-2" />
          <div>
            <div className="text-xs text-gray-400 mb-1">原文</div>
            <div className="text-sm text-gray-800 leading-relaxed">{selectedSentence}</div>
          </div>
          <Divider className="my-2" />
          <div>
            <div className="text-xs text-gray-400 mb-1">译文 {sentenceTranslateSource === 'ai' && <Tag color="blue" className="text-xs">AI</Tag>}</div>
            {sentenceTranslating ? <Spin size="small" tip="翻译中..." /> : <div className="text-sm text-blue-700 leading-relaxed">{translatedSentence}</div>}
          </div>
        </div>
      </Card>
    );
  }
);

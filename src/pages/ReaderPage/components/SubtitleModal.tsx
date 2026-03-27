import React from 'react';
import { Modal, Table, Tag, Button, Progress } from 'antd';
import { SubtitleItem } from '../../../hooks/useReaderAudio';

interface SubtitleModalProps {
  open: boolean;
  subtitles: SubtitleItem[];
  isGenerating: boolean;
  progress: number;
  currentTime?: number;
  onClose: () => void;
  onGenerate: () => void;
}

export const SubtitleModal: React.FC<SubtitleModalProps> = ({
  open,
  subtitles,
  isGenerating,
  progress,
  currentTime,
  onClose,
  onGenerate,
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (index: number) => index + 1,
    },
    {
      title: '时间范围',
      key: 'timeRange',
      width: 150,
      render: (_: unknown, record: SubtitleItem) => (
        <span className="font-mono text-xs">
          {formatTime(record.startTime)} - {formatTime(record.endTime)}
        </span>
      ),
    },
    {
      title: '识别文本',
      dataIndex: 'text',
      key: 'text',
      render: (text: string) => (
        <span className={text ? 'text-gray-800' : 'text-gray-400 italic'}>
          {text || '(无内容)'}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: SubtitleItem) => {
        const isCurrent = currentTime !== undefined && 
          currentTime >= record.startTime && 
          currentTime < record.endTime;
        
        if (isCurrent) {
          return <Tag color="blue">当前</Tag>;
        }
        if (record.matched) {
          return <Tag color="green">已匹配</Tag>;
        }
        if (record.text) {
          return <Tag color="orange">未匹配</Tag>;
        }
        return <Tag>待识别</Tag>;
      },
    },
  ];

  const hasSubtitles = subtitles.length > 0;

  return (
    <Modal
      title="字幕列表"
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
    >
      <div className="space-y-4">
        {!hasSubtitles && !isGenerating && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">尚未生成字幕</p>
            <Button type="primary" onClick={onGenerate}>
              生成字幕
            </Button>
          </div>
        )}

        {isGenerating && (
          <div className="py-4">
            <p className="text-gray-600 mb-2">正在生成字幕...</p>
            <Progress percent={progress} status="active" />
          </div>
        )}

        {hasSubtitles && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                共 {subtitles.length} 条字幕
              </span>
              {currentTime !== undefined && (
                <span className="text-sm text-blue-500">
                  当前时间: {formatTime(currentTime)}
                </span>
              )}
            </div>
            <Table
              dataSource={subtitles}
              columns={columns}
              rowKey="index"
              size="small"
              scroll={{ y: 400 }}
              pagination={false}
              rowClassName={(record) => {
                if (currentTime !== undefined && 
                    currentTime >= record.startTime && 
                    currentTime < record.endTime) {
                  return 'bg-blue-50';
                }
                return '';
              }}
            />
          </>
        )}
      </div>
    </Modal>
  );
};

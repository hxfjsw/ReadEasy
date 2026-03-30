import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Space, message } from 'antd';
import { UploadOutlined, PlayCircleOutlined, DeleteOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

export interface AudioFileRecord {
  id: number;
  bookPath: string;
  audioPath: string;
  audioName: string;
  duration?: number;
  addedAt: Date;
  lastUsedAt: Date;
}

interface AudioSelectorModalProps {
  open: boolean;
  bookPath: string;
  bookName: string;
  onClose: () => void;
  onSelect: (audioPath: string) => void;
  onDelete?: (id: number) => void;
}

export const AudioSelectorModal: React.FC<AudioSelectorModalProps> = ({
  open,
  bookPath,
  bookName,
  onClose,
  onSelect,
  onDelete,
}) => {
  const [audioFiles, setAudioFiles] = useState<AudioFileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 加载该书籍的音频文件列表
  const loadAudioFiles = async () => {
    if (!bookPath) return;
    
    setLoading(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('audio:getByBook', bookPath);
      if (result.success) {
        // 按文件名排序
        const sorted = (result.data || []).sort((a: AudioFileRecord, b: AudioFileRecord) => 
          a.audioName.localeCompare(b.audioName)
        );
        setAudioFiles(sorted);
      } else {
        message.error('加载音频文件列表失败');
      }
    } catch (error) {
      console.error('加载音频文件列表失败:', error);
      message.error('加载音频文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && bookPath) {
      loadAudioFiles();
    }
  }, [open, bookPath]);

  // 格式化时间显示
  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 格式化日期显示
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN');
  };

  // 处理选择音频文件
  const handleSelect = async (record: AudioFileRecord) => {
    // 更新最后使用时间
    try {
      await window.electron.ipcRenderer.invoke('audio:updateLastUsed', record.id);
    } catch (error) {
      console.error('更新最后使用时间失败:', error);
    }
    onSelect(record.audioPath);
    onClose();
  };

  // 处理删除音频文件记录
  const handleDelete = async (record: AudioFileRecord) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('audio:delete', record.id);
      if (result.success) {
        message.success('删除成功');
        loadAudioFiles();
        onDelete?.(record.id);
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('删除音频文件记录失败:', error);
      message.error('删除失败');
    }
  };

  // 处理导入新音频文件
  const handleImport = async () => {
    try {
      setUploading(true);
      const result = await window.electron.ipcRenderer.invoke('file:open', {
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg'] },
          { name: 'MP3', extensions: ['mp3'] },
          { name: 'All Files', extensions: ['*'] },
        ]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const audioPath = result.filePaths[0];
        const audioName = audioPath.split(/[/\\]/).pop() || 'Unknown';
        
        // 添加到数据库
        const addResult = await window.electron.ipcRenderer.invoke('audio:add', {
          bookPath,
          audioPath,
          audioName,
        });
        
        if (addResult.success) {
          message.success('添加音频文件成功');
          loadAudioFiles();
          // 自动选择新导入的文件
          onSelect(audioPath);
          onClose();
        } else {
          message.error('添加音频文件失败');
        }
      }
    } catch (error) {
      console.error('导入音频文件失败:', error);
      message.error('导入音频文件失败');
    } finally {
      setUploading(false);
    }
  };

  const columns: ColumnsType<AudioFileRecord> = [
    {
      title: '文件名',
      dataIndex: 'audioName',
      key: 'audioName',
      render: (text) => (
        <Space>
          <CustomerServiceOutlined />
          <span className="font-medium">{text}</span>
        </Space>
      ),
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration) => formatDuration(duration),
    },
    {
      title: '添加时间',
      dataIndex: 'addedAt',
      key: 'addedAt',
      width: 120,
      render: (date) => formatDate(date),
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 120,
      render: (date) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleSelect(record)}
          >
            选择
          </Button>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={`有声书 - ${bookName || '选择音频文件'}`}
      open={open}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="import" type="primary" icon={<UploadOutlined />} onClick={handleImport} loading={uploading}>
          导入新音频
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
    >
      <div className="mb-4">
        <p className="text-gray-500 text-sm">
          当前书籍共 {audioFiles.length} 个音频文件
        </p>
      </div>
      
      <Table
        columns={columns}
        dataSource={audioFiles}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        locale={{
          emptyText: (
            <div className="py-8 text-center">
              <CustomerServiceOutlined className="text-4xl text-gray-300 mb-4" />
              <p className="text-gray-500">暂无音频文件</p>
              <p className="text-gray-400 text-sm mt-2">点击"导入新音频"添加音频文件</p>
            </div>
          ),
        }}
      />
    </Modal>
  );
};

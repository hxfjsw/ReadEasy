import { useState } from 'react';
import { Button, message, Tag, Spin, Empty } from 'antd';
import { UploadOutlined, FileTextOutlined } from '@ant-design/icons';


const ReaderPage: React.FC = () => {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);


  const handleFileSelect = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('file:open');
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        await loadFile(filePath);
      }
    } catch (error) {
      message.error('选择文件失败');
    }
  };

  const loadFile = async (filePath: string) => {
    setLoading(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('file:read', filePath);
      if (result.success) {
        setFileContent(result.data || '');
        const fileNameFromPath = filePath.split(/[\\/]/).pop();
        setFileName(fileNameFromPath || '');
        message.success('文件加载成功');
      } else {
        message.error('读取文件失败: ' + result.error);
      }
    } catch (error) {
      message.error('读取文件失败');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (!fileContent) {
      return (
        <Empty
          description="请选择或拖拽文件到此处"
          className="mt-20"
        >
          <Button type="primary" onClick={handleFileSelect} icon={<UploadOutlined />}>
            选择文件
          </Button>
        </Empty>
      );
    }

    return (
      <div className="reader-content p-8 max-w-4xl mx-auto bg-white min-h-full shadow-sm">
        <div className="mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800">{fileName}</h2>
        </div>
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {fileContent}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          <Button 
            icon={<UploadOutlined />} 
            onClick={handleFileSelect}
          >
            打开文件
          </Button>
          {fileName && (
            <Tag icon={<FileTextOutlined />} className="ml-2">
              {fileName}
            </Tag>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">支持 EPUB、MOBI、TXT 格式</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spin size="large" tip="加载中..." />
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default ReaderPage;

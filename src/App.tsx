import { useState, useEffect } from 'react';
import { Layout, Menu, Spin, message } from 'antd';
import {
  BookOutlined,
  ReadOutlined,
  SettingOutlined,
  BookFilled,
  CheckCircleOutlined,
} from '@ant-design/icons';
import ReaderPage from './pages/ReaderPage';
import WordBookPage from './pages/WordBookPage';
import SettingsPage from './pages/SettingsPage';
import BookshelfPage from './pages/BookshelfPage';
import MasteredWordsPage from './pages/MasteredWordsPage';
import { useSettingsStore } from './stores/settingsStore';

const { Sider, Content } = Layout;

type PageType = 'reader' | 'bookshelf' | 'wordbook' | 'mastered' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('bookshelf');
  const [loading, setLoading] = useState(true);
  const [pendingBookPath, setPendingBookPath] = useState<string | null>(null);
  const initializeSettings = useSettingsStore((state) => state.initialize);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeSettings();
      } catch (error) {
        console.error('Failed to initialize settings:', error);
        message.error('初始化设置失败');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [initializeSettings]);

  // 监听从书架打开书籍的事件
  useEffect(() => {
    const handleOpenBook = (event: CustomEvent<{ filePath: string }>) => {
      const { filePath } = event.detail;
      setPendingBookPath(filePath);
      setCurrentPage('reader');
    };

    window.addEventListener('openBookFromBookshelf', handleOpenBook as EventListener);
    return () => {
      window.removeEventListener('openBookFromBookshelf', handleOpenBook as EventListener);
    };
  }, []);

  const menuItems = [
    {
      key: 'bookshelf',
      icon: <BookFilled />,
      label: '书架',
    },
    {
      key: 'reader',
      icon: <ReadOutlined />,
      label: '阅读器',
    },
    {
      key: 'wordbook',
      icon: <BookOutlined />,
      label: '单词本',
    },
    {
      key: 'mastered',
      icon: <CheckCircleOutlined />,
      label: '熟词本',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
  ];

  const handleOpenBookFromBookshelf = (filePath: string) => {
    setPendingBookPath(filePath);
    setCurrentPage('reader');
  };

  // 渲染页面，使用 display:none 隐藏非活动页面以保留状态
  const renderPages = () => {
    return (
      <>
        <div style={{ display: currentPage === 'bookshelf' ? 'block' : 'none', height: '100%' }}>
          <BookshelfPage onOpenBook={handleOpenBookFromBookshelf} />
        </div>
        <div style={{ display: currentPage === 'reader' ? 'block' : 'none', height: '100%' }}>
          <ReaderPage 
            initialFilePath={pendingBookPath || undefined}
            onClearInitialFile={() => setPendingBookPath(null)}
          />
        </div>
        <div style={{ display: currentPage === 'wordbook' ? 'block' : 'none', height: '100%' }}>
          <WordBookPage />
        </div>
        <div style={{ display: currentPage === 'mastered' ? 'block' : 'none', height: '100%' }}>
          <MasteredWordsPage />
        </div>
        <div style={{ display: currentPage === 'settings' ? 'block' : 'none', height: '100%' }}>
          <SettingsPage />
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <Layout className="h-screen">
      <Sider
        width={200}
        theme="light"
        className="border-r border-gray-200"
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-600">ReadEasy</h1>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={({ key }) => setCurrentPage(key as PageType)}
          className="border-r-0"
        />
      </Sider>
      <Content className="bg-gray-50 overflow-hidden">
        {renderPages()}
      </Content>
    </Layout>
  );
}

export default App;

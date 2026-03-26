import { useState, useEffect } from 'react';
import { Layout, Menu, Spin, message } from 'antd';
import {
  BookOutlined,
  ReadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import ReaderPage from './pages/ReaderPage';
import WordBookPage from './pages/WordBookPage';
import SettingsPage from './pages/SettingsPage';
import { useSettingsStore } from './stores/settingsStore';

const { Sider, Content } = Layout;

type PageType = 'reader' | 'wordbook' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('reader');
  const [loading, setLoading] = useState(true);
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

  const menuItems = [
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
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'reader':
        return <ReaderPage />;
      case 'wordbook':
        return <WordBookPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <ReaderPage />;
    }
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
        {renderPage()}
      </Content>
    </Layout>
  );
}

export default App;

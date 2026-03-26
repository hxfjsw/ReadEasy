import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// 创建模拟的 Electron API
export const createMockElectron = () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
});

// 设置 mock Electron API
export const setupMockElectron = (mockElectron: ReturnType<typeof createMockElectron>) => {
  Object.assign(window, { electron: mockElectron });
  return mockElectron;
};

// 创建 mock 阅读记录
export const createMockReadingRecord = (overrides = {}) => ({
  id: 1,
  bookName: 'Test Book',
  filePath: 'C:/test/book.epub',
  format: 'epub',
  progress: 50,
  currentPosition: '100',
  bookmarks: '[]',
  lastReadAt: new Date().toISOString(),
  ...overrides,
});

// 创建 mock 书籍数据
export const createMockBook = (overrides = {}) => ({
  title: 'Test Book',
  author: 'Test Author',
  content: 'This is test content.',
  chapters: [
    { id: '1', title: 'Chapter 1', content: 'Chapter 1 content' },
  ],
  ...overrides,
});

// 创建 mock 单词定义
export const createMockWordDefinition = (overrides = {}) => ({
  word: 'test',
  phoneticUk: '/test/',
  phoneticUs: '/test/',
  definitions: [
    {
      pos: 'noun',
      meaningCn: '测试',
      meaningEn: 'a procedure intended to establish quality',
      examples: ['This is a test.'],
    },
  ],
  level: 'cet4',
  ...overrides,
});

// 自定义 render 函数
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { ...options });

export * from '@testing-library/react';
export { customRender as render };

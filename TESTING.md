# 自动化测试指南

本项目使用 [Vitest](https://vitest.dev/) 作为测试框架，配合 Testing Library 进行 React 组件测试。

## 快速开始

```bash
# 运行所有测试
npm test

# 运行测试并监视文件变化（开发模式）
npm run test:watch

# 打开 UI 界面查看测试结果
npm run test:ui

# 生成覆盖率报告
npm run test:coverage
```

## 测试结构

```
src/
├── test/
│   ├── setup.ts          # 测试环境设置
│   └── test-utils.tsx    # 测试工具函数
├── pages/
│   ├── BookshelfPage.tsx
│   └── BookshelfPage.test.tsx  # 组件测试
├── types/
│   ├── index.ts
│   └── index.test.tsx    # 类型测试
└── ...

electron/
├── ipc/handlers/
│   ├── index.ts
│   └── handlers.test.ts  # IPC 测试
└── services/parser/
    ├── index.ts
    └── parser.test.ts    # 服务测试
```

## 测试示例

### 组件测试

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import BookshelfPage from './BookshelfPage';

describe('BookshelfPage', () => {
  it('应该显示书籍列表', async () => {
    render(<BookshelfPage />);
    
    expect(await screen.findByText('Test Book')).toBeInTheDocument();
  });
});
```

### 使用 Mock

```tsx
import { createMockElectron, setupMockElectron } from '../test/test-utils';

const mockElectron = setupMockElectron(createMockElectron());
mockElectron.ipcRenderer.invoke.mockResolvedValue({ success: true });
```

## 模拟的浏览器 API

测试环境中已自动模拟以下 API：

- `window.electron` - Electron IPC API
- `window.matchMedia` - CSS 媒体查询
- `window.speechSynthesis` - 语音合成
- `IntersectionObserver` - 元素可见性观察
- `ResizeObserver` - 元素大小变化观察

## 编写测试的最佳实践

1. **使用 `describe` 分组** - 按功能或组件组织测试
2. **清晰的测试描述** - 使用中文描述测试行为
3. **使用 `beforeEach` 清理** - 每个测试前重置 mock
4. **异步测试使用 `waitFor`** - 等待组件渲染完成
5. **优先使用 `screen` 查询** - 比 `container` 更推荐

## CI/CD

GitHub Actions 配置在 `.github/workflows/test.yml`，每次 push 到 main/develop 分支或提交 PR 时会自动运行测试。

## 常见问题

### Q: 测试中出现 `matchMedia` 错误？
A: 已在 `setup.ts` 中自动模拟，无需额外配置。

### Q: 如何测试 Electron IPC 调用？
A: 使用 `setupMockElectron()` 创建 mock，然后验证 `invoke` 被调用。

### Q: 测试 Ant Design 组件出现警告？
A: 这是正常的，某些组件在测试环境下会有警告，不影响测试结果。

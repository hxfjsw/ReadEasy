# ReadEasy

一款专为英语学习者设计的 Windows 桌面应用程序，帮助用户更流畅地阅读外文文本，建立个性化的单词本。

## 功能特性

- 📚 **多格式支持**：支持 EPUB、MOBI、TXT 格式电子书及网页内容
- 🎯 **生词高亮**：根据用户词汇水平自动高亮显示生词
- 🔍 **智能查词**：点击生词即可查看详细释义、音标、例句
- 💾 **单词本管理**：一键收藏生词，支持分类管理和导出
- 🤖 **AI 辅助**：支持 OpenAI 兼容接口，智能分析词汇难度、生成例句
- 🎨 **个性化设置**：支持主题切换、字体调整、阅读进度记录

## 技术栈

- **桌面框架**：Electron
- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI 组件库**：Ant Design + Tailwind CSS
- **状态管理**：Zustand
- **本地存储**：SQLite (better-sqlite3)
- **ORM**：Drizzle ORM

## 开发环境

### 前置要求

- Node.js 18+
- npm 9+
- Windows 10/11

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
# 构建所有平台
npm run electron:build

# 仅构建 Windows 版本
npm run electron:build:win
```

## AI 服务配置

ReadEasy 支持 OpenAI 兼容接口，可配置以下服务提供商：

| 提供商 | Base URL |
|--------|----------|
| OpenAI | `https://api.openai.com/v1` |
| Azure OpenAI | `https://{resource}.openai.azure.com/openai/deployments/{deployment}` |
| Anthropic | `https://api.anthropic.com/v1` |
| 自定义 | 用户配置的兼容端点 |

在设置面板中配置 API Key 和模型参数即可使用 AI 功能。

## 项目结构

```
ReadEasy/
├── electron/           # Electron 主进程
│   ├── main.ts        # 主进程入口
│   ├── preload.ts     # 预加载脚本
│   ├── ipc/           # IPC 处理器
│   └── services/      # 主进程服务
│       ├── database/  # 数据库服务
│       ├── ai/        # AI 服务
│       └── parser/    # 电子书解析
├── src/               # 渲染进程 (React)
│   ├── components/    # 组件
│   ├── pages/         # 页面
│   ├── hooks/         # 自定义 Hooks
│   ├── services/      # 前端服务
│   ├── stores/        # 状态管理
│   ├── types/         # 类型定义
│   └── utils/         # 工具函数
├── resources/         # 静态资源
└── docs/              # 文档
```

## 词汇等级

支持以下词汇等级设置：

- 小学 (elementary)
- 初中 (middle)
- 高中 (high)
- 四级 (cet4)
- 六级 (cet6)
- 考研 (postgraduate)
- 雅思 (ielts)
- 托福 (toefl)
- GRE (gre)
- 专八 (tem8)

## 许可证

ISC

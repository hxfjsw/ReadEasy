# ReadEasy

一款专为英语学习者设计的 Windows 桌面应用程序，帮助用户更流畅地阅读外文文本，建立个性化的单词本并进行练习。

## 功能特性

### 📚 阅读体验
- **多格式支持**：EPUB、MOBI、TXT 格式电子书
- **生词高亮**：根据词汇水平自动高亮显示生词（小学到专八）
- **点击查词**：点击生词即可查看详细释义、音标、例句
- **AI 解析**：词源、词根词缀、上下文智能分析
- **阅读进度**：自动记录阅读位置和书签

### 🎯 单词本
- **一键收藏**：阅读时点击生词快速加入单词本
- **分类管理**：支持创建多个单词本，按书籍/主题分类
- **熟词标记**：已掌握的单词可标记为熟词，不再高亮
- **数据导出**：支持导出为 TXT、CSV、JSON 格式

### 📝 单词练习
- **语境练习**：基于原文上下文选择正确释义
- **智能筛选**：全部/新词/复习/错题 多种练习模式
- **掌握度追踪**：陌生→模糊→认识→掌握 四级掌握度
- **练习统计**：正确率、练习历史记录

### 🎧 有声书
- **音频播放**：支持导入 MP3 等音频文件
- **实时字幕**：AI 语音识别生成同步字幕（Whisper）
- **字幕翻译**：支持实时翻译为中文字幕
- **点击查词**：点击字幕中的单词即可查词

### 🤖 AI 辅助
支持 OpenAI 兼容接口，可配置：
- **智能查词**：详细的单词释义、用法分析
- **词汇分析**：分析书籍词汇难度分布
- **例句生成**：根据单词生成适合水平的例句
- **翻译服务**：长句翻译和字幕翻译

## 技术栈

- **桌面框架**：Electron + TypeScript
- **前端框架**：React 18 + Vite
- **UI 组件**：Ant Design + Tailwind CSS
- **本地存储**：SQLite (better-sqlite3)
- **语音识别**：Whisper Web (Transformers.js)
- **TTS**：Web Speech API

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

### 运行测试

```bash
# 单元测试
npm test

# E2E 测试
npm run test:e2e
```

## AI 服务配置

在设置面板中配置以下参数：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| Provider | 服务提供商 | openai / azure / anthropic |
| Base URL | API 基础地址 | https://api.openai.com/v1 |
| API Key | 访问密钥 | sk-... |
| Model | 模型名称 | gpt-3.5-turbo |

支持 OpenAI 兼容接口，包括：
- OpenAI
- Azure OpenAI
- Anthropic
- LM Studio 等本地模型

## 词汇等级

支持以下词汇等级设置，自动高亮超出水平的单词：

| 等级 | 说明 |
|------|------|
| elementary | 小学 |
| middle | 初中 |
| high | 高中 |
| cet4 | 四级 |
| cet6 | 六级 |
| postgraduate | 考研 |
| ielts | 雅思 |
| toefl | 托福 |
| gre | GRE |
| tem8 | 专八 |

## 项目结构

```
ReadEasy/
├── electron/               # Electron 主进程
│   ├── main.ts            # 主进程入口
│   ├── preload.ts         # 预加载脚本
│   ├── ipc/               # IPC 通信处理器
│   └── services/          # 主进程服务
│       ├── database/      # SQLite 数据库服务
│       ├── ai/            # AI 服务集成
│       ├── translation/   # 翻译服务
│       └── parser/        # 电子书解析
├── src/                   # 渲染进程 (React)
│   ├── components/        # 公共组件
│   ├── pages/             # 页面组件
│   │   ├── BookshelfPage.tsx      # 书架
│   │   ├── ReaderPage/            # 阅读器
│   │   ├── WordBookPage/          # 单词本
│   │   │   └── practice/          # 练习功能
│   │   └── SettingsPage.tsx       # 设置
│   ├── hooks/             # 自定义 Hooks
│   ├── types/             # TypeScript 类型定义
│   └── utils/             # 工具函数
├── docs/                  # 设计文档
└── resources/             # 静态资源
```

## 数据存储

使用 SQLite 本地数据库，存储以下数据：
- 阅读记录和书签
- 单词本和单词数据
- AI 配置
- 练习记录和掌握度

数据位置：`%APPDATA%/ReadEasy/database/readeasy.db`

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `1-4` | 练习时选择答案 |
| `Enter` | 提交答案/继续下一题 |
| `Space` | 播放/暂停音频 |

## 许可证

ISC

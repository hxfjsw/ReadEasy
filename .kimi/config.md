# ReadEasy Kimi 配置

## 项目信息

- **名称**: ReadEasy
- **类型**: Electron + React + TypeScript 桌面阅读应用
- **技术栈**: Electron, React, TypeScript, Vite, TailwindCSS, Ant Design

## 开发工作流

### 1. 每次修改后必须执行

```bash
npm run build
```

**要求**: 
- 每次修改代码后，必须运行 `npm run build` 进行编译检查
- 确保 TypeScript 没有类型错误
- 确保 Vite 构建成功

### 2. 构建成功后再提交

```bash
git add -f <修改的文件>
git commit -m "描述"
```

**注意**: 
- 项目 `.gitignore` 忽略了 `src/` 和 `electron/`，需要使用 `-f` 强制添加
- 提交前确保构建无错误

### 3. 运行开发模式

```bash
npm run electron:dev
```

## 项目结构

```
├── electron/              # Electron 主进程
│   ├── main.ts           # 主进程入口
│   ├── preload.ts        # 预加载脚本
│   ├── ipc/              # IPC 处理器
│   └── services/         # 后端服务
├── src/                  # 前端源码
│   ├── hooks/            # React Hooks
│   ├── pages/            # 页面组件
│   ├── stores/           # Zustand 状态管理
│   └── types/            # TypeScript 类型
├── .kimi/                # Kimi 配置
└── package.json          # 项目配置
```

## Git 提交规范

- `feat:` 新功能
- `fix:` 修复问题
- `refactor:` 代码重构
- `docs:` 文档更新

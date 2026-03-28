# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

LLM Config Hub 是一个用于管理 LLM（大语言模型）配置的MacOS桌面应用，采用前后端分离架构。

## 开发命令

### 后端（FastAPI + SQLite）

```bash
cd backend
pip install -r requirements.txt
python run.py          # 启动后端，监听 http://localhost:8000，热重载
```

### 前端（React + TypeScript + Vite）

```bash
cd frontend
npm install
npm run dev            # 启动开发服务器，监听 http://localhost:5173
npm run build          # 类型检查 + 构建生产包（tsc -b && vite build）
npm run lint           # ESLint 检查
```

## 架构说明

### 后端分层结构

```
backend/app/
├── __init__.py          # create_app()：注册路由、CORS、在启动时自动建表
├── core/
│   ├── config.py        # Settings（pydantic-settings），读取 .env，默认 SQLite
│   └── database.py      # SQLAlchemy engine/session/Base，get_db() 依赖注入
├── models/              # SQLAlchemy ORM 模型（Config、Prompt）
├── schemas/             # Pydantic 请求/响应 schema（Create / Update / Response）
├── services/            # 业务逻辑（ConfigService、PromptService），被路由层调用
└── api/routes/          # FastAPI 路由（/api/configs、/api/prompts）
```

数据流：路由层 → Service 层 → ORM 模型 → SQLite。路由层只负责 HTTP 处理和 404 判断，业务逻辑在 Service 层。

### 前端结构

```
frontend/src/
├── App.tsx              # 根组件，Tab 切换 Configs / Prompts
├── types/index.ts       # 共享 TypeScript 类型定义
├── services/api.ts      # 所有 API 调用（fetch），统一封装
└── components/          # ConfigList、ConfigModal、PromptList、PromptModal
```

前端通过 Vite proxy 将 `/api` 请求转发到 `http://localhost:8000`，无需手动处理跨域。

### 数据库

SQLite 文件默认位于 `backend/llm_config_hub.db`，可通过 `DATABASE_URL` 环境变量（或 `backend/.env`）覆盖。表结构在应用启动时由 `Base.metadata.create_all()` 自动创建，无需手动迁移脚本。

### Config 模型字段

`name`、`model_name`（必填）、`temperature`（默认 0.7）、`max_tokens`（默认 1000）、`system_prompt`、`description`。

---

## UI 规范（shadcn-ui sm 尺寸基准）

全局采用 shadcn-ui `size="sm"` 组件体系，新增功能保持以下规范：

| 元素 | 规范 |
|------|------|
| 正文 / 标签 | `text-xs` |
| 标题（弹窗/卡片）| `text-sm font-semibold` |
| 图标 | `w-3.5 h-3.5`（操作图标）/ `w-4 h-4`（关闭按钮）|
| 按钮 | `size="sm"`；图标按钮 `h-7 w-7` |
| 弹窗 Header | `px-4 py-3 bg-gray-50 border-b border-gray-100` |
| 弹窗 Body | `p-4`，内部间距 `space-y-3` 或 `gap-3` |
| 卡片/列表项 | `px-3 py-2`，圆角 `rounded-lg`，边框 `border border-gray-200` |
| 输入框 | `h-8 text-xs px-2.5`（shadcn Input `size="sm"`）|
| Badge / Tag | `text-xs px-1.5 py-0.5 rounded` |
| 颜色语义 | 成功绿 `green-*`、远程紫 `purple-*`、主操作蓝 `blue-*`、危险红 `red-*` |

---

## macOS 应用图标更换流程

### 设计要点

- 画布尺寸：**1024 x 1024 像素**
- 图标有效区域：**824 x 824 像素**，距四边各留 **100px** 边距
- 圆角半径：**185.4px**（squircle 连续曲率，匹配 macOS 系统蒙版）
- **必须自己画圆角**，macOS 不像 iOS/iPadOS 那样自动裁剪图标形状，需在设计文件中预先应用圆角

### 生成 icns 标准流程

```bash
# 从 1024px 主图生成所有尺寸
mkdir -p /tmp/AppIcon.iconset
for size in 16 32 128 256 512; do
  sips -z $size $size icon_1024.png --out /tmp/AppIcon.iconset/icon_${size}x${size}.png
done
sips -z 32 32   icon_1024.png --out /tmp/AppIcon.iconset/icon_16x16@2x.png
sips -z 64 64   icon_1024.png --out /tmp/AppIcon.iconset/icon_32x32@2x.png
sips -z 256 256 icon_1024.png --out /tmp/AppIcon.iconset/icon_128x128@2x.png
sips -z 512 512 icon_1024.png --out /tmp/AppIcon.iconset/icon_256x256@2x.png
cp icon_1024.png /tmp/AppIcon.iconset/icon_512x512@2x.png

# 生成 icns（必须用 iconutil，不要用第三方工具）
iconutil -c icns /tmp/AppIcon.iconset -o src-tauri/icons/icon.icns

# 同步 PNG
cp /tmp/AppIcon.iconset/icon_32x32.png   src-tauri/icons/32x32.png
cp /tmp/AppIcon.iconset/icon_128x128.png src-tauri/icons/128x128.png
cp /tmp/AppIcon.iconset/icon_256x256.png src-tauri/icons/256x256.png
cp /tmp/AppIcon.iconset/icon_512x512.png src-tauri/icons/512x512.png
cp icon_1024.png                         src-tauri/icons/icon.png
```

### 注意事项

- **dev 模式不显示自定义图标**（无 `.app` bundle），必须 `npm run tauri:build` 后才能验证
- 更换后执行以下命令清除 macOS 图标缓存：

```bash
sudo rm -rf /Library/Caches/com.apple.iconservices.store && sudo killall iconservicesd; killall Dock
```

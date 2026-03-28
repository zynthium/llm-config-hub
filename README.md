# LLM Config Hub

本项目是一个 `Tauri v2 + React + TypeScript` 的桌面应用，用于本地管理多个大模型 API 配置，并支持导入到常见 AI 编辑器。

## 已实现功能

- 本地安全保存模型配置（`name/provider/baseUrl/apiKey/defaultModel`）
- macOS Keychain 托管主密钥，磁盘加密保存配置数据
- 本机导入适配：`Claude Code`、`Cursor`、`Codex`、`OpenClaw`
- SSH（密钥登录）远程导入配置到目标主机
- 从文本中解析 `apiKey/baseUrl/model/provider` 并一键入库
- 对单配置或全量配置做 key 可用性检测和错误归因

## 运行方式

```bash
npm install
npm run tauri:dev
```

仅前端调试：

```bash
npm run dev
```

## 构建与校验

```bash
npm run lint
npm run build
cd src-tauri && cargo check
```

## macOS 打包与签名说明

1. 本地打包：`npm run tauri:build`
2. 产物位于 `src-tauri/target/release/bundle/`
3. 若需要发布签名，请在本机配置苹果开发者证书后执行：
   - `codesign --deep --force --verify --verbose --sign \"Developer ID Application: <TEAM>\" <Your.app>`
   - `xcrun notarytool submit <Your.dmg|Your.pkg> --apple-id <id> --team-id <team> --password <app-specific-password> --wait`
   - `xcrun stapler staple <Your.app|Your.dmg>`

## 关键目录

- `src/pages/`：四个核心功能页面（配置、导入、剪贴板、健康检测）
- `src/lib/tauri-api.ts`：前端与 Tauri command 调用层
- `src-tauri/src/commands/`：命令入口
- `src-tauri/src/services/`：安全存储、导入、SSH、解析、探活逻辑
- `src-tauri/src/types.rs`：后端共享数据类型

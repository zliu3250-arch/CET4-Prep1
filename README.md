# CET4-Prep · 英语四级备考助手（PWA）

一款纯前端、离线可用、支持自定义导入题库与可选 AI 批改的大学英语四级（CET-4）备考应用，覆盖**单词拼写、写作、翻译、阅读、听力**五大专项。

## 特性
- **零后端、纯本地运行**：进度与错词本保存在浏览器 `localStorage`，自定义大题库与本地 MP3 听力音频保存在 `IndexedDB`。
- **离线范文 + 可选 AI 批改**：默认免费提供高分范文与采分点对照；在「设置」中填入自己的 OpenAI 兼容 API Key（仅存本机）即可解锁 AI 评分与逐句润色。
- **PWA 支持**：支持桌面与手机浏览器，可一键“添加到主屏幕”离线刷题。
- **GitHub Pages 一键部署**：已内置 `.github/workflows/deploy.yml`。

## 本地运行
```bash
npm install
npm run dev
```

## 构建与部署
```bash
npm run build
```
推送到 GitHub `main` 分支后，在仓库 `Settings -> Pages -> Build and deployment` 中选择 `GitHub Actions` 即可自动上线。

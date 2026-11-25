# CET4-Prep 多 Agent（`/teamwork`）协作开发规范

欢迎参与 `CET4-Prep` 英语四级备考 PWA 的开发。为确保多 Agent 并行开发零冲突、高质量合并，所有 Agent 必须严格遵守以下规则：

## 1. 启动前必读
动手写任何代码前，请先阅读：
1. `PRD.md`（确认你负责模块的功能需求与交互细节）
2. `ARCHITECTURE.md`（确认目录边界与可调用的公共服务 API）
3. `src/types/cet4.ts`（确认所有 TypeScript 类型定义）

## 2. 严格文件修改边界（防合并冲突红线）
- **禁止功能 Agent 修改以下公共底座文件**：
  - `package.json`、`package-lock.json`、`vite.config.ts`、`tsconfig*.json`、`index.html`
  - `src/types/*`、`src/services/*`、`src/hooks/*`、`src/components/ui/*`、`src/data/samples/*`、`src/app/*`
- **功能 Agent 仅允许创建与修改自己认领的目录**：
  - 单词模块：`src/features/vocab/**`
  - 写作模块：`src/features/writing/**`
  - 翻译模块：`src/features/translation/**`
  - 阅读模块：`src/features/reading/**`
  - 听力模块：`src/features/listening/**`
- 若发现公共底座确实缺少某个接口或类型，**不要自行修改公共文件**，请在汇报中明确记录需求，由主控协调者统一补充。

## 3. 编码与体验标准
- **TypeScript 严格模式**：禁止使用 `any`（必要时用 `unknown` 收窄），确保 `npx tsc --noEmit` 零报错。
- **样式统一**：仅使用项目已安装的 Tailwind CSS 与 `lucide-react` 图标，不私自安装新 npm 包；必须同时兼容桌面端与 375px 移动端视口。
- **数据落盘**：每次完成一组练习（拼写、交卷等），务必调用 `appendPracticeLog(...)`（单词还需调用 `updateVocabProgress(...)`），让首页仪表盘实时更新统计。
- **音频安全**：听力模块严禁持久化 `blob:` URL，必须使用 `useAudioObjectUrl(audioId)` 播放本地音频。
- **AI 批改降级**：写作与翻译模块在 `hasValidAIConfig()` 为 `false` 或调用失败时，必须清晰展示“未配置 AI Key / 请求失败”提示，并保证离线范文与自评功能完整可用。

## 4. 交付自检清单
每个功能 Agent 完成任务前，必须在自己的工作副本运行并确认通过：
1. `npx tsc --noEmit`（零类型错误）
2. `npm run build`（生产打包通过）
3. 在最终回复中列出修改/新增的文件清单与核心自测要点。

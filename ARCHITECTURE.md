# CET4-Prep 系统架构与多 Agent 接口契约（ARCHITECTURE）

> **状态：公共契约已冻结（v1.0）**  
> 本文件是 `/teamwork` 多 Agent 并行开发的唯一接口真值来源。所有功能 Agent 必须严格消费本文档与 `src/types/cet4.ts` 中定义的契约，**严禁修改公共底座文件**。

## 1. 技术栈与构建约定
- **核心栈**：Vite 6 + React 19 + TypeScript 5 + Tailwind CSS v4 + `lucide-react` + `vite-plugin-pwa`
- **GitHub Pages 兼容**：
  - `vite.config.ts` 配置 `base: './'`
  - 路由采用轻量 Hash 路由（`#/`, `#/vocab`, `#/writing`, `#/translation`, `#/reading`, `#/listening`, `#/settings`），彻底避免子路径刷新 404。
- **样式规范**：使用 Tailwind CSS 工具类，统一清爽学院风配色（主色 `indigo-600`，成功 `emerald-600`，警示 `amber-500`，错误 `rose-600`，底色 `slate-50`）。

## 2. 目录结构与修改权边界

```text
CET4-Prep/
├── PRD.md                     # 产品需求文档（只读）
├── ARCHITECTURE.md            # 本文档：架构与接口契约（只读）
├── AGENTS.md                  # 多 Agent 协作规范（只读）
├── src/
│   ├── types/
│   │   └── cet4.ts            # 【冻结】全局数据结构与服务契约
│   ├── services/
│   │   ├── storage.ts         # 【冻结】localStorage + IndexedDB 持久化与导入导出
│   │   ├── aiGrader.ts        # 【冻结】OpenAI 兼容 API 批改客户端（含超时与降级）
│   │   └── speech.ts          # 【冻结】Web Speech API 朗读封装
│   ├── hooks/
│   │   ├── useHashRoute.ts    # 【冻结】轻量 Hash 路由 Hook
│   │   └── useAudioObjectUrl.ts # 【冻结】IndexedDB 音频 Blob -> Object URL 自动释放 Hook
│   ├── components/
│   │   └── ui/                # 【冻结】通用基础组件（Card, Button, Badge, TimerBar, EmptyState）
│   ├── data/
│   │   └── samples/           # 【冻结】5 大模块内置精选示例数据
│   ├── app/                   # 【冻结】AppLayout、路由壳、Dashboard 首页、Settings 设置页
│   └── features/              # 【并行开发区域：每个 Agent 仅可修改自己认领的子目录】
│       ├── vocab/             # Agent 1：导出 default function VocabPage()
│       ├── writing/           # Agent 2：导出 default function WritingPage()
│       ├── translation/       # Agent 3：导出 default function TranslationPage()
│       ├── reading/           # Agent 4：导出 default function ReadingPage()
│       └── listening/         # Agent 5：导出 default function ListeningPage()
```

## 3. 核心服务 API 契约（功能模块直接 import 使用）

### 3.1 `src/services/storage.ts`
- **设置与 AI 配置（localStorage）**：
  - `getAIConfig(): AIConfig` / `saveAIConfig(cfg: AIConfig): void`
  - `hasValidAIConfig(): boolean`
- **题库读取与导入（内置示例 + IndexedDB 自定义题库自动合并）**：
  - `getVocabList(): Promise<VocabItem[]>` / `importVocabItems(items: VocabItem[]): Promise<number>`
  - `getWritingPrompts(): Promise<WritingPrompt[]>` / `importWritingPrompts(items: WritingPrompt[]): Promise<number>`
  - `getTranslationItems(): Promise<TranslationItem[]>` / `importTranslationItems(items: TranslationItem[]): Promise<number>`
  - `getReadingPassages(): Promise<ReadingPassage[]>` / `importReadingPassages(items: ReadingPassage[]): Promise<number>`
  - `getListeningSets(): Promise<ListeningSet[]>` / `importListeningSets(items: ListeningSet[]): Promise<number>`
- **学习记录与错题状态（localStorage）**：
  - `getVocabProgress(): Record<string, VocabProgress>` / `updateVocabProgress(wordId: string, correct: boolean): VocabProgress`
  - `getPracticeLogs(): PracticeLog[]` / `appendPracticeLog(log: Omit<PracticeLog, 'id' | 'createdAt'>): PracticeLog`
  - `getDashboardStats(): DashboardStats`
- **本地听力音频 Blob（IndexedDB `audioBlobs` store）**：
  - `saveAudioBlob(audioId: string, file: Blob): Promise<void>`（捕获 `QuotaExceededError` 并抛出可读中文错误）
  - `getAudioBlob(audioId: string): Promise<Blob | null>`
  - `deleteAudioBlob(audioId: string): Promise<void>`
  - **铁律**：严禁将 `blob:` URL 存入 JSON 或 `localStorage`！必须使用 `useAudioObjectUrl(audioId)`，由 Hook 在卸载/切换时自动调用 `URL.revokeObjectURL`。

### 3.2 `src/services/aiGrader.ts`
- `gradeWriting(params: { prompt: WritingPrompt; essay: string }): Promise<AIGradeResponse>`
- `gradeTranslation(params: { item: TranslationItem; answer: string }): Promise<AIGradeResponse>`
- `testAIConnection(cfg: AIConfig): Promise<{ ok: boolean; message: string }>`
- **安全与降级约定**：
  - 返回统一结构 `{ ok: true, result: AIGradeResult } | { ok: false, errorCode, message }`；
  - `errorCode` 明确区分 `'no_key' | 'timeout' | 'cors_or_network' | 'auth_error' | 'rate_limit' | 'parse_error'`；
  - 严禁把失败结果伪装成 AI 评分；前端必须清晰提示错误原因，并保留离线范文对照功能。

### 3.3 `src/services/speech.ts`
- `isSpeechSupported(): boolean`
- `speakText(text: string, options?: { lang?: 'en-US' | 'en-GB'; rate?: number; onEnd?: () => void; onError?: (msg: string) => void }): void`
- `stopSpeaking(): void`

## 4. 模块入口契约
每个 `src/features/<module>/index.tsx` 必须提供无参默认导出组件，以便 `src/app/App.tsx` 直接懒加载渲染：
- `src/features/vocab/index.tsx` -> `export default function VocabPage()`
- `src/features/writing/index.tsx` -> `export default function WritingPage()`
- `src/features/translation/index.tsx` -> `export default function TranslationPage()`
- `src/features/reading/index.tsx` -> `export default function ReadingPage()`
- `src/features/listening/index.tsx` -> `export default function ListeningPage()`

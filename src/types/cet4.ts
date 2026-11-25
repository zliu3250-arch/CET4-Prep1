/**
 * CET4-Prep 全局核心数据契约（冻结 v1.0）
 * 所有功能模块（vocab / writing / translation / reading / listening）只读消费本文件类型。
 */

export type ModuleKey =
  | 'dashboard'
  | 'vocab'
  | 'writing'
  | 'translation'
  | 'reading'
  | 'listening'
  | 'mock'
  | 'settings';

export type PracticeModuleKey = Exclude<ModuleKey, 'dashboard' | 'settings'>;

/** 1. 单词拼写数据结构 */
export interface VocabItem {
  id: string;
  word: string;
  phonetic?: string;
  pos: string; // e.g. 'n.', 'v.', 'adj.'
  meaning: string;
  example?: string;
  exampleCn?: string;
  tags?: string[];
}

export interface VocabProgress {
  wordId: string;
  correctCount: number;
  wrongCount: number;
  inWrongBook: boolean;
  lastPracticedAt: string;
}

/** 2. 写作题目数据结构 */
export interface WritingPrompt {
  id: string;
  title: string;
  category: '议论文' | '应用文' | '图画/图表' | '现象分析';
  directions: string;
  minWords: number;
  maxWords: number;
  suggestedMinutes: number;
  outlineTips: string[];
  usefulExpressions: string[];
  sampleEssay: string;
  keyPoints: string[];
}

/** 3. 翻译题目数据结构 */
export interface TranslationItem {
  id: string;
  title: string;
  topic: string;
  sourceText: string;
  hints: Array<{ zh: string; en: string }>;
  referenceTranslation: string;
  keyPhrases: string[];
  suggestedMinutes: number;
}

/** 4. 阅读理解数据结构 */
export type ReadingType = 'careful' | 'banked_cloze' | 'matching';

export interface ReadingQuestion {
  id: string;
  number: number;
  stem: string;
  options: Array<{ label: string; text: string }>;
  answer: string; // e.g. 'A', 'B', 'C', 'D' or paragraph label 'E'
  explanation: string;
  locateHint?: string;
}

export interface ReadingPassage {
  id: string;
  title: string;
  type: ReadingType;
  suggestedMinutes: number;
  paragraphs: Array<{ label?: string; text: string }>;
  /** 选词填空（banked_cloze）专用词库 */
  wordBank?: Array<{ label: string; word: string }>;
  questions: ReadingQuestion[];
}

/** 5. 听力训练数据结构 */
export interface ListeningQuestion {
  id: string;
  number: number;
  stem?: string;
  options: Array<{ label: string; text: string }>;
  answer: string;
  explanation: string;
}

export interface ListeningAudioPiece {
  label: string;
  start: number;
  end: number;
}

export interface ListeningSet {
  id: string;
  title: string;
  section: '新闻报道' | '长对话' | '听力篇章';
  /** 若绑定了本地上传的 MP3/WAV，则存 IndexedDB 中的 audioId（严禁存 blob: URL） */
  audioId?: string;
  /** 可选在线真题听力音频流地址（如本地代理的 HLS .m3u8 或 MP3 URL） */
  audioUrl?: string;
  /** 可选分篇时间戳（用于一键跳转到 Section A/B/C 各篇） */
  audioPieces?: ListeningAudioPiece[];
  /** 听力原文脚本（同时用于无本地音频时的 Web Speech API 模拟朗读） */
  transcript: Array<{ speaker?: string; text: string }>;
  questions: ListeningQuestion[];
}

/** 6. 学习记录与首页统计 */
export interface PracticeLog {
  id: string;
  module: PracticeModuleKey;
  title: string;
  score?: number; // 0-100 或 0-15
  maxScore?: number;
  accuracy?: number; // 0-100 百分比
  durationSeconds?: number;
  detail?: string;
  createdAt: string;
}

export interface DashboardStats {
  todayCount: number;
  totalCount: number;
  wrongWordCount: number;
  masteredWordCount: number;
  moduleCounts: Record<PracticeModuleKey, number>;
  recentLogs: PracticeLog[];
}

/** 0. 本地多用户账号 */
export interface UserAccount {
  id: string;
  name: string;
  createdAt: string;
}

/** 7. AI 批改配置与结构化响应 */
export interface AIConfig {
  /** 自定义助手显示名称（如“四级训练ai”，仅用于界面展示，不作为 API 模型 ID） */
  displayName?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type AIErrorCode =
  | 'no_key'
  | 'timeout'
  | 'cors_or_network'
  | 'auth_error'
  | 'rate_limit'
  | 'parse_error';

export interface AIGradeResult {
  /** 四级原始分（满分 15 分） */
  score15: number;
  /** 四级换算分（满分 106.5 分） */
  score106: number;
  overallComment: string;
  strengths: string[];
  issues: Array<{
    original: string;
    suggestion: string;
    reason: string;
  }>;
  polishedVersion: string;
}

export type AIGradeResponse =
  | { ok: true; result: AIGradeResult }
  | { ok: false; errorCode: AIErrorCode; message: string };

/** 8. 导入导出数据包结构 */
export interface ExportBackupPayload {
  version: 1;
  exportedAt: string;
  vocabProgress: Record<string, VocabProgress>;
  practiceLogs: PracticeLog[];
  customData: {
    vocab: VocabItem[];
    writing: WritingPrompt[];
    translation: TranslationItem[];
    reading: ReadingPassage[];
    listening: ListeningSet[];
  };
}

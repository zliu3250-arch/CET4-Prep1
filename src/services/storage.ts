import {
  SAMPLE_LISTENING,
  SAMPLE_READING,
  SAMPLE_TRANSLATION,
  SAMPLE_VOCAB,
  SAMPLE_WRITING,
} from '../data/samples';
import type {
  AIConfig,
  DashboardStats,
  ExportBackupPayload,
  ListeningSet,
  PracticeLog,
  PracticeModuleKey,
  ReadingPassage,
  TranslationItem,
  VocabItem,
  VocabProgress,
  WritingPrompt,
} from '../types/cet4';

const LS_KEYS = {
  AI_CONFIG: 'cet4_ai_config_v1',
  VOCAB_PROGRESS: 'cet4_vocab_progress_v1',
  PRACTICE_LOGS: 'cet4_practice_logs_v1',
} as const;

const IDB_NAME = 'cet4_prep_db_v1';
const IDB_VERSION = 1;
const STORE_CUSTOM_DATA = 'customData';
const STORE_AUDIO_BLOBS = 'audioBlobs';

type CustomCollectionKey = 'vocab' | 'writing' | 'translation' | 'reading' | 'listening';

const DEFAULT_AI_CONFIG: AIConfig = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
};

function safeReadLS<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteLS(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('浏览器本地存储空间已满，请导出备份后清理部分数据。');
    }
    throw err;
  }
}

/* ==================== 1. AI 配置 ==================== */

export function getAIConfig(): AIConfig {
  return { ...DEFAULT_AI_CONFIG, ...safeReadLS<Partial<AIConfig>>(LS_KEYS.AI_CONFIG, {}) };
}

export function saveAIConfig(cfg: AIConfig): void {
  safeWriteLS(LS_KEYS.AI_CONFIG, {
    baseUrl: cfg.baseUrl.trim(),
    apiKey: cfg.apiKey.trim(),
    model: cfg.model.trim(),
  });
}

export function hasValidAIConfig(): boolean {
  const cfg = getAIConfig();
  return Boolean(cfg.baseUrl.trim() && cfg.apiKey.trim() && cfg.model.trim());
}

/* ==================== 2. IndexedDB 核心封装 ==================== */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CUSTOM_DATA)) {
        db.createObjectStore(STORE_CUSTOM_DATA);
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO_BLOBS)) {
        db.createObjectStore(STORE_AUDIO_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('无法打开浏览器 IndexedDB'));
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(storeName: string, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value, key);
    req.onerror = () => {
      if (req.error?.name === 'QuotaExceededError') {
        reject(new Error('浏览器本地空间不足，无法保存该文件。请清理无用音频后重试。'));
      } else {
        reject(req.error ?? new Error('写入本地存储失败'));
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      if (tx.error?.name === 'QuotaExceededError') {
        reject(new Error('浏览器本地空间不足，无法保存该文件。'));
      } else {
        reject(tx.error ?? new Error('事务写入失败'));
      }
    };
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('删除本地存储项失败'));
    };
  });
}

/* ==================== 3. 题库读写与导入（示例 + 自定义合并） ==================== */

function mergeById<T extends { id: string }>(base: T[], custom: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(item.id, item);
  for (const item of custom) map.set(item.id, item);
  return Array.from(map.values());
}

async function getCustomCollection<T>(key: CustomCollectionKey): Promise<T[]> {
  try {
    return (await idbGet<T[]>(STORE_CUSTOM_DATA, key)) ?? [];
  } catch {
    return [];
  }
}

async function importToCollection<T extends { id: string }>(
  key: CustomCollectionKey,
  incoming: T[],
): Promise<number> {
  const existing = await getCustomCollection<T>(key);
  const merged = mergeById(existing, incoming);
  await idbSet(STORE_CUSTOM_DATA, key, merged);
  return incoming.length;
}

export async function getVocabList(): Promise<VocabItem[]> {
  const custom = await getCustomCollection<VocabItem>('vocab');
  return mergeById(SAMPLE_VOCAB, custom);
}
export const importVocabItems = (items: VocabItem[]) => importToCollection('vocab', items);

export async function getWritingPrompts(): Promise<WritingPrompt[]> {
  const custom = await getCustomCollection<WritingPrompt>('writing');
  return mergeById(SAMPLE_WRITING, custom);
}
export const importWritingPrompts = (items: WritingPrompt[]) =>
  importToCollection('writing', items);

export async function getTranslationItems(): Promise<TranslationItem[]> {
  const custom = await getCustomCollection<TranslationItem>('translation');
  return mergeById(SAMPLE_TRANSLATION, custom);
}
export const importTranslationItems = (items: TranslationItem[]) =>
  importToCollection('translation', items);

export async function getReadingPassages(): Promise<ReadingPassage[]> {
  const custom = await getCustomCollection<ReadingPassage>('reading');
  return mergeById(SAMPLE_READING, custom);
}
export const importReadingPassages = (items: ReadingPassage[]) =>
  importToCollection('reading', items);

export async function getListeningSets(): Promise<ListeningSet[]> {
  const custom = await getCustomCollection<ListeningSet>('listening');
  return mergeById(SAMPLE_LISTENING, custom);
}
export const importListeningSets = (items: ListeningSet[]) =>
  importToCollection('listening', items);

/* ==================== 4. 本地听力音频 Blob ==================== */

export async function saveAudioBlob(audioId: string, file: Blob): Promise<void> {
  await idbSet(STORE_AUDIO_BLOBS, audioId, file);
}

export async function getAudioBlob(audioId: string): Promise<Blob | null> {
  return idbGet<Blob>(STORE_AUDIO_BLOBS, audioId);
}

export async function deleteAudioBlob(audioId: string): Promise<void> {
  await idbDelete(STORE_AUDIO_BLOBS, audioId);
}

/* ==================== 5. 单词进度与练习日志 ==================== */

export function getVocabProgress(): Record<string, VocabProgress> {
  return safeReadLS<Record<string, VocabProgress>>(LS_KEYS.VOCAB_PROGRESS, {});
}

export function updateVocabProgress(wordId: string, correct: boolean): VocabProgress {
  const all = getVocabProgress();
  const prev = all[wordId] ?? {
    wordId,
    correctCount: 0,
    wrongCount: 0,
    inWrongBook: false,
    lastPracticedAt: new Date().toISOString(),
  };

  const next: VocabProgress = {
    wordId,
    correctCount: prev.correctCount + (correct ? 1 : 0),
    wrongCount: prev.wrongCount + (correct ? 0 : 1),
    inWrongBook: correct ? (prev.inWrongBook ? prev.correctCount + 1 < 2 : false) : true,
    lastPracticedAt: new Date().toISOString(),
  };

  all[wordId] = next;
  safeWriteLS(LS_KEYS.VOCAB_PROGRESS, all);
  return next;
}

export function clearWrongBook(): void {
  const all = getVocabProgress();
  for (const key of Object.keys(all)) {
    all[key] = { ...all[key], inWrongBook: false };
  }
  safeWriteLS(LS_KEYS.VOCAB_PROGRESS, all);
}

export function getPracticeLogs(): PracticeLog[] {
  return safeReadLS<PracticeLog[]>(LS_KEYS.PRACTICE_LOGS, []);
}

export function appendPracticeLog(
  log: Omit<PracticeLog, 'id' | 'createdAt'>,
): PracticeLog {
  const entry: PracticeLog = {
    ...log,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const list = [entry, ...getPracticeLogs()].slice(0, 200);
  safeWriteLS(LS_KEYS.PRACTICE_LOGS, list);
  return entry;
}

export function getDashboardStats(): DashboardStats {
  const logs = getPracticeLogs();
  const vocabProgress = getVocabProgress();
  const todayStr = new Date().toISOString().slice(0, 10);

  const moduleCounts: Record<PracticeModuleKey, number> = {
    vocab: 0,
    writing: 0,
    translation: 0,
    reading: 0,
    listening: 0,
  };

  let todayCount = 0;
  for (const log of logs) {
    if (log.createdAt.slice(0, 10) === todayStr) todayCount += 1;
    if (log.module in moduleCounts) {
      moduleCounts[log.module] += 1;
    }
  }

  let wrongWordCount = 0;
  let masteredWordCount = 0;
  for (const p of Object.values(vocabProgress)) {
    if (p.inWrongBook) wrongWordCount += 1;
    if (!p.inWrongBook && p.correctCount >= 1) masteredWordCount += 1;
  }

  return {
    todayCount,
    totalCount: logs.length,
    wrongWordCount,
    masteredWordCount,
    moduleCounts,
    recentLogs: logs.slice(0, 8),
  };
}

/* ==================== 6. 全量备份导出与恢复 ==================== */

export async function exportBackupPayload(): Promise<ExportBackupPayload> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    vocabProgress: getVocabProgress(),
    practiceLogs: getPracticeLogs(),
    customData: {
      vocab: await getCustomCollection<VocabItem>('vocab'),
      writing: await getCustomCollection<WritingPrompt>('writing'),
      translation: await getCustomCollection<TranslationItem>('translation'),
      reading: await getCustomCollection<ReadingPassage>('reading'),
      listening: await getCustomCollection<ListeningSet>('listening'),
    },
  };
}

export async function restoreBackupPayload(payload: ExportBackupPayload): Promise<void> {
  if (payload.version !== 1) {
    throw new Error('不支持的备份文件版本。');
  }
  if (payload.vocabProgress) {
    safeWriteLS(LS_KEYS.VOCAB_PROGRESS, payload.vocabProgress);
  }
  if (Array.isArray(payload.practiceLogs)) {
    safeWriteLS(LS_KEYS.PRACTICE_LOGS, payload.practiceLogs);
  }
  if (payload.customData) {
    if (Array.isArray(payload.customData.vocab)) {
      await idbSet(STORE_CUSTOM_DATA, 'vocab', payload.customData.vocab);
    }
    if (Array.isArray(payload.customData.writing)) {
      await idbSet(STORE_CUSTOM_DATA, 'writing', payload.customData.writing);
    }
    if (Array.isArray(payload.customData.translation)) {
      await idbSet(STORE_CUSTOM_DATA, 'translation', payload.customData.translation);
    }
    if (Array.isArray(payload.customData.reading)) {
      await idbSet(STORE_CUSTOM_DATA, 'reading', payload.customData.reading);
    }
    if (Array.isArray(payload.customData.listening)) {
      await idbSet(STORE_CUSTOM_DATA, 'listening', payload.customData.listening);
    }
  }
}

export async function resetAllLocalData(): Promise<void> {
  window.localStorage.removeItem(LS_KEYS.VOCAB_PROGRESS);
  window.localStorage.removeItem(LS_KEYS.PRACTICE_LOGS);
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_CUSTOM_DATA, STORE_AUDIO_BLOBS], 'readwrite');
    tx.objectStore(STORE_CUSTOM_DATA).clear();
    tx.objectStore(STORE_AUDIO_BLOBS).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('清空 IndexedDB 失败'));
    };
  });
}

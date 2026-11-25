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
  UserAccount,
  VocabItem,
  VocabProgress,
  WritingPrompt,
} from '../types/cet4';

const LS_KEYS = {
  ACCOUNTS: 'cet4_accounts_v1',
  ACTIVE_ACCOUNT: 'cet4_active_account_v1',
  AI_CONFIG: 'cet4_ai_config_v1',
  VOCAB_PROGRESS: 'cet4_vocab_progress_v1',
  PRACTICE_LOGS: 'cet4_practice_logs_v1',
} as const;

const DEFAULT_ACCOUNT_ID = 'default';
const DEFAULT_ACCOUNT: UserAccount = {
  id: DEFAULT_ACCOUNT_ID,
  name: '默认账号',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const IDB_NAME = 'cet4_prep_db_v1';
const IDB_VERSION = 1;
const STORE_CUSTOM_DATA = 'customData';
const STORE_AUDIO_BLOBS = 'audioBlobs';

type CustomCollectionKey = 'vocab' | 'writing' | 'translation' | 'reading' | 'listening';

const BLANK_AI_CONFIG: AIConfig = {
  displayName: '',
  baseUrl: '',
  apiKey: '',
  model: '',
};

const memoryLSFallback = new Map<string, string>();

function safeReadLS<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    const mem = memoryLSFallback.get(key);
    if (!mem) return fallback;
    try {
      return JSON.parse(mem) as T;
    } catch {
      return fallback;
    }
  }
}

function safeWriteLS(key: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, serialized);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('浏览器本地存储空间已满，请导出备份后清理部分数据。');
    }
    // 手机 App 内置 WebView（如微信预览本地 HTML）禁用 localStorage 时降级到内存存储，避免白屏崩溃
    memoryLSFallback.set(key, serialized);
  }
}

/* ==================== 0. 多用户本地账号管理 ==================== */

export function getAccounts(): UserAccount[] {
  const list = safeReadLS<UserAccount[]>(LS_KEYS.ACCOUNTS, []);
  if (!Array.isArray(list) || list.length === 0) {
    safeWriteLS(LS_KEYS.ACCOUNTS, [DEFAULT_ACCOUNT]);
    return [DEFAULT_ACCOUNT];
  }
  return list;
}

export function getActiveAccountId(): string {
  const accounts = getAccounts();
  const saved = safeReadLS<string>(LS_KEYS.ACTIVE_ACCOUNT, DEFAULT_ACCOUNT_ID);
  if (accounts.some((a) => a.id === saved)) return saved;
  return accounts[0].id;
}

export function getActiveAccount(): UserAccount {
  const accounts = getAccounts();
  const activeId = getActiveAccountId();
  return accounts.find((a) => a.id === activeId) ?? accounts[0];
}

export function setActiveAccount(accountId: string): UserAccount {
  const accounts = getAccounts();
  const target = accounts.find((a) => a.id === accountId) ?? accounts[0];
  safeWriteLS(LS_KEYS.ACTIVE_ACCOUNT, target.id);
  return target;
}

export function createAccount(name: string): UserAccount {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('账号名称不能为空。');
  const accounts = getAccounts();
  const created: UserAccount = {
    id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed.slice(0, 20),
    createdAt: new Date().toISOString(),
  };
  safeWriteLS(LS_KEYS.ACCOUNTS, [...accounts, created]);
  safeWriteLS(LS_KEYS.ACTIVE_ACCOUNT, created.id);
  return created;
}

export function renameAccount(accountId: string, newName: string): UserAccount {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('账号名称不能为空。');
  const accounts = getAccounts();
  const next = accounts.map((a) => (a.id === accountId ? { ...a, name: trimmed.slice(0, 20) } : a));
  safeWriteLS(LS_KEYS.ACCOUNTS, next);
  return next.find((a) => a.id === accountId) ?? next[0];
}

function removeAccountLocalKeys(accountId: string): void {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    const exactKeys = [
      LS_KEYS.AI_CONFIG,
      LS_KEYS.VOCAB_PROGRESS,
      LS_KEYS.PRACTICE_LOGS,
      'cet4_mock_history_v1',
      'cet4_mock_drafts_v1',
      'cet4_reading_draft_v1',
      'cet4_listening_draft_v1',
      'cet4_translation_drafts_v1',
      'cet4_translation_history_v1',
      'cet4_writing_submissions_v1',
    ];
    for (const k of exactKeys) window.localStorage.removeItem(k);
    const draftKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('cet4_writing_draft_v1_')) draftKeys.push(k);
    }
    for (const k of draftKeys) window.localStorage.removeItem(k);
    return;
  }

  const prefix = `cet4_u_${accountId}_`;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(prefix)) toRemove.push(k);
  }
  for (const k of toRemove) window.localStorage.removeItem(k);
}

export function deleteAccount(accountId: string): UserAccount[] {
  const accounts = getAccounts();
  if (accounts.length <= 1) {
    throw new Error('至少需要保留一个学习账号。');
  }
  const wasActive = getActiveAccountId() === accountId;
  const remaining = accounts.filter((a) => a.id !== accountId);
  safeWriteLS(LS_KEYS.ACCOUNTS, remaining);
  if (wasActive) {
    safeWriteLS(LS_KEYS.ACTIVE_ACCOUNT, remaining[0].id);
  }
  removeAccountLocalKeys(accountId);
  return remaining;
}

/** 按指定或当前登录账号生成隔离的 localStorage / IndexedDB key（default 账号沿用原 key 兼容历史数据） */
export function getScopedStorageKey(baseKey: string, accountId?: string): string {
  const targetId = accountId ?? getActiveAccountId();
  return targetId === DEFAULT_ACCOUNT_ID ? baseKey : `cet4_u_${targetId}_${baseKey}`;
}

/* ==================== 1. AI 配置（按账号完全独立，任何新设备/新账号均默认全空） ==================== */

export function getAIConfig(accountId?: string): AIConfig {
  return {
    ...BLANK_AI_CONFIG,
    ...safeReadLS<Partial<AIConfig>>(getScopedStorageKey(LS_KEYS.AI_CONFIG, accountId), {}),
  };
}

export function saveAIConfig(cfg: AIConfig, accountId?: string): void {
  safeWriteLS(getScopedStorageKey(LS_KEYS.AI_CONFIG, accountId), {
    displayName: (cfg.displayName ?? '').trim(),
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

/* ==================== 3. 题库读写与导入（内置真题/词库 JSON + 自定义合并） ==================== */

const staticBankCache = new Map<string, Promise<unknown[]>>();
let embeddedBanksParsed: Record<string, unknown[]> | null | undefined;

function readEmbeddedBank(fileName: string): unknown[] | null {
  if (embeddedBanksParsed === undefined) {
    embeddedBanksParsed = null;
    try {
      const w = window as Window & { __CET4_EMBEDDED_BANKS__?: Record<string, unknown[]> };
      if (w.__CET4_EMBEDDED_BANKS__ && typeof w.__CET4_EMBEDDED_BANKS__ === 'object') {
        embeddedBanksParsed = w.__CET4_EMBEDDED_BANKS__;
      } else {
        const el = document.getElementById('cet4-embedded-banks');
        if (el?.textContent) {
          embeddedBanksParsed = JSON.parse(el.textContent) as Record<string, unknown[]>;
        }
      }
    } catch {
      embeddedBanksParsed = null;
    }
  }
  const arr = embeddedBanksParsed?.[fileName];
  return Array.isArray(arr) && arr.length > 0 ? arr : null;
}

async function loadStaticBank<T>(fileName: string, fallback: T[]): Promise<T[]> {
  let cached = staticBankCache.get(fileName);
  if (!cached) {
    cached = (async () => {
      const embedded = readEmbeddedBank(fileName);
      if (embedded) return embedded;
      try {
        const res = await fetch(`./data/${fileName}`);
        if (!res.ok) return fallback;
        const data = (await res.json()) as unknown;
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
        return fallback;
      } catch {
        return fallback;
      }
    })();
    staticBankCache.set(fileName, cached);
  }
  return (await cached) as T[];
}

function mergeById<T extends { id: string }>(base: T[], custom: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(item.id, item);
  for (const item of custom) map.set(item.id, item);
  return Array.from(map.values());
}

async function getCustomCollection<T>(key: CustomCollectionKey, accountId?: string): Promise<T[]> {
  try {
    return (await idbGet<T[]>(STORE_CUSTOM_DATA, getScopedStorageKey(key, accountId))) ?? [];
  } catch {
    return [];
  }
}

async function importToCollection<T extends { id: string }>(
  key: CustomCollectionKey,
  incoming: T[],
  accountId?: string,
): Promise<number> {
  const existing = await getCustomCollection<T>(key, accountId);
  const merged = mergeById(existing, incoming);
  await idbSet(STORE_CUSTOM_DATA, getScopedStorageKey(key, accountId), merged);
  return incoming.length;
}

export async function getVocabList(): Promise<VocabItem[]> {
  const [base, custom] = await Promise.all([
    loadStaticBank<VocabItem>('vocab-cet4.json', SAMPLE_VOCAB),
    getCustomCollection<VocabItem>('vocab'),
  ]);
  return mergeById(base, custom);
}
export const importVocabItems = (items: VocabItem[]) => importToCollection('vocab', items);

export async function getWritingPrompts(): Promise<WritingPrompt[]> {
  const [base, custom] = await Promise.all([
    loadStaticBank<WritingPrompt>('writing-2021-2025.json', SAMPLE_WRITING),
    getCustomCollection<WritingPrompt>('writing'),
  ]);
  return mergeById(base, custom);
}
export const importWritingPrompts = (items: WritingPrompt[]) =>
  importToCollection('writing', items);

export async function getTranslationItems(): Promise<TranslationItem[]> {
  const [base, custom] = await Promise.all([
    loadStaticBank<TranslationItem>('translation-2021-2025.json', SAMPLE_TRANSLATION),
    getCustomCollection<TranslationItem>('translation'),
  ]);
  return mergeById(base, custom);
}
export const importTranslationItems = (items: TranslationItem[]) =>
  importToCollection('translation', items);

export async function getReadingPassages(): Promise<ReadingPassage[]> {
  const [base, custom] = await Promise.all([
    loadStaticBank<ReadingPassage>('reading-2021-2025.json', SAMPLE_READING),
    getCustomCollection<ReadingPassage>('reading'),
  ]);
  return mergeById(base, custom);
}
export const importReadingPassages = (items: ReadingPassage[]) =>
  importToCollection('reading', items);

export async function getListeningSets(): Promise<ListeningSet[]> {
  const [base, custom] = await Promise.all([
    loadStaticBank<ListeningSet>('listening-2021-2025.json', SAMPLE_LISTENING),
    getCustomCollection<ListeningSet>('listening'),
  ]);
  return mergeById(base, custom);
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
  return safeReadLS<Record<string, VocabProgress>>(
    getScopedStorageKey(LS_KEYS.VOCAB_PROGRESS),
    {},
  );
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
  safeWriteLS(getScopedStorageKey(LS_KEYS.VOCAB_PROGRESS), all);
  return next;
}

export function clearWrongBook(): void {
  const all = getVocabProgress();
  for (const key of Object.keys(all)) {
    all[key] = { ...all[key], inWrongBook: false };
  }
  safeWriteLS(getScopedStorageKey(LS_KEYS.VOCAB_PROGRESS), all);
}

export function getPracticeLogs(): PracticeLog[] {
  return safeReadLS<PracticeLog[]>(getScopedStorageKey(LS_KEYS.PRACTICE_LOGS), []);
}

export function appendPracticeLog(
  log: Omit<PracticeLog, 'id' | 'createdAt'>,
  accountId?: string,
): PracticeLog {
  const key = getScopedStorageKey(LS_KEYS.PRACTICE_LOGS, accountId);
  const entry: PracticeLog = {
    ...log,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const existing = safeReadLS<PracticeLog[]>(key, []);
  const list = [entry, ...existing].slice(0, 200);
  safeWriteLS(key, list);
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
    mock: 0,
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
    safeWriteLS(getScopedStorageKey(LS_KEYS.VOCAB_PROGRESS), payload.vocabProgress);
  }
  if (Array.isArray(payload.practiceLogs)) {
    safeWriteLS(getScopedStorageKey(LS_KEYS.PRACTICE_LOGS), payload.practiceLogs);
  }
  if (payload.customData) {
    if (Array.isArray(payload.customData.vocab)) {
      await idbSet(STORE_CUSTOM_DATA, getScopedStorageKey('vocab'), payload.customData.vocab);
    }
    if (Array.isArray(payload.customData.writing)) {
      await idbSet(STORE_CUSTOM_DATA, getScopedStorageKey('writing'), payload.customData.writing);
    }
    if (Array.isArray(payload.customData.translation)) {
      await idbSet(
        STORE_CUSTOM_DATA,
        getScopedStorageKey('translation'),
        payload.customData.translation,
      );
    }
    if (Array.isArray(payload.customData.reading)) {
      await idbSet(STORE_CUSTOM_DATA, getScopedStorageKey('reading'), payload.customData.reading);
    }
    if (Array.isArray(payload.customData.listening)) {
      await idbSet(
        STORE_CUSTOM_DATA,
        getScopedStorageKey('listening'),
        payload.customData.listening,
      );
    }
  }
}

export async function resetAllLocalData(): Promise<void> {
  const activeId = getActiveAccountId();
  // 仅清空当前登录账号的学习进度、草稿、历史与自定义题库，绝不影响其他账号（保留当前账号 AI 配置）
  const savedAI = getAIConfig(activeId);
  removeAccountLocalKeys(activeId);
  if (savedAI.apiKey || savedAI.baseUrl || savedAI.model || savedAI.displayName) {
    saveAIConfig(savedAI, activeId);
  }
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_CUSTOM_DATA], 'readwrite');
    const store = tx.objectStore(STORE_CUSTOM_DATA);
    const collections: CustomCollectionKey[] = [
      'vocab',
      'writing',
      'translation',
      'reading',
      'listening',
    ];
    for (const col of collections) {
      store.delete(getScopedStorageKey(col, activeId));
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('清空当前账号 IndexedDB 失败'));
    };
  });
}

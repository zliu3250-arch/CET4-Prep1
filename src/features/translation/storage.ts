import type { AIGradeResult } from '../../types/cet4';

const DRAFT_STORAGE_KEY = 'cet4_translation_drafts_v1';
const HISTORY_STORAGE_KEY = 'cet4_translation_history_v1';
const MAX_HISTORY_RECORDS = 50;

export interface TranslationSubmission {
  id: string;
  itemId: string;
  title: string;
  topic: string;
  answer: string;
  wordCount: number;
  durationSeconds: number;
  checkedPhrases: string[];
  aiResult?: AIGradeResult;
  createdAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略超出配额或隐私模式写入失败，避免中断用户练习
  }
}

export function countEnglishWords(text: string): number {
  const matches = text.trim().match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

export function getTranslationDrafts(): Record<string, string> {
  return readJson<Record<string, string>>(DRAFT_STORAGE_KEY, {});
}

export function saveTranslationDraft(itemId: string, content: string): void {
  const drafts = getTranslationDrafts();
  if (!content.trim()) {
    delete drafts[itemId];
  } else {
    drafts[itemId] = content;
  }
  writeJson(DRAFT_STORAGE_KEY, drafts);
}

export function getTranslationHistory(): TranslationSubmission[] {
  const list = readJson<TranslationSubmission[]>(HISTORY_STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addTranslationSubmission(
  submission: Omit<TranslationSubmission, 'id' | 'createdAt'>,
): { entry: TranslationSubmission; list: TranslationSubmission[] } {
  const entry: TranslationSubmission = {
    ...submission,
    id: `trans_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const nextList = [entry, ...getTranslationHistory()].slice(0, MAX_HISTORY_RECORDS);
  writeJson(HISTORY_STORAGE_KEY, nextList);
  return { entry, list: nextList };
}

export function updateTranslationSubmission(
  id: string,
  patch: Partial<Pick<TranslationSubmission, 'checkedPhrases' | 'aiResult'>>,
): TranslationSubmission[] {
  const nextList = getTranslationHistory().map((record) =>
    record.id === id ? { ...record, ...patch } : record,
  );
  writeJson(HISTORY_STORAGE_KEY, nextList);
  return nextList;
}

export function deleteTranslationSubmission(id: string): TranslationSubmission[] {
  const nextList = getTranslationHistory().filter((record) => record.id !== id);
  writeJson(HISTORY_STORAGE_KEY, nextList);
  return nextList;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs} 秒`;
  return `${mins} 分 ${String(secs).padStart(2, '0')} 秒`;
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

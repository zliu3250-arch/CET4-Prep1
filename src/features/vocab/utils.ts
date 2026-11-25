import type { VocabProgress } from '../../types/cet4';

export interface ExampleSegment {
  text: string;
  masked: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将例句中的目标单词（含常见词形变化，如复数/三单/过去式/进行时）替换为挖空片段。
 */
export function maskExampleSentence(
  example: string,
  word: string,
): { segments: ExampleSegment[]; hasMatch: boolean } {
  const cleanWord = word.trim();
  if (!example || !cleanWord) {
    return { segments: [{ text: example, masked: false }], hasMatch: false };
  }

  const patterns: string[] = [
    `${escapeRegExp(cleanWord)}(?:s|es|ed|d|ing|er|est|ly)?`,
  ];

  if (cleanWord.length > 3 && cleanWord.endsWith('e')) {
    const stem = escapeRegExp(cleanWord.slice(0, -1));
    patterns.push(`${stem}(?:ing|ed|es|er|est)`);
  }

  if (cleanWord.length > 3 && cleanWord.endsWith('y')) {
    const stem = escapeRegExp(cleanWord.slice(0, -1));
    patterns.push(`${stem}(?:ies|ied|ier|iest|ily)`);
  }

  const regex = new RegExp(`\\b(?:${patterns.join('|')})\\b`, 'gi');
  const segments: ExampleSegment[] = [];
  let lastIndex = 0;
  let hasMatch = false;

  for (const match of example.matchAll(regex)) {
    const start = match.index ?? 0;
    const matchedText = match[0];
    if (start > lastIndex) {
      segments.push({ text: example.slice(lastIndex, start), masked: false });
    }
    segments.push({ text: matchedText, masked: true });
    lastIndex = start + matchedText.length;
    hasMatch = true;
  }

  if (lastIndex < example.length) {
    segments.push({ text: example.slice(lastIndex), masked: false });
  }

  return { segments, hasMatch };
}

/** 忽略首尾空格与大小写进行拼写归一化 */
export function normalizeSpelling(input: string): string {
  return input.trim().toLowerCase();
}

/** 与 storage.ts 中 getDashboardStats 保持一致的掌握判定 */
export function isWordMastered(progress?: VocabProgress): boolean {
  return Boolean(progress && !progress.inWrongBook && progress.correctCount >= 1);
}

/** Fisher-Yates 洗牌 */
export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** 生成逐字母提示字符串（例如 "s u _ _ _ _ _ _ _ _ _"） */
export function formatLetterHint(word: string, revealedCount: number): string {
  const chars = Array.from(word.trim());
  const clamped = Math.max(0, Math.min(revealedCount, chars.length));
  return chars
    .map((ch, idx) => {
      if (ch === ' ' || ch === '-') return ch;
      return idx < clamped ? ch : '_';
    })
    .join(' ');
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs} 秒`;
  return `${mins} 分 ${secs} 秒`;
}

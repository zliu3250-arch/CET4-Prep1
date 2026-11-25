import {
  getListeningSets,
  getReadingPassages,
  getScopedStorageKey,
  getTranslationItems,
  getWritingPrompts,
} from '../../services/storage';
import type {
  AIGradeResult,
  ListeningSet,
  ReadingPassage,
  TranslationItem,
  WritingPrompt,
} from '../../types/cet4';

export interface MockExamPaper {
  paperId: string; // e.g. '2025-12-1'
  year: string; // e.g. '2025'
  title: string; // e.g. '2025年12月真题·第1套'
  writing: WritingPrompt;
  listening: ListeningSet | null;
  readings: ReadingPassage[]; // sorted: banked_cloze -> matching -> careful 1 -> careful 2
  translation: TranslationItem;
}

export interface MockScoreBreakdown {
  listeningScore: number; // max 248.5
  listeningCorrect: number;
  listeningTotal: number;
  readingScore: number; // max 248.5
  readingCorrect: number;
  readingTotal: number;
  writingScore: number; // max 106.5
  translationScore: number; // max 106.5
  totalScore: number; // max 710
}

export interface MockHistoryRecord {
  id: string;
  paperId: string;
  paperTitle: string;
  totalScore: number;
  listeningScore: number;
  readingScore: number;
  writingScore: number;
  translationScore: number;
  durationSeconds: number;
  createdAt: string;
}

const MOCK_HISTORY_KEY = 'cet4_mock_history_v1';

function extractPaperId(id: string): string | null {
  const m = id.match(/(20\d{2}-\d{2}-\d)/);
  return m ? m[1] : null;
}

function formatPaperTitle(paperId: string): string {
  const m = paperId.match(/^(\d{4})-(\d{2})-(\d)$/);
  if (!m) return paperId;
  return `${m[1]}年${m[2]}月真题 · 第${m[3]}套`;
}

const READING_ORDER: Record<ReadingPassage['type'], number> = {
  banked_cloze: 1,
  matching: 2,
  careful: 3,
};

export async function loadMockExamPapers(): Promise<MockExamPaper[]> {
  const [writings, listenings, readings, translations] = await Promise.all([
    getWritingPrompts(),
    getListeningSets(),
    getReadingPassages(),
    getTranslationItems(),
  ]);

  const writingMap = new Map<string, WritingPrompt>();
  for (const w of writings) {
    const pid = extractPaperId(w.id);
    if (pid) writingMap.set(pid, w);
  }

  const listeningMap = new Map<string, ListeningSet>();
  for (const l of listenings) {
    const pid = extractPaperId(l.id);
    if (pid) listeningMap.set(pid, l);
  }

  const readingMap = new Map<string, ReadingPassage[]>();
  for (const r of readings) {
    const pid = extractPaperId(r.id);
    if (!pid) continue;
    const arr = readingMap.get(pid) ?? [];
    arr.push(r);
    readingMap.set(pid, arr);
  }

  const translationMap = new Map<string, TranslationItem>();
  for (const t of translations) {
    const pid = extractPaperId(t.id);
    if (pid) translationMap.set(pid, t);
  }

  const allPaperIds = Array.from(
    new Set([...writingMap.keys(), ...translationMap.keys(), ...readingMap.keys()]),
  )
    .sort()
    .reverse();

  const papers: MockExamPaper[] = [];
  for (const pid of allPaperIds) {
    const writing = writingMap.get(pid);
    const translation = translationMap.get(pid);
    const paperReadings = (readingMap.get(pid) ?? []).sort((a, b) => {
      const diff = READING_ORDER[a.type] - READING_ORDER[b.type];
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    if (!writing || !translation || paperReadings.length === 0) continue;

    // 若第 3 套无独立听力，则复用同考期第 1 套听力（与真实四级考试一致）
    const examDatePrefix = pid.slice(0, 7);
    const listening =
      listeningMap.get(pid) ??
      listeningMap.get(`${examDatePrefix}-1`) ??
      listeningMap.get(`${examDatePrefix}-2`) ??
      null;

    papers.push({
      paperId: pid,
      year: pid.slice(0, 4),
      title: formatPaperTitle(pid),
      writing,
      listening,
      readings: paperReadings,
      translation,
    });
  }

  return papers;
}

/** 按四级官方 710 分制权重计算各板块得分 */
export function computeMockScores(params: {
  paper: MockExamPaper;
  listeningAnswers: Record<string, string>;
  readingAnswers: Record<string, string>;
  writingAI: AIGradeResult | null;
  translationAI: AIGradeResult | null;
}): MockScoreBreakdown {
  const { paper, listeningAnswers, readingAnswers, writingAI, translationAI } = params;

  // 1. 听力（满分 248.5：前 15 题每题 7.1 分，后 10 题每题 14.2 分）
  let listeningCorrect = 0;
  let listeningScore = 0;
  const listeningQs = paper.listening?.questions ?? [];
  for (const q of listeningQs) {
    const picked = (listeningAnswers[q.id] ?? '').trim().toUpperCase();
    if (picked && picked === q.answer.trim().toUpperCase()) {
      listeningCorrect += 1;
      listeningScore += q.number <= 15 ? 7.1 : 14.2;
    }
  }
  if (listeningQs.length > 0 && listeningQs.length !== 25) {
    listeningScore = (listeningCorrect / listeningQs.length) * 248.5;
  }

  // 2. 阅读（满分 248.5：选词填空 3.55/题，长篇匹配 7.1/题，仔细阅读 14.2/题）
  let readingCorrect = 0;
  let readingTotal = 0;
  let readingScore = 0;
  for (const passage of paper.readings) {
    const perQuestion =
      passage.type === 'banked_cloze' ? 3.55 : passage.type === 'matching' ? 7.1 : 14.2;
    for (const q of passage.questions) {
      readingTotal += 1;
      const picked = (readingAnswers[q.id] ?? '').trim().toUpperCase();
      if (picked && picked === q.answer.trim().toUpperCase()) {
        readingCorrect += 1;
        readingScore += perQuestion;
      }
    }
  }

  const writingScore = writingAI ? Math.min(106.5, Math.max(0, writingAI.score106)) : 0;
  const translationScore = translationAI
    ? Math.min(106.5, Math.max(0, translationAI.score106))
    : 0;

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const lScore = round1(Math.min(248.5, listeningScore));
  const rScore = round1(Math.min(248.5, readingScore));
  const wScore = round1(writingScore);
  const tScore = round1(translationScore);

  return {
    listeningScore: lScore,
    listeningCorrect,
    listeningTotal: listeningQs.length,
    readingScore: rScore,
    readingCorrect,
    readingTotal,
    writingScore: wScore,
    translationScore: tScore,
    totalScore: round1(lScore + rScore + wScore + tScore),
  };
}

export function countEnglishWords(text: string): number {
  const matches = text.trim().match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g);
  return matches ? matches.length : 0;
}

export function getMockHistory(accountId?: string): MockHistoryRecord[] {
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(MOCK_HISTORY_KEY, accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as MockHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

export function upsertMockHistoryRecord(
  attemptId: string,
  record: Omit<MockHistoryRecord, 'id' | 'createdAt'>,
  accountId?: string,
): MockHistoryRecord[] {
  const existing = getMockHistory(accountId);
  const idx = existing.findIndex((h) => h.id === attemptId);
  const entry: MockHistoryRecord = {
    ...record,
    id: attemptId,
    createdAt: idx >= 0 ? existing[idx].createdAt : new Date().toISOString(),
  };
  const list =
    idx >= 0
      ? existing.map((h, i) => (i === idx ? entry : h))
      : [entry, ...existing].slice(0, 50);
  try {
    window.localStorage.setItem(
      getScopedStorageKey(MOCK_HISTORY_KEY, accountId),
      JSON.stringify(list),
    );
  } catch {
    // ignore quota error
  }
  return list;
}

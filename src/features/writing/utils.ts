import type { SelfCheckCriterion, WritingDraft, WritingSubmission } from './types';

const DRAFT_KEY_PREFIX = 'cet4_writing_draft_v1_';
const SUBMISSIONS_KEY = 'cet4_writing_submissions_v1';
const MAX_SUBMISSIONS = 50;

export const WRITING_CATEGORIES = [
  '全部',
  '议论文',
  '应用文',
  '图画/图表',
  '现象分析',
] as const;

export const SELF_CHECK_CRITERIA: SelfCheckCriterion[] = [
  {
    id: 'relevance',
    label: '审题切题',
    description: '准确回应题目 Directions 要求，中心观点或写作目的明确，无跑题偏题。',
  },
  {
    id: 'structure',
    label: '结构完整',
    description: '分段清晰（引入—展开—总结或标准书信格式），句间逻辑衔接自然流畅。',
  },
  {
    id: 'grammar',
    label: '语法准确',
    description: '时态、语态、主谓一致与从句结构正确，基本无明显拼写与低级语法错误。',
  },
  {
    id: 'vocabulary',
    label: '词汇丰富',
    description: '恰当运用四级高频词汇、固定搭配与多样化句式，避免过度重复简单词。',
  },
  {
    id: 'wordCount',
    label: '字数达标',
    description: '正文词数落在题目要求的区间内（通常 120~180 词），篇幅均衡完整。',
  },
];

/**
 * 准确统计英文词数：
 * - 识别标准英文单词、带撇号缩略词（don't / students'）、连字符复合词（double-edged）以及独立数字
 * - 忽略标点符号与空白字符
 */
export function countEnglishWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

export function getWordCountStatus(
  count: number,
  minWords: number,
  maxWords: number,
): {
  tone: 'slate' | 'amber' | 'emerald' | 'rose';
  label: string;
  hint: string;
} {
  if (count === 0) {
    return {
      tone: 'slate',
      label: '未开始',
      hint: `目标 ${minWords}~${maxWords} 词`,
    };
  }
  if (count < minWords) {
    return {
      tone: 'amber',
      label: '字数偏少',
      hint: `还差 ${minWords - count} 词达到下限`,
    };
  }
  if (count <= maxWords) {
    return {
      tone: 'emerald',
      label: '字数达标',
      hint: `处于 ${minWords}~${maxWords} 词理想区间`,
    };
  }
  return {
    tone: 'rose',
    label: '超出建议',
    hint: `超出上限 ${count - maxWords} 词，可适当精简`,
  };
}

export function getDraftStorageKey(promptId: string): string {
  return `${DRAFT_KEY_PREFIX}${promptId}`;
}

export function readDraft(promptId: string): WritingDraft | null {
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(promptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WritingDraft>;
    if (typeof parsed.content !== 'string') return null;
    return {
      promptId,
      content: parsed.content,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDraft(promptId: string, content: string): WritingDraft {
  const draft: WritingDraft = {
    promptId,
    content,
    updatedAt: new Date().toISOString(),
  };
  try {
    if (!content.trim()) {
      window.localStorage.removeItem(getDraftStorageKey(promptId));
    } else {
      window.localStorage.setItem(getDraftStorageKey(promptId), JSON.stringify(draft));
    }
  } catch {
    // 忽略本地存储空间异常，避免打断用户输入
  }
  return draft;
}

export function clearDraft(promptId: string): void {
  try {
    window.localStorage.removeItem(getDraftStorageKey(promptId));
  } catch {
    // ignore
  }
}

export function hasSavedDraft(promptId: string): boolean {
  const draft = readDraft(promptId);
  return Boolean(draft && draft.content.trim().length > 0);
}

export function readSubmissions(): WritingSubmission[] {
  try {
    const raw = window.localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as WritingSubmission[];
  } catch {
    return [];
  }
}

export function saveSubmissions(list: WritingSubmission[]): void {
  try {
    window.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(list.slice(0, MAX_SUBMISSIONS)));
  } catch {
    // ignore quota errors
  }
}

export function formatTimeShort(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatClockTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '不足 1 分钟';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs} 秒`;
  return secs > 0 ? `${mins} 分 ${secs} 秒` : `${mins} 分钟`;
}

export function getScoreBandLabel(score15: number): {
  label: string;
  tone: 'emerald' | 'indigo' | 'amber' | 'rose';
} {
  if (score15 >= 13) return { label: '优秀（高分档）', tone: 'emerald' };
  if (score15 >= 10) return { label: '良好（稳过档）', tone: 'indigo' };
  if (score15 >= 8) return { label: '及格（基础档）', tone: 'amber' };
  return { label: '待提升', tone: 'rose' };
}

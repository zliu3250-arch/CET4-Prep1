import type { ReadingPassage, ReadingQuestion, ReadingType } from '../../types/cet4';

export type ReadingFilterType = 'all' | ReadingType;
export type FontSizeMode = 'standard' | 'large';
export type MobileTab = 'passage' | 'questions';

export interface ReadingTypeMeta {
  label: string;
  shortLabel: string;
  badgeTone: 'indigo' | 'emerald' | 'amber';
  description: string;
}

export const READING_TYPE_META: Record<ReadingType, ReadingTypeMeta> = {
  careful: {
    label: '仔细阅读',
    shortLabel: '仔细阅读',
    badgeTone: 'indigo',
    description: '深度理解文章细节与主旨，四选一单选',
  },
  banked_cloze: {
    label: '选词填空',
    shortLabel: '选词填空',
    badgeTone: 'amber',
    description: '结合上下文语境与词性，从词库中选词补全空位',
  },
  matching: {
    label: '长篇匹配',
    shortLabel: '长篇匹配',
    badgeTone: 'emerald',
    description: '快速扫读定位信息，将陈述句与对应段落字母匹配',
  },
};

export interface GradeSummary {
  total: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number;
  score: number;
  maxScore: number;
  durationSeconds: number;
}

/** 获取段落展示标签：若无 label，长篇匹配默认用 A/B/C...，其余用 1/2/3... */
export function getParagraphLabel(
  passage: ReadingPassage,
  index: number,
  rawLabel?: string,
): string {
  const trimmed = rawLabel?.trim();
  if (trimmed) return trimmed;
  if (passage.type === 'matching') {
    return String.fromCharCode(65 + (index % 26));
  }
  return String(index + 1);
}

/** 获取题目可用选项（兼容 banked_cloze 的 wordBank 与 matching 自动从段落生成字母） */
export function getQuestionOptions(
  passage: ReadingPassage,
  question: ReadingQuestion,
): Array<{ label: string; text: string }> {
  if (question.options && question.options.length > 0) {
    return question.options;
  }
  if (passage.type === 'banked_cloze' && passage.wordBank && passage.wordBank.length > 0) {
    return passage.wordBank.map((item) => ({
      label: item.label,
      text: item.word,
    }));
  }
  if (passage.type === 'matching') {
    return passage.paragraphs.map((p, idx) => {
      const label = getParagraphLabel(passage, idx, p.label);
      return { label, text: `段落 ${label}` };
    });
  }
  return [];
}

/** 格式化用时（秒 -> 中文分秒） */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs} 秒`;
  if (secs === 0) return `${mins} 分`;
  return `${mins} 分 ${secs} 秒`;
}

/** 从 locateHint 中尝试提取段落编号（例如 "第 2 段第 1 句" -> "2"，"段落 C" / "Paragraph C" -> "C"） */
export function parseLocateParagraphLabel(locateHint?: string): string | null {
  if (!locateHint) return null;
  const cnMatch = locateHint.match(/第\s*([A-Za-z0-9]+)\s*段/);
  if (cnMatch?.[1]) return cnMatch[1].toUpperCase();
  const paraMatch = locateHint.match(/(?:Paragraph|Para\.?|段落)\s*([A-Za-z0-9]+)/i);
  if (paraMatch?.[1]) return paraMatch[1].toUpperCase();
  return null;
}

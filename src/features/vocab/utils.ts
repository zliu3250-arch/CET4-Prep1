import type { VocabItem, VocabProgress } from '../../types/cet4';

export type VocabPracticeMode =
  | 'en_to_zh_choice'
  | 'zh_to_en_choice'
  | 'zh_to_en_spell'
  | 'en_to_zh_write'
  | 'mixed';

export type ConcreteVocabMode = Exclude<VocabPracticeMode, 'mixed'>;

export interface VocabChoiceOption {
  label: 'A' | 'B' | 'C' | 'D';
  item: VocabItem;
  isCorrect: boolean;
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

/** 生成 4 选 1 选项（优先挑选同词性干扰项，保证无重复词与无重复释义） */
export function buildVocabChoices(target: VocabItem, pool: VocabItem[]): VocabChoiceOption[] {
  const targetWord = target.word.toLowerCase();
  const targetMeaning = target.meaning.trim();
  const targetPrimaryPos = target.pos.split('/')[0]?.trim() ?? '';

  const candidates = pool.filter(
    (item) =>
      item.id !== target.id &&
      item.word.toLowerCase() !== targetWord &&
      item.meaning.trim() !== targetMeaning,
  );

  const samePos = shuffleArray(
    candidates.filter((item) => item.pos.split('/')[0]?.trim() === targetPrimaryPos),
  );
  const others = shuffleArray(
    candidates.filter((item) => item.pos.split('/')[0]?.trim() !== targetPrimaryPos),
  );

  const distractors: VocabItem[] = [];
  const usedWords = new Set<string>([targetWord]);
  const usedMeanings = new Set<string>([targetMeaning]);

  for (const cand of [...samePos, ...others]) {
    if (distractors.length >= 3) break;
    const w = cand.word.toLowerCase();
    const m = cand.meaning.trim();
    if (usedWords.has(w) || usedMeanings.has(m)) continue;
    usedWords.add(w);
    usedMeanings.add(m);
    distractors.push(cand);
  }

  const labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  return shuffleArray([target, ...distractors]).map((item, idx) => ({
    label: labels[idx] ?? 'D',
    item,
    isCorrect: item.id === target.id,
  }));
}

/** 清理中文释义中的括号注释与标点 */
function cleanChineseText(text: string): string {
  return text
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[的地得着了过\s~～…·\-—]/g, '')
    .trim();
}

/**
 * 智能判定「给英语写汉语」用户输入是否命中标准释义：
 * - 将标准释义按常见分隔符拆成多个义项；
 * - 用户输入（同样可填多个，用顿号/逗号/空格分隔）命中任意核心义项或包含关系成立即判对。
 */
export function matchChineseMeaning(userInput: string, targetMeaning: string): boolean {
  const rawInput = userInput.trim();
  if (!rawInput) return false;

  const userParts = rawInput
    .split(/[、，,；;。/\s]+/)
    .map(cleanChineseText)
    .filter((s) => s.length >= 1);

  if (userParts.length === 0) return false;

  const targetParts = targetMeaning
    .split(/[、，,；;。/]+/)
    .map(cleanChineseText)
    .filter((s) => s.length >= 1);

  const fullCleanTarget = cleanChineseText(targetMeaning);

  for (const u of userParts) {
    if (u.length === 1) {
      // 单字输入仅在标准义项本身就是单字时匹配，避免随手打一个字蒙对
      if (targetParts.some((t) => t === u)) return true;
      continue;
    }
    if (fullCleanTarget.includes(u)) return true;
    for (const t of targetParts) {
      if (t.length >= 2 && (u.includes(t) || t.includes(u))) {
        return true;
      }
      // 至少 2 个汉字重合且覆盖率 >= 60%（如“开发利用” vs “开发”）
      let overlap = 0;
      for (const ch of new Set(u)) {
        if (t.includes(ch)) overlap += 1;
      }
      if (overlap >= 2 && overlap / Math.min(u.length, t.length) >= 0.6) {
        return true;
      }
    }
  }

  return false;
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

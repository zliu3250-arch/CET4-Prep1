import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Eye,
  Flame,
  Lightbulb,
  RotateCcw,
  Shuffle,
  SpellCheck,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui';
import { isSpeechSupported, speakText, stopSpeaking } from '../../services/speech';
import {
  appendPracticeLog,
  clearWrongBook,
  getVocabList,
  getVocabProgress,
  updateVocabProgress,
} from '../../services/storage';
import type { VocabItem, VocabProgress } from '../../types/cet4';
import { SessionSummary, type SessionRecord } from './SessionSummary';
import { WrongBookView } from './WrongBookView';
import {
  buildVocabChoices,
  formatLetterHint,
  isWordMastered,
  matchChineseMeaning,
  normalizeSpelling,
  shuffleArray,
  type ConcreteVocabMode,
  type VocabPracticeMode,
} from './utils';

type ActiveTab = 'practice' | 'wrongbook';
type FilterMode = 'all' | 'wrong' | 'unmastered';
type AccentLang = 'en-US' | 'en-GB';
type BatchSize = 20 | 50 | 100 | 0; // 0 表示全部
type VocabTier = 800 | 1500 | 3000 | 4000;

const VOCAB_TIERS: Array<{ size: VocabTier; label: string; desc: string }> = [
  { size: 800, label: '800 词 · 最核心', desc: '历年真题考查概率最高的核心必考词' },
  { size: 1500, label: '1500 词 · 高频进阶', desc: '覆盖四级高频核心与常考实词' },
  { size: 3000, label: '3000 词 · 考纲覆盖', desc: '覆盖四级大纲绝大多数阅读与听力词汇' },
  { size: 4000, label: '4000 词 · 完整冲刺', desc: '全量四级词库冲刺高分' },
];

interface AttemptResult {
  correct: boolean;
  revealedAnswer: boolean;
  userInput: string;
  selectedOptionId?: string;
  wasInWrongBook: boolean;
  nowInWrongBook: boolean;
  overridden?: boolean;
}

const FILTER_LABELS: Record<FilterMode, string> = {
  all: '全部核心词',
  wrong: '仅练错词本',
  unmastered: '未掌握',
};

const PRACTICE_MODES: Array<{ key: VocabPracticeMode; label: string; shortDesc: string }> = [
  { key: 'en_to_zh_choice', label: '给英语选汉语', shortDesc: '看英文选中文释义' },
  { key: 'zh_to_en_choice', label: '给汉语选英语', shortDesc: '看中文选英文单词' },
  { key: 'zh_to_en_spell', label: '给汉语拼英语', shortDesc: '看中文拼写英文单词' },
  { key: 'en_to_zh_write', label: '给英语写汉语', shortDesc: '看英文默写中文意思' },
  { key: 'mixed', label: '四型随机', shortDesc: '四种题型随机轮换' },
];

const CONCRETE_MODES: ConcreteVocabMode[] = [
  'en_to_zh_choice',
  'zh_to_en_choice',
  'zh_to_en_spell',
  'en_to_zh_write',
];

const MODE_LABELS: Record<VocabPracticeMode, string> = {
  en_to_zh_choice: '给英语选汉语',
  zh_to_en_choice: '给汉语选英语',
  zh_to_en_spell: '给汉语拼英语',
  en_to_zh_write: '给英语写汉语',
  mixed: '四型随机',
};

const BATCH_OPTIONS: Array<{ value: BatchSize; label: string }> = [
  { value: 20, label: '20词/组' },
  { value: 50, label: '50词/组' },
  { value: 100, label: '100词/组' },
  { value: 0, label: '全部' },
];

function resolveQuestionMode(mode: VocabPracticeMode, index: number): ConcreteVocabMode {
  if (mode !== 'mixed') return mode;
  return CONCRETE_MODES[index % CONCRETE_MODES.length];
}

export default function VocabPage() {
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, VocabProgress>>({});
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('practice');
  const [vocabTier, setVocabTier] = useState<VocabTier>(800);
  const [practiceMode, setPracticeMode] = useState<VocabPracticeMode>('en_to_zh_choice');
  const [filterMode, setFilterMode] = useState<FilterMode>('unmastered');
  const [batchSize, setBatchSize] = useState<BatchSize>(20);
  const [batchOffset, setBatchOffset] = useState(0);
  const [customModeLabel, setCustomModeLabel] = useState<string | null>(null);
  const [shuffled, setShuffled] = useState(false);
  const [accent, setAccent] = useState<AccentLang>('en-US');
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const [wrongBookAllTiers, setWrongBookAllTiers] = useState(true);

  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [wrongOptionIds, setWrongOptionIds] = useState<string[]>([]);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [lastWrongInput, setLastWrongInput] = useState<string>('');

  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(() => Date.now());
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const [speakingWordId, setSpeakingWordId] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessionLoggedRef = useRef(false);
  const hasFailedCurrentRef = useRef(false);
  const autoNextTimerRef = useRef<number | null>(null);
  const speechSupported = useMemo(() => isSpeechSupported(), []);

  const clearAutoNextTimer = useCallback(() => {
    if (autoNextTimerRef.current !== null) {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
  }, []);

  const buildFilteredItems = useCallback(
    (list: VocabItem[], progress: Record<string, VocabProgress>, mode: FilterMode): VocabItem[] => {
      if (mode === 'wrong') {
        return list.filter((item) => Boolean(progress[item.id]?.inWrongBook));
      }
      if (mode === 'unmastered') {
        return list.filter((item) => !isWordMastered(progress[item.id]));
      }
      return list;
    },
    [],
  );

  const startSessionWithItems = useCallback(
    (
      items: VocabItem[],
      shouldShuffle: boolean,
      labelOverride: string | null = null,
      limit: BatchSize = 20,
    ) => {
      stopSpeaking();
      clearAutoNextTimer();
      hasFailedCurrentRef.current = false;
      setSpeakingWordId(null);
      setSpeechError(null);
      setCustomModeLabel(labelOverride);
      const ordered = shouldShuffle ? shuffleArray(items) : [...items];
      const sliced = limit > 0 && ordered.length > limit ? ordered.slice(0, limit) : ordered;
      setQueue(sliced);
      setCurrentIndex(0);
      setInputValue('');
      setInputWarning(null);
      setHintCount(0);
      setAttemptResult(null);
      setWrongOptionIds([]);
      setRetryNotice(null);
      setLastWrongInput('');
      setSessionRecords([]);
      setStreak(0);
      setBestStreak(0);
      setSessionStartedAt(Date.now());
      setSessionDuration(0);
      setSessionCompleted(false);
      sessionLoggedRef.current = false;
    },
    [clearAutoNextTimer],
  );

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const list = await getVocabList();
        const progress = getVocabProgress();
        if (!active) return;
        setVocabList(list);
        setProgressMap(progress);
        const tierList = list.slice(0, 800);
        const initialItems = buildFilteredItems(tierList, progress, 'unmastered');
        startSessionWithItems(initialItems.length > 0 ? initialItems : tierList, false, null, 20);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => {
      active = false;
      clearAutoNextTimer();
      stopSpeaking();
    };
  }, [buildFilteredItems, startSessionWithItems, clearAutoNextTimer]);

  const tierVocabList = useMemo(
    () => vocabList.slice(0, Math.min(vocabTier, vocabList.length)),
    [vocabList, vocabTier],
  );

  const wrongItems = useMemo(
    () => tierVocabList.filter((item) => Boolean(progressMap[item.id]?.inWrongBook)),
    [tierVocabList, progressMap],
  );

  const allWrongItems = useMemo(
    () => vocabList.filter((item) => Boolean(progressMap[item.id]?.inWrongBook)),
    [vocabList, progressMap],
  );

  const displayedWrongItems = wrongBookAllTiers ? allWrongItems : wrongItems;

  const unmasteredItems = useMemo(
    () => tierVocabList.filter((item) => !isWordMastered(progressMap[item.id])),
    [tierVocabList, progressMap],
  );

  const masteredCount = useMemo(
    () => tierVocabList.filter((item) => isWordMastered(progressMap[item.id])).length,
    [tierVocabList, progressMap],
  );

  const currentItem = queue[currentIndex] ?? null;
  const currentProgress = currentItem ? progressMap[currentItem.id] : undefined;
  const activeModeLabel = `${vocabTier}词档 · ${MODE_LABELS[practiceMode]} · ${customModeLabel ?? FILTER_LABELS[filterMode]}`;
  const currentQuestionMode = resolveQuestionMode(practiceMode, currentIndex);
  const isChoiceMode =
    currentQuestionMode === 'en_to_zh_choice' || currentQuestionMode === 'zh_to_en_choice';

  const choiceOptions = useMemo(() => {
    if (!currentItem || !isChoiceMode) return [];
    return buildVocabChoices(currentItem, tierVocabList);
  }, [currentItem, isChoiceMode, tierVocabList]);

  useEffect(() => {
    if (
      activeTab === 'practice' &&
      !sessionCompleted &&
      currentItem &&
      !attemptResult &&
      !isChoiceMode
    ) {
      inputRef.current?.focus();
    }
  }, [activeTab, sessionCompleted, currentItem, attemptResult, isChoiceMode]);

  const handleSpeak = useCallback(
    (item: VocabItem) => {
      if (!speechSupported) {
        setSpeechError('当前浏览器不支持语音朗读（Web Speech API）。');
        return;
      }
      setSpeechError(null);
      setSpeakingWordId(item.id);
      speakText(item.word, {
        lang: accent,
        rate: 0.95,
        onEnd: () => setSpeakingWordId((prev) => (prev === item.id ? null : prev)),
        onError: (msg) => {
          setSpeakingWordId(null);
          setSpeechError(msg);
        },
      });
    },
    [accent, speechSupported],
  );

  const finalizeSession = useCallback(
    (records: SessionRecord[], finalBestStreak: number) => {
      const durationSeconds = Math.max(1, Math.round((Date.now() - sessionStartedAt) / 1000));
      setSessionDuration(durationSeconds);
      setSessionCompleted(true);
      stopSpeaking();
      setSpeakingWordId(null);

      if (records.length > 0 && !sessionLoggedRef.current) {
        sessionLoggedRef.current = true;
        const correctCount = records.filter((r) => r.correct).length;
        const accuracy = Math.round((correctCount / records.length) * 100);
        appendPracticeLog({
          module: 'vocab',
          title: `词汇训练 · ${activeModeLabel}（${records.length}词）`,
          score: correctCount,
          maxScore: records.length,
          accuracy,
          durationSeconds,
          detail: `答对 ${correctCount}/${records.length}，最高连对 ${finalBestStreak}`,
        });
      }
    },
    [activeModeLabel, sessionStartedAt],
  );

  const advanceToNextWord = useCallback(
    (recordsSnapshot?: SessionRecord[], bestStreakSnapshot?: number) => {
      clearAutoNextTimer();
      const recs = recordsSnapshot ?? sessionRecords;
      const best = bestStreakSnapshot ?? bestStreak;
      if (currentIndex + 1 >= queue.length) {
        finalizeSession(recs, best);
        return;
      }
      stopSpeaking();
      hasFailedCurrentRef.current = false;
      setSpeakingWordId(null);
      setCurrentIndex((prev) => prev + 1);
      setInputValue('');
      setInputWarning(null);
      setHintCount(0);
      setAttemptResult(null);
      setWrongOptionIds([]);
      setRetryNotice(null);
      setLastWrongInput('');
    },
    [clearAutoNextTimer, currentIndex, queue.length, finalizeSession, sessionRecords, bestStreak],
  );

  const scheduleAutoNext = useCallback(
    (recordsSnapshot: SessionRecord[], bestStreakSnapshot: number) => {
      clearAutoNextTimer();
      autoNextTimerRef.current = window.setTimeout(() => {
        autoNextTimerRef.current = null;
        advanceToNextWord(recordsSnapshot, bestStreakSnapshot);
      }, 450);
    },
    [clearAutoNextTimer, advanceToNextWord],
  );

  const recordAttempt = useCallback(
    (
      item: VocabItem,
      userInput: string,
      correct: boolean,
      revealedAnswer: boolean,
      selectedOptionId?: string,
    ) => {
      const wasInWrongBook = Boolean(progressMap[item.id]?.inWrongBook);

      // 情况 A：用户主动点击「显示完整答案」
      if (revealedAnswer) {
        let nowInWrongBook = wasInWrongBook;
        if (!hasFailedCurrentRef.current) {
          hasFailedCurrentRef.current = true;
          const updated = updateVocabProgress(item.id, false);
          nowInWrongBook = updated.inWrongBook;
          setProgressMap((prev) => ({ ...prev, [item.id]: updated }));
          setStreak(0);
          setSessionRecords((prev) => [
            ...prev,
            { item, userInput, correct: false, revealedAnswer: true },
          ]);
        }
        setRetryNotice(null);
        setAttemptResult({
          correct: false,
          revealedAnswer: true,
          userInput,
          selectedOptionId,
          wasInWrongBook,
          nowInWrongBook,
        });
        setInputWarning(null);
        return;
      }

      // 情况 B：回答错误 -> 立即存入错题本，但保留答题机会让用户继续作答直到做对
      if (!correct) {
        if (!hasFailedCurrentRef.current) {
          hasFailedCurrentRef.current = true;
          const updated = updateVocabProgress(item.id, false);
          setProgressMap((prev) => ({ ...prev, [item.id]: updated }));
          setStreak(0);
          setSessionRecords((prev) => [
            ...prev,
            { item, userInput, correct: false, revealedAnswer: false },
          ]);
        }
        if (selectedOptionId) {
          setWrongOptionIds((prev) =>
            prev.includes(selectedOptionId) ? prev : [...prev, selectedOptionId],
          );
          setRetryNotice('答错了，已存入错题本！请继续选择正确答案。');
        } else {
          setLastWrongInput(userInput);
          setRetryNotice('答错了，已存入错题本！请重新输入正确答案直到做对（或点「显示完整答案」）。');
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }
        setInputWarning(null);
        return;
      }

      // 情况 C：回答正确 -> 绿色短暂反馈后自动跳转下一题
      setRetryNotice(null);
      setInputWarning(null);
      if (hasFailedCurrentRef.current) {
        // 本题此前已答错并存入错词本：本次重试答对后放行自动下一题，保留错词本记录供后续复习
        setAttemptResult({
          correct: true,
          revealedAnswer: false,
          userInput,
          selectedOptionId,
          wasInWrongBook: true,
          nowInWrongBook: true,
        });
        scheduleAutoNext(sessionRecords, bestStreak);
        return;
      }

      const updated = updateVocabProgress(item.id, true);
      setProgressMap((prev) => ({ ...prev, [item.id]: updated }));

      const nextStreak = streak + 1;
      const nextBestStreak = Math.max(bestStreak, nextStreak);
      setStreak(nextStreak);
      setBestStreak(nextBestStreak);

      const nextRecords: SessionRecord[] = [
        ...sessionRecords,
        {
          item,
          userInput,
          correct: true,
          revealedAnswer: false,
        },
      ];
      setSessionRecords(nextRecords);

      setAttemptResult({
        correct: true,
        revealedAnswer: false,
        userInput,
        selectedOptionId,
        wasInWrongBook,
        nowInWrongBook: updated.inWrongBook,
      });
      scheduleAutoNext(nextRecords, nextBestStreak);
    },
    [progressMap, streak, bestStreak, sessionRecords, scheduleAutoNext],
  );

  const handleOverrideAsCorrect = () => {
    if (!currentItem) return;
    const wasAlreadyInWrong = Boolean(progressMap[currentItem.id]?.inWrongBook);
    let updated = updateVocabProgress(currentItem.id, true);
    if (updated.inWrongBook) {
      updated = updateVocabProgress(currentItem.id, true);
    }
    setProgressMap((prev) => ({ ...prev, [currentItem.id]: updated }));
    const nextRecords = sessionRecords.map((rec, idx) =>
      idx === sessionRecords.length - 1 ? { ...rec, correct: true } : rec,
    );
    setSessionRecords(nextRecords);
    const nextStreak = streak + 1;
    const nextBestStreak = Math.max(bestStreak, nextStreak);
    setStreak(nextStreak);
    setBestStreak(nextBestStreak);
    setRetryNotice(null);
    setAttemptResult({
      correct: true,
      revealedAnswer: false,
      userInput: lastWrongInput || inputValue.trim(),
      wasInWrongBook: wasAlreadyInWrong,
      nowInWrongBook: updated.inWrongBook,
      overridden: true,
    });
    scheduleAutoNext(nextRecords, nextBestStreak);
  };

  const handleNextWord = useCallback(() => {
    if (!attemptResult) return;
    advanceToNextWord();
  }, [attemptResult, advanceToNextWord]);

  const handlePickChoice = useCallback(
    (optionItem: VocabItem, isCorrect: boolean) => {
      if (!currentItem || attemptResult || wrongOptionIds.includes(optionItem.id)) return;
      const displayInput =
        currentQuestionMode === 'en_to_zh_choice' ? optionItem.meaning : optionItem.word;
      recordAttempt(currentItem, displayInput, isCorrect, false, optionItem.id);
    },
    [currentItem, attemptResult, wrongOptionIds, currentQuestionMode, recordAttempt],
  );

  // 快捷键：选择题 1-4 / A-D 秒选；已出结果时 Enter 下一题
  useEffect(() => {
    if (activeTab !== 'practice' || sessionCompleted || !currentItem) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (attemptResult) {
        if (event.key === 'Enter' && !isInput) {
          event.preventDefault();
          handleNextWord();
        }
        return;
      }

      if (isChoiceMode && !isInput && choiceOptions.length > 0) {
        const key = event.key.toUpperCase();
        const indexMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          A: 0,
          B: 1,
          C: 2,
          D: 3,
        };
        const idx = indexMap[key];
        if (idx !== undefined && choiceOptions[idx]) {
          event.preventDefault();
          handlePickChoice(choiceOptions[idx].item, choiceOptions[idx].isCorrect);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    sessionCompleted,
    currentItem,
    attemptResult,
    isChoiceMode,
    choiceOptions,
    handleNextWord,
    handlePickChoice,
  ]);

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentItem) return;

    if (attemptResult) {
      handleNextWord();
      return;
    }

    if (currentQuestionMode === 'zh_to_en_spell') {
      const normalizedInput = normalizeSpelling(inputValue);
      if (!normalizedInput) {
        setInputWarning('请先输入英文拼写，或使用下方「提示首字母 / 显示答案」。');
        inputRef.current?.focus();
        return;
      }
      const isCorrect = normalizedInput === normalizeSpelling(currentItem.word);
      recordAttempt(currentItem, inputValue.trim(), isCorrect, false);
      return;
    }

    if (currentQuestionMode === 'en_to_zh_write') {
      if (!inputValue.trim()) {
        setInputWarning('请先输入中文释义，或点击「显示完整答案」。');
        inputRef.current?.focus();
        return;
      }
      const isCorrect = matchChineseMeaning(inputValue, currentItem.meaning);
      recordAttempt(currentItem, inputValue.trim(), isCorrect, false);
    }
  };

  const handleHintLetter = () => {
    if (!currentItem || attemptResult) return;
    const maxHints = Math.max(1, currentItem.word.trim().length);
    setHintCount((prev) => Math.min(prev + 1, maxHints));
    setInputWarning(null);
    inputRef.current?.focus();
  };

  const handleRevealAnswer = () => {
    if (!currentItem || attemptResult) return;
    recordAttempt(currentItem, inputValue.trim(), false, true);
  };

  const handleSwitchPracticeMode = (nextMode: VocabPracticeMode) => {
    setPracticeMode(nextMode);
    setActiveTab('practice');
    // 若当前题已经作答出结果，切题型时顺延到下一题，避免同一题重复计数
    if (attemptResult) {
      handleNextWord();
      return;
    }
    setInputValue('');
    setInputWarning(null);
    setHintCount(0);
    setWrongOptionIds([]);
    setRetryNotice(null);
    setLastWrongInput('');
  };

  const handleSwitchTier = (nextTier: VocabTier) => {
    const latestProgress = getVocabProgress();
    setProgressMap(latestProgress);
    setVocabTier(nextTier);
    setActiveTab('practice');
    const nextTierList = vocabList.slice(0, Math.min(nextTier, vocabList.length));
    const items = buildFilteredItems(nextTierList, latestProgress, filterMode);
    const limit: BatchSize = filterMode === 'wrong' ? 0 : batchSize;
    startSessionWithItems(items, shuffled, null, limit);
  };

  const handleSwitchFilter = (mode: FilterMode) => {
    const latestProgress = getVocabProgress();
    setProgressMap(latestProgress);
    setFilterMode(mode);
    setActiveTab('practice');
    const items = buildFilteredItems(tierVocabList, latestProgress, mode);
    const limit: BatchSize = mode === 'wrong' ? 0 : batchSize;
    startSessionWithItems(items, shuffled, null, limit);
  };

  const handleBatchSizeChange = (nextSize: BatchSize) => {
    setBatchSize(nextSize);
    const latestProgress = getVocabProgress();
    setProgressMap(latestProgress);
    const items = buildFilteredItems(tierVocabList, latestProgress, filterMode);
    startSessionWithItems(items, shuffled, null, nextSize);
  };

  const handleToggleShuffle = () => {
    const nextShuffled = !shuffled;
    setShuffled(nextShuffled);
    const latestProgress = getVocabProgress();
    setProgressMap(latestProgress);
    const items = buildFilteredItems(tierVocabList, latestProgress, filterMode);
    startSessionWithItems(items, nextShuffled, null, filterMode === 'wrong' ? 0 : batchSize);
  };

  const handleRestartCurrentFilter = () => {
    const latestProgress = getVocabProgress();
    setProgressMap(latestProgress);
    const items = buildFilteredItems(tierVocabList, latestProgress, filterMode);
    const limit: BatchSize = filterMode === 'wrong' ? 0 : batchSize;
    if (!shuffled && limit > 0 && items.length > limit) {
      const nextOffset = (batchOffset + limit) % items.length;
      setBatchOffset(nextOffset);
      const rotated = [...items.slice(nextOffset), ...items.slice(0, nextOffset)];
      startSessionWithItems(rotated, false, null, limit);
      return;
    }
    setBatchOffset(0);
    startSessionWithItems(items, shuffled, null, limit);
  };

  const handlePracticeCustomWrong = (items: VocabItem[]) => {
    setActiveTab('practice');
    startSessionWithItems(items, shuffled, '本轮错词重练', 0);
  };

  const handleRemoveFromWrongBook = (wordId: string) => {
    let next = updateVocabProgress(wordId, true);
    if (next.inWrongBook) {
      next = updateVocabProgress(wordId, true);
    }
    setProgressMap(getVocabProgress());
  };

  const handleClearAllWrongBook = () => {
    clearWrongBook();
    const latest = getVocabProgress();
    setProgressMap(latest);
    if (filterMode === 'wrong') {
      startSessionWithItems([], shuffled, null, 0);
    }
  };

  const answeredCount = sessionRecords.length;
  const correctSessionCount = sessionRecords.filter((r) => r.correct).length;
  const sessionAccuracy =
    answeredCount > 0 ? Math.round((correctSessionCount / answeredCount) * 100) : null;
  const progressPercent =
    queue.length > 0
      ? Math.min(100, Math.round(((currentIndex + (attemptResult ? 1 : 0)) / queue.length) * 100))
      : 0;

  if (loading) {
    return (
      <div>
        <SectionHeader title="四级核心词汇" subtitle="精选 800 高频必考词 · 四种题型自由切换" />
        <Card>
          <div className="py-12 text-center text-sm text-slate-500">正在加载 800 四级核心词库...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="四级核心词汇"
        subtitle={`当前 ${vocabTier} 词档（共 ${tierVocabList.length} 词） · 已掌握 ${masteredCount} 词 · 错词本 ${wrongItems.length} 词`}
        action={
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab('practice')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'practice'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <SpellCheck className="h-4 w-4" />
              词汇训练
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wrongbook')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'wrongbook'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BookMarked className="h-4 w-4" />
              错词本
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  activeTab === 'wrongbook'
                    ? 'bg-white/20 text-white'
                    : allWrongItems.length > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {allWrongItems.length}
              </span>
            </button>
          </div>
        }
      />

      {!speechSupported && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs sm:text-sm text-amber-800">
          <VolumeX className="h-4 w-4 shrink-0 text-amber-600" />
          <span>当前浏览器不支持 Web Speech API 语音朗读，发音按钮已禁用，答题功能不受影响。</span>
        </div>
      )}

      {speechError && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs sm:text-sm text-rose-700">
          <span>{speechError}</span>
          <button
            type="button"
            onClick={() => setSpeechError(null)}
            className="text-xs font-medium underline cursor-pointer"
          >
            关闭
          </button>
        </div>
      )}

      {activeTab === 'wrongbook' ? (
        <div className="space-y-3">
          {allWrongItems.length > wrongItems.length && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs">
              <span className="text-slate-600">
                全词库共 <strong className="text-rose-600">{allWrongItems.length}</strong> 个错词（当前 {vocabTier} 词档含 {wrongItems.length} 个）
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setWrongBookAllTiers(true)}
                  className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                    wrongBookAllTiers ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  全部档位 ({allWrongItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWrongBookAllTiers(false)}
                  className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                    !wrongBookAllTiers ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  仅 {vocabTier} 词档 ({wrongItems.length})
                </button>
              </div>
            </div>
          )}
          <WrongBookView
            wrongItems={displayedWrongItems}
            progressMap={progressMap}
            speechSupported={speechSupported}
            speakingWordId={speakingWordId}
            accent={accent}
            onSpeak={handleSpeak}
            onStartWrongPractice={() => {
              if (wrongBookAllTiers && allWrongItems.length > 0) {
                setActiveTab('practice');
                setFilterMode('wrong');
                startSessionWithItems(allWrongItems, shuffled, '全词库错词本', batchSize);
              } else {
                handleSwitchFilter('wrong');
              }
            }}
            onStartAllPractice={() => handleSwitchFilter('all')}
            onRemoveFromWrongBook={handleRemoveFromWrongBook}
            onClearAllWrongBook={handleClearAllWrongBook}
          />
        </div>
      ) : (
        <>
          {/* 顶部词库档位 + 题型模式 + 筛选工具栏 */}
          <Card className="space-y-3 p-3.5 sm:p-4">
            {/* 4 档历年考频词库切换（800 / 1500 / 3000 / 4000） */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-500">
                按历年真题考查概率分级（800 词最核心 → 4000 词完整冲刺）：
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {VOCAB_TIERS.map((tier) => {
                  const active = vocabTier === tier.size;
                  return (
                    <button
                      key={tier.size}
                      type="button"
                      onClick={() => handleSwitchTier(tier.size)}
                      title={tier.desc}
                      className={`rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-2xs'
                          : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
                      }`}
                    >
                      <p className="text-xs sm:text-sm font-bold leading-tight">{tier.label}</p>
                      <p
                        className={`mt-0.5 text-[10px] truncate ${
                          active ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {tier.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4 种考察形式切换 */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
              {PRACTICE_MODES.map((m) => {
                const active = practiceMode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => handleSwitchPracticeMode(m.key)}
                    title={m.shortDesc}
                    className={`rounded-xl px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'unmastered', label: '未掌握', count: unmasteredItems.length },
                    { key: 'all', label: `当前${vocabTier}词档`, count: tierVocabList.length },
                    { key: 'wrong', label: '仅练错词本', count: wrongItems.length },
                  ] as const
                ).map((option) => {
                  const active = filterMode === option.key && !customModeLabel;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleSwitchFilter(option.key)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className="text-xs opacity-75">({option.count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMoreSettingsOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <span>
                    更多设置（{batchSize === 0 ? '全部' : `${batchSize}词/组`} ·{' '}
                    {accent === 'en-US' ? '美音' : '英音'} · {shuffled ? '乱序' : '高频序'}）
                  </span>
                  <span>{moreSettingsOpen ? '▴' : '▾'}</span>
                </button>

                {moreSettingsOpen && (
                  <>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs">
                      {BATCH_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleBatchSizeChange(opt.value)}
                          className={`rounded-lg px-2 py-1 font-medium transition-colors cursor-pointer ${
                            batchSize === opt.value
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setAccent('en-US')}
                        className={`rounded-lg px-2 py-1 font-medium transition-colors cursor-pointer ${
                          accent === 'en-US'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        美音
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccent('en-GB')}
                        className={`rounded-lg px-2 py-1 font-medium transition-colors cursor-pointer ${
                          accent === 'en-GB'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        英音
                      </button>
                    </div>

                    <Button
                      variant={shuffled ? 'primary' : 'secondary'}
                      className="px-2.5 py-1.5 text-xs"
                      onClick={handleToggleShuffle}
                      title="切换词频顺序/乱序练习"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      {shuffled ? '乱序' : '高频序'}
                    </Button>
                  </>
                )}

                <Button
                  variant="secondary"
                  className="px-2.5 py-1.5 text-xs"
                  onClick={handleRestartCurrentFilter}
                  title="重新开始本组"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  换一批
                </Button>
              </div>
            </div>

            {!sessionCompleted && queue.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="grid grid-cols-3 gap-2 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
                  <div className="rounded-xl bg-slate-50 px-2.5 py-1.5 sm:bg-transparent sm:p-0">
                    <span className="block text-[11px] text-slate-500 sm:inline sm:mr-1.5 sm:text-xs">
                      当前进度
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-900">
                      {Math.min(currentIndex + 1, queue.length)} / {queue.length}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 px-2.5 py-1.5 sm:bg-transparent sm:p-0">
                    <span className="block text-[11px] text-slate-500 sm:inline sm:mr-1.5 sm:text-xs">
                      本次正确率
                    </span>
                    <span className="font-mono text-sm font-semibold text-indigo-600">
                      {sessionAccuracy === null ? '--' : `${sessionAccuracy}%`}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 px-2.5 py-1.5 sm:bg-transparent sm:p-0">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 sm:mr-1.5 sm:text-xs">
                      <Flame className="h-3.5 w-3.5 text-amber-500" />
                      当前连对
                    </span>
                    <span className="block font-mono text-sm font-semibold text-amber-600 sm:inline">
                      {streak}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* 主练习区 / 结算区 / 空态 */}
          {sessionCompleted ? (
            <SessionSummary
              modeLabel={activeModeLabel}
              records={sessionRecords}
              bestStreak={bestStreak}
              durationSeconds={sessionDuration}
              speechSupported={speechSupported}
              speakingWordId={speakingWordId}
              onSpeak={handleSpeak}
              onRestartSameFilter={handleRestartCurrentFilter}
              onPracticeSessionWrong={handlePracticeCustomWrong}
              onOpenWrongBook={() => setActiveTab('wrongbook')}
            />
          ) : queue.length === 0 || !currentItem ? (
            <EmptyState
              title={
                filterMode === 'wrong'
                  ? '错词本暂无需要练习的单词'
                  : filterMode === 'unmastered'
                    ? '太棒了！当前 800 核心词已全部掌握'
                    : '暂无可练习的单词'
              }
              description={
                filterMode === 'wrong'
                  ? '答错的单词会自动加入错词本，你可以先练习全部核心词。'
                  : filterMode === 'unmastered'
                    ? '可以切换回「全部核心词」巩固复习，或在设置页导入自定义词库。'
                    : '请前往「设置与导入」导入词库 JSON。'
              }
              action={
                filterMode !== 'all' ? (
                  <Button onClick={() => handleSwitchFilter('all')}>切换到全部核心词</Button>
                ) : undefined
              }
            />
          ) : (
            <Card className="space-y-5">
              {/* 题干区：根据 4 种考察形式展示英文或中文 */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="indigo">{MODE_LABELS[currentQuestionMode]}</Badge>
                    <Badge tone="slate">{currentItem.pos}</Badge>
                    {currentItem.phonetic &&
                      (currentQuestionMode !== 'zh_to_en_choice' || Boolean(attemptResult)) && (
                        <span className="font-mono text-sm text-slate-500">
                          {currentItem.phonetic}
                        </span>
                      )}
                    {currentProgress?.inWrongBook && <Badge tone="rose">错词本</Badge>}
                    {isWordMastered(currentProgress) && <Badge tone="emerald">已掌握</Badge>}
                    {currentItem.tags?.slice(0, 2).map((tag) => (
                      <Badge key={tag} tone="slate">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {currentQuestionMode === 'en_to_zh_choice' ||
                  currentQuestionMode === 'en_to_zh_write' ? (
                    <h2 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 break-words">
                      {currentItem.word}
                    </h2>
                  ) : (
                    <h2 className="text-xl sm:text-2xl font-bold leading-snug text-slate-900 break-words">
                      {currentItem.meaning}
                    </h2>
                  )}
                </div>

                {/* 发音按钮（给汉语选英语答题前隐藏发音以免直接剧透，其余模式随时可听） */}
                {(currentQuestionMode !== 'zh_to_en_choice' || Boolean(attemptResult)) && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleSpeak(currentItem)}
                    disabled={!speechSupported}
                    className={
                      speakingWordId === currentItem.id
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : ''
                    }
                  >
                    <Volume2 className="h-4 w-4" />
                    {speakingWordId === currentItem.id ? '朗读中...' : '听发音'}
                  </Button>
                )}
              </div>

              {/* 模式 1 & 2：四选一选择题（给英语选汉语 / 给汉语选英语） */}
              {isChoiceMode ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {choiceOptions.map((opt) => {
                      const isPicked = attemptResult?.selectedOptionId === opt.item.id;
                      const isWrongTried = wrongOptionIds.includes(opt.item.id);
                      const showResult = Boolean(attemptResult);

                      let styleClass =
                        'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40';
                      if (showResult) {
                        if (opt.isCorrect) {
                          styleClass =
                            'border-emerald-400 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200';
                        } else if ((isPicked || isWrongTried) && !opt.isCorrect) {
                          styleClass =
                            'border-rose-400 bg-rose-50 text-rose-900 ring-1 ring-rose-200';
                        } else {
                          styleClass = 'border-slate-200 bg-slate-50/60 text-slate-400';
                        }
                      } else if (isWrongTried) {
                        styleClass =
                          'border-rose-300 bg-rose-50/80 text-rose-700 opacity-75 line-through';
                      }

                      return (
                        <button
                          key={opt.item.id}
                          type="button"
                          disabled={showResult || isWrongTried}
                          onClick={() => handlePickChoice(opt.item, opt.isCorrect)}
                          className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer disabled:cursor-default ${styleClass}`}
                        >
                          <span
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                              showResult && opt.isCorrect
                                ? 'bg-emerald-600 text-white'
                                : (showResult && isPicked && !opt.isCorrect) || isWrongTried
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            {currentQuestionMode === 'en_to_zh_choice' ? (
                              <p className="text-sm sm:text-base font-medium leading-snug break-words">
                                {opt.item.meaning}
                              </p>
                            ) : (
                              <div>
                                <p className="font-mono text-base sm:text-lg font-bold break-all">
                                  {opt.item.word}
                                </p>
                                {showResult && opt.item.phonetic && (
                                  <p className="mt-0.5 font-mono text-xs opacity-75">
                                    {opt.item.phonetic}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {!attemptResult && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                      <span>快捷键：按键盘 1–4 或 A–D 直接选择</span>
                      {answeredCount > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2.5 py-1 text-xs text-slate-500"
                          onClick={() => finalizeSession(sessionRecords, bestStreak)}
                        >
                          结束并记录本组（已答 {answeredCount} 词）
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* 模式 3 & 4：给汉语拼写英语 / 给英语写汉语 */
                <div className="space-y-4">
                  {currentQuestionMode === 'zh_to_en_spell' && hintCount > 0 && !attemptResult && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-800">
                        <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>字母提示（共 {currentItem.word.length} 个字母）：</span>
                      </div>
                      <span className="font-mono text-base sm:text-lg font-bold tracking-widest text-amber-900 break-all">
                        {formatLetterHint(currentItem.word, hintCount)}
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleFormSubmit} className="space-y-3">
                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value);
                          if (inputWarning) setInputWarning(null);
                        }}
                        readOnly={Boolean(attemptResult)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder={
                          currentQuestionMode === 'zh_to_en_spell'
                            ? `输入英文拼写（${currentItem.word.length} 个字母），按 Enter 提交...`
                            : '输入中文意思（写出核心词义即可），按 Enter 提交...'
                        }
                        className={`w-full flex-1 rounded-xl border px-4 py-3 text-base sm:text-lg transition-colors focus:outline-none ${
                          currentQuestionMode === 'zh_to_en_spell' ? 'font-mono' : ''
                        } ${
                          attemptResult
                            ? attemptResult.correct
                              ? 'border-emerald-300 bg-emerald-50/60 text-emerald-900'
                              : 'border-rose-300 bg-rose-50/60 text-rose-900'
                            : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                        }`}
                      />

                      {!attemptResult ? (
                        <Button type="submit" className="py-3 sm:px-6">
                          提交答案
                        </Button>
                      ) : (
                        <Button type="submit" className="py-3 sm:px-6">
                          {currentIndex + 1 >= queue.length ? '查看本组结算' : '下一题'}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {inputWarning && (
                      <p className="text-xs font-medium text-amber-600">{inputWarning}</p>
                    )}

                    {!attemptResult && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {currentQuestionMode === 'zh_to_en_spell' && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-3 py-1.5 text-xs sm:text-sm"
                              onClick={handleHintLetter}
                              disabled={hintCount >= currentItem.word.trim().length}
                            >
                              <Lightbulb className="h-4 w-4 text-amber-500" />
                              {hintCount === 0
                                ? '提示首字母'
                                : `再提示 1 字母 (${hintCount}/${currentItem.word.length})`}
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            className="px-3 py-1.5 text-xs sm:text-sm"
                            onClick={handleRevealAnswer}
                          >
                            <Eye className="h-4 w-4" />
                            显示完整答案
                          </Button>
                        </div>

                        {answeredCount > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2.5 py-1.5 text-xs text-slate-500"
                            onClick={() => finalizeSession(sessionRecords, bestStreak)}
                          >
                            结束并记录本组（已答 {answeredCount} 词）
                          </Button>
                        )}
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* 答错继续作答提示条（已存入错词本，直到做对才过关） */}
              {retryNotice && !attemptResult && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs sm:text-sm text-rose-800">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span className="font-medium">{retryNotice}</span>
                  </div>
                  {currentQuestionMode === 'en_to_zh_write' && (
                    <button
                      type="button"
                      onClick={handleOverrideAsCorrect}
                      className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                    >
                      同义词算我答对
                    </button>
                  )}
                </div>
              )}

              {/* 判题反馈区 */}
              {attemptResult && (
                <div
                  className={`rounded-2xl border p-4 ${
                    attemptResult.correct
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-rose-200 bg-rose-50/70'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {attemptResult.correct ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
                        )}
                        <span
                          className={`text-sm sm:text-base font-semibold ${
                            attemptResult.correct ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {attemptResult.correct
                            ? attemptResult.overridden
                              ? '已标记为正确，即将自动下一题...'
                              : '回答正确！即将自动下一题...'
                            : attemptResult.revealedAnswer
                              ? '已显示答案（已记入错词本）'
                              : '回答有误（已加入错词本）'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-7 text-sm">
                        <span className="font-mono text-base font-bold text-slate-900">
                          {currentItem.word}
                        </span>
                        {currentItem.phonetic && (
                          <span className="font-mono text-xs text-slate-500">
                            {currentItem.phonetic}
                          </span>
                        )}
                        <span className="text-slate-700">
                          {currentItem.pos} {currentItem.meaning}
                        </span>
                      </div>

                      {!attemptResult.correct && !attemptResult.revealedAnswer && (
                        <div className="flex flex-wrap items-center gap-3 pl-7 text-xs text-rose-700">
                          <span>
                            你的作答：
                            <span className="ml-1 font-mono line-through">
                              {attemptResult.userInput}
                            </span>
                          </span>
                          {currentQuestionMode === 'en_to_zh_write' && (
                            <button
                              type="button"
                              onClick={handleOverrideAsCorrect}
                              className="rounded-lg border border-emerald-300 bg-white px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              同义词算我答对
                            </button>
                          )}
                        </div>
                      )}

                      {attemptResult.correct && attemptResult.wasInWrongBook && (
                        <p className="pl-7 text-xs font-medium text-emerald-700">
                          {attemptResult.nowInWrongBook
                            ? '错词复练通过 1 次，再答对 1 次即可自动移出错词本。'
                            : '连续攻克成功，该词已自动移出错词本！'}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                      {isChoiceMode && (
                        <Button type="button" onClick={handleNextWord}>
                          {currentIndex + 1 >= queue.length ? '查看本组结算' : '下一题'}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                      {!isChoiceMode && (
                        <span className="hidden text-xs text-slate-500 sm:inline">
                          按 Enter 快速继续
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

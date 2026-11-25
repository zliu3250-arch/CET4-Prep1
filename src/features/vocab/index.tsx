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
  formatLetterHint,
  isWordMastered,
  maskExampleSentence,
  normalizeSpelling,
  shuffleArray,
} from './utils';

type ActiveTab = 'practice' | 'wrongbook';
type FilterMode = 'all' | 'wrong' | 'unmastered';
type AccentLang = 'en-US' | 'en-GB';

interface AttemptResult {
  correct: boolean;
  revealedAnswer: boolean;
  userInput: string;
  wasInWrongBook: boolean;
  nowInWrongBook: boolean;
}

const FILTER_LABELS: Record<FilterMode, string> = {
  all: '全部词库',
  wrong: '仅练错词本',
  unmastered: '未掌握',
};

export default function VocabPage() {
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, VocabProgress>>({});
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('practice');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [customModeLabel, setCustomModeLabel] = useState<string | null>(null);
  const [shuffled, setShuffled] = useState(false);
  const [accent, setAccent] = useState<AccentLang>('en-US');

  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);

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
  const speechSupported = useMemo(() => isSpeechSupported(), []);

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
    (items: VocabItem[], shouldShuffle: boolean, labelOverride: string | null = null) => {
      stopSpeaking();
      setSpeakingWordId(null);
      setSpeechError(null);
      setCustomModeLabel(labelOverride);
      setQueue(shouldShuffle ? shuffleArray(items) : [...items]);
      setCurrentIndex(0);
      setInputValue('');
      setInputWarning(null);
      setHintCount(0);
      setAttemptResult(null);
      setSessionRecords([]);
      setStreak(0);
      setBestStreak(0);
      setSessionStartedAt(Date.now());
      setSessionDuration(0);
      setSessionCompleted(false);
      sessionLoggedRef.current = false;
    },
    [],
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
        startSessionWithItems(list, false, null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => {
      active = false;
      stopSpeaking();
    };
  }, [startSessionWithItems]);

  const wrongItems = useMemo(
    () => vocabList.filter((item) => Boolean(progressMap[item.id]?.inWrongBook)),
    [vocabList, progressMap],
  );

  const unmasteredItems = useMemo(
    () => vocabList.filter((item) => !isWordMastered(progressMap[item.id])),
    [vocabList, progressMap],
  );

  const masteredCount = useMemo(
    () => vocabList.filter((item) => isWordMastered(progressMap[item.id])).length,
    [vocabList, progressMap],
  );

  const currentItem = queue[currentIndex] ?? null;
  const currentProgress = currentItem ? progressMap[currentItem.id] : undefined;
  const activeModeLabel = customModeLabel ?? FILTER_LABELS[filterMode];

  const maskedExample = useMemo(() => {
    if (!currentItem?.example) return null;
    return maskExampleSentence(currentItem.example, currentItem.word);
  }, [currentItem]);

  useEffect(() => {
    if (activeTab === 'practice' && !sessionCompleted && currentItem && !attemptResult) {
      inputRef.current?.focus();
    }
  }, [activeTab, sessionCompleted, currentItem, attemptResult]);

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
          title: `单词拼写 · ${activeModeLabel}（${records.length}词）`,
          score: correctCount,
          maxScore: records.length,
          accuracy,
          durationSeconds,
          detail: `拼对 ${correctCount}/${records.length}，最高连对 ${finalBestStreak}`,
        });
      }
    },
    [activeModeLabel, sessionStartedAt],
  );

  const recordAttempt = useCallback(
    (item: VocabItem, userInput: string, correct: boolean, revealedAnswer: boolean) => {
      const wasInWrongBook = Boolean(progressMap[item.id]?.inWrongBook);
      const updated = updateVocabProgress(item.id, correct);
      setProgressMap((prev) => ({ ...prev, [item.id]: updated }));

      const nextStreak = correct ? streak + 1 : 0;
      const nextBestStreak = Math.max(bestStreak, nextStreak);
      setStreak(nextStreak);
      setBestStreak(nextBestStreak);

      setSessionRecords((prev) => [
        ...prev,
        {
          item,
          userInput,
          correct,
          revealedAnswer,
        },
      ]);

      setAttemptResult({
        correct,
        revealedAnswer,
        userInput,
        wasInWrongBook,
        nowInWrongBook: updated.inWrongBook,
      });
      setInputWarning(null);
    },
    [progressMap, streak, bestStreak],
  );

  const handleNextWord = useCallback(() => {
    if (!attemptResult) return;
    if (currentIndex + 1 >= queue.length) {
      finalizeSession(sessionRecords, bestStreak);
      return;
    }
    stopSpeaking();
    setSpeakingWordId(null);
    setCurrentIndex((prev) => prev + 1);
    setInputValue('');
    setInputWarning(null);
    setHintCount(0);
    setAttemptResult(null);
  }, [attemptResult, currentIndex, queue.length, finalizeSession, sessionRecords, bestStreak]);

  // 判定结果显示后，即使焦点不在输入框，按 Enter 也可快速进入下一题
  useEffect(() => {
    if (activeTab !== 'practice' || sessionCompleted || !attemptResult) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      const target = event.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT') return;
      event.preventDefault();
      handleNextWord();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, sessionCompleted, attemptResult, handleNextWord]);

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentItem) return;

    if (attemptResult) {
      handleNextWord();
      return;
    }

    const normalizedInput = normalizeSpelling(inputValue);
    if (!normalizedInput) {
      setInputWarning('请先输入英文拼写，或使用下方「提示字母 / 显示答案」。');
      inputRef.current?.focus();
      return;
    }

    const isCorrect = normalizedInput === normalizeSpelling(currentItem.word);
    recordAttempt(currentItem, inputValue.trim(), isCorrect, false);
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

  const handleSwitchFilter = (mode: FilterMode) => {
    const latestProgress = getVocabProgress();
    setProgressMap(latestProgress);
    setFilterMode(mode);
    setActiveTab('practice');
    const items = buildFilteredItems(vocabList, latestProgress, mode);
    startSessionWithItems(items, shuffled, null);
  };

  const handleToggleShuffle = () => {
    const nextShuffled = !shuffled;
    setShuffled(nextShuffled);
    const latestProgress = getVocabProgress();
    setProgressMap(latestProgress);
    const items = buildFilteredItems(vocabList, latestProgress, filterMode);
    startSessionWithItems(items, nextShuffled, null);
  };

  const handleRestartCurrentFilter = () => {
    const latestProgress = getVocabProgress();
    setProgressMap(latestProgress);
    const items = buildFilteredItems(vocabList, latestProgress, filterMode);
    startSessionWithItems(items, shuffled, null);
  };

  const handlePracticeCustomWrong = (items: VocabItem[]) => {
    setActiveTab('practice');
    startSessionWithItems(items, shuffled, '本轮错词重练');
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
      startSessionWithItems([], shuffled, null);
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
        <SectionHeader title="单词拼写" subtitle="听音/看释义拼写、字母提示与错词本重练" />
        <Card>
          <div className="py-12 text-center text-sm text-slate-500">正在加载四级核心词库...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="单词拼写"
        subtitle={`已掌握 ${masteredCount} / ${vocabList.length} 词 · 错词本 ${wrongItems.length} 词`}
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
              拼写练习
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
                    : wrongItems.length > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {wrongItems.length}
              </span>
            </button>
          </div>
        }
      />

      {!speechSupported && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs sm:text-sm text-amber-800">
          <VolumeX className="h-4 w-4 shrink-0 text-amber-600" />
          <span>当前浏览器不支持 Web Speech API 语音朗读，发音按钮已禁用，拼写练习功能不受影响。</span>
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
        <WrongBookView
          wrongItems={wrongItems}
          progressMap={progressMap}
          speechSupported={speechSupported}
          speakingWordId={speakingWordId}
          accent={accent}
          onSpeak={handleSpeak}
          onStartWrongPractice={() => handleSwitchFilter('wrong')}
          onStartAllPractice={() => handleSwitchFilter('all')}
          onRemoveFromWrongBook={handleRemoveFromWrongBook}
          onClearAllWrongBook={handleClearAllWrongBook}
        />
      ) : (
        <>
          {/* 顶部筛选与工具栏 */}
          <Card className="p-3.5 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: '全部词库', count: vocabList.length },
                    { key: 'wrong', label: '仅练错词本', count: wrongItems.length },
                    { key: 'unmastered', label: '未掌握', count: unmasteredItems.length },
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
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAccent('en-US')}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                      accent === 'en-US'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    美音 US
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccent('en-GB')}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                      accent === 'en-GB'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    英音 UK
                  </button>
                </div>

                <Button
                  variant={shuffled ? 'primary' : 'secondary'}
                  className="px-2.5 py-1.5 text-xs"
                  onClick={handleToggleShuffle}
                  title="切换顺序/乱序练习"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  {shuffled ? '乱序中' : '顺序'}
                </Button>

                <Button
                  variant="secondary"
                  className="px-2.5 py-1.5 text-xs"
                  onClick={handleRestartCurrentFilter}
                  title="重新开始本轮"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  重置本轮
                </Button>
              </div>
            </div>

            {!sessionCompleted && queue.length > 0 && (
              <div className="mt-3.5 border-t border-slate-100 pt-3">
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
                    ? '太棒了！当前词库已全部掌握'
                    : '暂无可练习的单词'
              }
              description={
                filterMode === 'wrong'
                  ? '拼错的单词会自动加入错词本，你可以先练习全部词库。'
                  : filterMode === 'unmastered'
                    ? '可以切换回「全部词库」复习巩固，或前往「设置与导入」添加自定义四级词库。'
                    : '请前往「设置与导入」导入词库 JSON。'
              }
              action={
                filterMode !== 'all' ? (
                  <Button onClick={() => handleSwitchFilter('all')}>切换到全部词库</Button>
                ) : undefined
              }
            />
          ) : (
            <Card className="space-y-5">
              {/* 单词提示头：词性、音标、标签与发音 */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="indigo">{currentItem.pos}</Badge>
                    {currentItem.phonetic && (
                      <span className="font-mono text-sm text-slate-500">
                        {currentItem.phonetic}
                      </span>
                    )}
                    {currentProgress?.inWrongBook && <Badge tone="rose">错词本</Badge>}
                    {isWordMastered(currentProgress) && <Badge tone="emerald">已掌握</Badge>}
                    {currentItem.tags?.map((tag) => (
                      <Badge key={tag} tone="slate">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold leading-snug text-slate-900">
                    {currentItem.meaning}
                  </h2>
                </div>

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
              </div>

              {/* 例句挖空区域 */}
              {currentItem.example && maskedExample && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
                  <p className="text-xs font-medium text-slate-500">例句语境</p>
                  <p className="mt-1.5 text-sm sm:text-base leading-relaxed text-slate-800 break-words">
                    {maskedExample.segments.map((seg, idx) => {
                      if (!seg.masked) {
                        return <span key={idx}>{seg.text}</span>;
                      }
                      if (attemptResult) {
                        return (
                          <span
                            key={idx}
                            className={`mx-0.5 inline-block rounded-md px-1.5 py-0.5 font-semibold ${
                              attemptResult.correct
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {seg.text}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={idx}
                          className="mx-1 inline-block min-w-[4.5rem] border-b-2 border-indigo-400 px-1 text-center font-mono text-sm font-semibold text-indigo-500"
                          aria-label="待拼写单词空白"
                        >
                          ________
                        </span>
                      );
                    })}
                  </p>
                  {currentItem.exampleCn && (
                    <p className="mt-2 text-xs sm:text-sm text-slate-500">
                      {currentItem.exampleCn}
                    </p>
                  )}
                </div>
              )}

              {/* 逐字母提示展示 */}
              {hintCount > 0 && !attemptResult && (
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

              {/* 拼写输入表单 */}
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
                    placeholder="输入英文单词拼写，按 Enter 提交..."
                    className={`w-full flex-1 rounded-xl border px-4 py-3 font-mono text-base sm:text-lg transition-colors focus:outline-none ${
                      attemptResult
                        ? attemptResult.correct
                          ? 'border-emerald-300 bg-emerald-50/60 text-emerald-900'
                          : 'border-rose-300 bg-rose-50/60 text-rose-900'
                        : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                    }`}
                  />

                  {!attemptResult ? (
                    <Button type="submit" className="py-3 sm:px-6">
                      提交拼写
                    </Button>
                  ) : (
                    <Button type="submit" className="py-3 sm:px-6">
                      {currentIndex + 1 >= queue.length ? '查看本轮结算' : '下一题'}
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
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-1.5 text-xs sm:text-sm"
                        onClick={handleHintLetter}
                        disabled={hintCount >= currentItem.word.trim().length}
                      >
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        {hintCount === 0 ? '提示首字母' : `再提示 1 字母 (${hintCount}/${currentItem.word.length})`}
                      </Button>

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
                        结束并记录本轮（已答 {answeredCount} 词）
                      </Button>
                    )}
                  </div>
                )}
              </form>

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
                            ? '拼写正确！'
                            : attemptResult.revealedAnswer
                              ? '已显示答案（已记入错词本）'
                              : '拼写有误（已加入错词本）'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-7 text-sm">
                        <span className="text-slate-600">
                          正确拼写：
                          <strong className="ml-1 font-mono text-base text-slate-900">
                            {currentItem.word}
                          </strong>
                        </span>
                        {!attemptResult.correct && !attemptResult.revealedAnswer && (
                          <span className="text-rose-700">
                            你的输入：
                            <span className="ml-1 font-mono line-through">
                              {attemptResult.userInput}
                            </span>
                          </span>
                        )}
                      </div>

                      {attemptResult.correct && attemptResult.wasInWrongBook && (
                        <p className="pl-7 text-xs font-medium text-emerald-700">
                          {attemptResult.nowInWrongBook
                            ? '错词复练通过 1 次，再拼对 1 次即可自动移出错词本。'
                            : '连续攻克成功，该词已自动移出错词本！'}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                      <span className="hidden text-xs text-slate-500 sm:inline">
                        按 Enter 快速继续
                      </span>
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

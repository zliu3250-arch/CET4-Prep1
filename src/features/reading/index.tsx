import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ClipboardCheck, FileText, AlertTriangle } from 'lucide-react';
import {
  Badge,
  Card,
  EmptyState,
  SectionHeader,
  TimerBar,
} from '../../components/ui';
import { appendPracticeLog, getReadingPassages } from '../../services/storage';
import type { ReadingPassage } from '../../types/cet4';
import { PassageViewer } from './PassageViewer';
import { QuestionList } from './QuestionList';
import {
  READING_TYPE_META,
  formatDuration,
  type FontSizeMode,
  type GradeSummary,
  type MobileTab,
  type ReadingFilterType,
} from './types';

const FILTER_TABS: Array<{ key: ReadingFilterType; label: string }> = [
  { key: 'all', label: '全部题型' },
  { key: 'careful', label: '仔细阅读' },
  { key: 'banked_cloze', label: '选词填空' },
  { key: 'matching', label: '长篇匹配' },
];

export default function ReadingPage() {
  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<ReadingFilterType>('all');
  const [selectedPassageId, setSelectedPassageId] = useState<string>('');
  const [fontSize, setFontSize] = useState<FontSizeMode>('standard');
  const [mobileTab, setMobileTab] = useState<MobileTab>('passage');

  // 作答状态
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [gradeSummary, setGradeSummary] = useState<GradeSummary | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [highlightedParagraph, setHighlightedParagraph] = useState<string | null>(null);

  // 计时状态
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // 加载内置 + 自定义阅读题库
  useEffect(() => {
    let active = true;
    setLoading(true);
    getReadingPassages()
      .then((list) => {
        if (!active) return;
        setPassages(list);
        if (list.length > 0) {
          setSelectedPassageId(list[0].id);
        }
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : '加载阅读题库失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 按题型统计数量
  const typeCounts = useMemo(() => {
    const counts: Record<ReadingFilterType, number> = {
      all: passages.length,
      careful: 0,
      banked_cloze: 0,
      matching: 0,
    };
    for (const p of passages) {
      counts[p.type] += 1;
    }
    return counts;
  }, [passages]);

  // 过滤后的篇章列表
  const filteredPassages = useMemo(() => {
    if (filterType === 'all') return passages;
    return passages.filter((p) => p.type === filterType);
  }, [passages, filterType]);

  // 当前选中的篇章
  const currentPassage = useMemo(() => {
    if (filteredPassages.length === 0) return null;
    return (
      filteredPassages.find((p) => p.id === selectedPassageId) ??
      filteredPassages[0]
    );
  }, [filteredPassages, selectedPassageId]);

  // 切换筛选导致当前篇章不在列表中时，自动选中第一篇
  useEffect(() => {
    if (
      filteredPassages.length > 0 &&
      !filteredPassages.some((p) => p.id === selectedPassageId)
    ) {
      setSelectedPassageId(filteredPassages[0].id);
    }
  }, [filteredPassages, selectedPassageId]);

  // 重置作答与计时器
  const resetPassageState = useCallback((passage: ReadingPassage | null) => {
    setAnswers({});
    setSubmitted(false);
    setGradeSummary(null);
    setHighlightedParagraph(null);
    setActiveQuestionId(
      passage?.type === 'banked_cloze' && passage.questions.length > 0
        ? passage.questions[0].id
        : null,
    );
    const totalSecs = Math.max(1, passage?.suggestedMinutes ?? 10) * 60;
    setSecondsLeft(totalSecs);
    setElapsedSeconds(0);
    setTimerRunning(Boolean(passage));
  }, []);

  // 当前篇章 ID 变化时初始化状态
  useEffect(() => {
    resetPassageState(currentPassage);
  }, [currentPassage?.id, resetPassageState]); // eslint-disable-line react-hooks/exhaustive-deps

  // 倒计时与实际用时统计
  useEffect(() => {
    if (!timerRunning || submitted || !currentPassage) return;
    const timerId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [timerRunning, submitted, currentPassage]);

  const answeredCount = useMemo(() => {
    if (!currentPassage) return 0;
    return currentPassage.questions.reduce(
      (acc, q) => (answers[q.id] ? acc + 1 : acc),
      0,
    );
  }, [currentPassage, answers]);

  const handleSelectAnswer = useCallback(
    (questionId: string, label: string) => {
      if (submitted) return;
      setAnswers((prev) => {
        if (!label) {
          const next = { ...prev };
          delete next[questionId];
          return next;
        }
        return { ...prev, [questionId]: label };
      });
    },
    [submitted],
  );

  // 点击原文中的选词填空空位：高亮该题，移动端若在看原文则可聚焦并让用户直接点词库
  const handleSelectBlankQuestion = useCallback((questionId: string) => {
    setActiveQuestionId(questionId);
  }, []);

  // 在选词填空词库中点击词汇：填入当前聚焦的空位（若未聚焦则选第一个未填的空）
  const handlePickWordFromBank = useCallback(
    (label: string) => {
      if (submitted || !currentPassage || currentPassage.type !== 'banked_cloze') {
        return;
      }
      let targetQ = currentPassage.questions.find(
        (q) => q.id === activeQuestionId,
      );
      if (!targetQ) {
        targetQ =
          currentPassage.questions.find((q) => !answers[q.id]) ??
          currentPassage.questions[0];
      }
      if (!targetQ) return;

      const currentVal = answers[targetQ.id];
      const nextVal = currentVal === label ? '' : label;
      handleSelectAnswer(targetQ.id, nextVal);

      // 填完当前空后，自动跳到下一个尚未作答的空位，提升做题流畅度
      if (nextVal) {
        const nextEmpty = currentPassage.questions.find(
          (q) => q.id !== targetQ.id && !answers[q.id],
        );
        if (nextEmpty) {
          setActiveQuestionId(nextEmpty.id);
        }
      }
    },
    [submitted, currentPassage, activeQuestionId, answers, handleSelectAnswer],
  );

  // 交卷判分并落盘 PracticeLog
  const handleSubmit = useCallback(() => {
    if (!currentPassage || submitted) return;

    const total = currentPassage.questions.length;
    let correctCount = 0;
    let unansweredCount = 0;

    for (const q of currentPassage.questions) {
      const userAns = answers[q.id];
      if (!userAns) {
        unansweredCount += 1;
      } else if (userAns === q.answer) {
        correctCount += 1;
      }
    }

    const wrongCount = total - correctCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const durationSeconds = Math.max(1, elapsedSeconds);

    const summary: GradeSummary = {
      total,
      correctCount,
      wrongCount,
      unansweredCount,
      accuracy,
      score: accuracy,
      maxScore: 100,
      durationSeconds,
    };

    setSubmitted(true);
    setTimerRunning(false);
    setGradeSummary(summary);

    const typeLabel = READING_TYPE_META[currentPassage.type].label;
    appendPracticeLog({
      module: 'reading',
      title: currentPassage.title,
      score: summary.score,
      maxScore: summary.maxScore,
      accuracy: summary.accuracy,
      durationSeconds: summary.durationSeconds,
      detail: `${typeLabel} · 答对 ${correctCount}/${total} 题 · 用时 ${formatDuration(durationSeconds)}`,
    });
  }, [currentPassage, submitted, answers, elapsedSeconds]);

  // 定位到原文段落（移动端自动切到「看原文」Tab）
  const handleLocateParagraph = useCallback((paragraphLabel: string) => {
    setHighlightedParagraph(paragraphLabel.toUpperCase());
    setMobileTab('passage');
  }, []);

  // 重置当前计时器
  const handleResetTimer = useCallback(() => {
    if (!currentPassage) return;
    setSecondsLeft(Math.max(1, currentPassage.suggestedMinutes) * 60);
    setElapsedSeconds(0);
    setTimerRunning(!submitted);
  }, [currentPassage, submitted]);

  return (
    <div className="space-y-4">
      {/* 页面头部 + 计时器 */}
      <SectionHeader
        title="阅读理解"
        subtitle="仔细阅读 / 选词填空 / 长篇匹配 · 自动判分与原文定位"
        action={
          currentPassage ? (
            <TimerBar
              secondsLeft={secondsLeft}
              running={timerRunning && !submitted}
              onToggle={() => {
                if (!submitted) setTimerRunning((r) => !r);
              }}
              onReset={handleResetTimer}
            />
          ) : undefined
        }
      />

      {/* 倒计时归零提示 */}
      {currentPassage && secondsLeft === 0 && !submitted && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs sm:text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            本篇建议用时（{currentPassage.suggestedMinutes} 分钟）已到，你仍可继续完成作答后交卷。
          </span>
        </div>
      )}

      {/* 题型筛选与篇章选择器 */}
      <Card className="space-y-3 p-3.5 sm:p-4">
        {/* 题型筛选 Tab */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => {
            const active = filterType === tab.key;
            const count = typeCounts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterType(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[11px] font-semibold ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 篇章切换条 */}
        {filteredPassages.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {filteredPassages.map((p, index) => {
              const active = currentPassage?.id === p.id;
              const meta = READING_TYPE_META[p.type];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPassageId(p.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-xs sm:text-sm transition-colors max-w-full cursor-pointer ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-800 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate max-w-[180px] sm:max-w-[260px]">
                    {index + 1}. {p.title}
                  </span>
                  <Badge tone={meta.badgeTone} className="shrink-0">
                    {meta.shortLabel}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* 加载中 / 错误 / 空状态 */}
      {loading ? (
        <Card className="py-12 text-center text-sm text-slate-500">
          正在加载阅读理解题库...
        </Card>
      ) : loadError ? (
        <EmptyState title="加载失败" description={loadError} />
      ) : !currentPassage ? (
        <EmptyState
          title={`暂无「${
            FILTER_TABS.find((t) => t.key === filterType)?.label ?? '该题型'
          }」篇章`}
          description="可切换其他题型练习，或在「设置与导入」页面导入自定义阅读 JSON 题库。"
        />
      ) : (
        <>
          {/* 移动端顶部 sticky Tab：快速切换「看原文 / 做题」 */}
          <div className="lg:hidden sticky top-[52px] md:top-0 z-10 -mx-1 px-1 py-1.5 bg-slate-50/95 backdrop-blur">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setMobileTab('passage')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer ${
                  mobileTab === 'passage'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>看原文</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('questions')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer ${
                  mobileTab === 'questions'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>做题</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                    mobileTab === 'questions'
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {answeredCount}/{currentPassage.questions.length}
                </span>
              </button>
            </div>
          </div>

          {/* 桌面端（lg: 及以上）左右分栏各自独立滚动；移动端按 Tab 展示 */}
          <div className="lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start">
            {/* 左栏：原文区域 */}
            <div
              className={`${
                mobileTab === 'passage' ? 'block' : 'hidden'
              } lg:block lg:col-span-7 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1`}
            >
              <PassageViewer
                passage={currentPassage}
                fontSize={fontSize}
                onChangeFontSize={setFontSize}
                answers={answers}
                submitted={submitted}
                activeQuestionId={activeQuestionId}
                highlightedParagraph={highlightedParagraph}
                onSelectBlankQuestion={handleSelectBlankQuestion}
                onPickWordFromBank={handlePickWordFromBank}
              />
            </div>

            {/* 右栏：题目与解析区域 */}
            <div
              className={`${
                mobileTab === 'questions' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1`}
            >
              <QuestionList
                passage={currentPassage}
                answers={answers}
                submitted={submitted}
                gradeSummary={gradeSummary}
                activeQuestionId={activeQuestionId}
                onSelectAnswer={handleSelectAnswer}
                onFocusQuestion={setActiveQuestionId}
                onSubmit={handleSubmit}
                onReset={() => resetPassageState(currentPassage)}
                onLocateParagraph={handleLocateParagraph}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

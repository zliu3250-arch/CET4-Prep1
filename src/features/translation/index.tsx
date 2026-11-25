import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Eraser,
  FileCheck2,
  History,
  Languages,
  Send,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, SectionHeader, TimerBar } from '../../components/ui';
import { appendPracticeLog, getTranslationItems } from '../../services/storage';
import type { AIGradeResult, TranslationItem } from '../../types/cet4';
import { FeedbackPanel } from './components/FeedbackPanel';
import { HintCards } from './components/HintCards';
import { HistoryPanel } from './components/HistoryPanel';
import {
  addTranslationSubmission,
  countEnglishWords,
  deleteTranslationSubmission,
  getTranslationDrafts,
  getTranslationHistory,
  saveTranslationDraft,
  updateTranslationSubmission,
  type TranslationSubmission,
} from './storage';

type ViewTab = 'practice' | 'feedback' | 'history';

const DEFAULT_MINUTES = 30;

export default function TranslationPage() {
  const [items, setItems] = useState<TranslationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string>('全部');
  const [activeItemId, setActiveItemId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ViewTab>('practice');

  const [drafts, setDrafts] = useState<Record<string, string>>(() => getTranslationDrafts());
  const [history, setHistory] = useState<TranslationSubmission[]>(() => getTranslationHistory());
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [draftSavedHint, setDraftSavedHint] = useState(false);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);

  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_MINUTES * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let mounted = true;
    getTranslationItems()
      .then((list) => {
        if (!mounted) return;
        setItems(list);
        if (list.length > 0) {
          setActiveItemId(list[0].id);
          setSecondsLeft((list[0].suggestedMinutes || DEFAULT_MINUTES) * 60);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.topic) set.add(item.topic);
    }
    return ['全部', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedTopic === '全部') return items;
    return items.filter((item) => item.topic === selectedTopic);
  }, [items, selectedTopic]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? items[0] ?? null,
    [items, activeItemId],
  );

  const initialDurationSeconds = (activeItem?.suggestedMinutes || DEFAULT_MINUTES) * 60;

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const activeDraft = activeItem ? (drafts[activeItem.id] ?? '') : '';
  const wordCount = useMemo(() => countEnglishWords(activeDraft), [activeDraft]);

  const activeSubmission = useMemo(
    () => history.find((record) => record.id === activeSubmissionId) ?? null,
    [history, activeSubmissionId],
  );

  const feedbackItem = useMemo(() => {
    if (activeSubmission) {
      return items.find((item) => item.id === activeSubmission.itemId) ?? activeItem;
    }
    return activeItem;
  }, [activeSubmission, items, activeItem]);

  const practiceCountByItem = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const record of history) {
      counts[record.itemId] = (counts[record.itemId] ?? 0) + 1;
    }
    return counts;
  }, [history]);

  const handleSelectItem = useCallback((item: TranslationItem) => {
    setActiveItemId(item.id);
    setRevealedHints([]);
    setSubmitWarning(null);
    setTimerRunning(false);
    setSecondsLeft((item.suggestedMinutes || DEFAULT_MINUTES) * 60);
    setActiveTab('practice');
  }, []);

  const handleDraftChange = useCallback(
    (nextText: string) => {
      if (!activeItem) return;
      setSubmitWarning(null);
      setDrafts((prev) => ({ ...prev, [activeItem.id]: nextText }));
      saveTranslationDraft(activeItem.id, nextText);
      setDraftSavedHint(true);
      if (!timerRunning && secondsLeft === initialDurationSeconds && nextText.trim().length > 0) {
        setTimerRunning(true);
      }
    },
    [activeItem, timerRunning, secondsLeft, initialDurationSeconds],
  );

  useEffect(() => {
    if (!draftSavedHint) return;
    const t = window.setTimeout(() => setDraftSavedHint(false), 1600);
    return () => window.clearTimeout(t);
  }, [draftSavedHint]);

  const handleClearDraft = () => {
    if (!activeItem || !activeDraft) return;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activeItem.id];
      return next;
    });
    saveTranslationDraft(activeItem.id, '');
    setSubmitWarning(null);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setSecondsLeft(initialDurationSeconds);
  };

  const handleToggleHint = (index: number) => {
    setRevealedHints((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const handleRevealAllHints = () => {
    if (!activeItem) return;
    setRevealedHints(activeItem.hints.map((_, idx) => idx));
  };

  const handleHideAllHints = () => {
    setRevealedHints([]);
  };

  const handleSubmit = () => {
    if (!activeItem) return;
    const trimmed = activeDraft.trim();
    if (!trimmed) {
      setSubmitWarning('请先输入你的英文译文后再交卷。');
      return;
    }

    setTimerRunning(false);
    const spentSeconds = Math.max(1, initialDurationSeconds - secondsLeft);
    const words = countEnglishWords(trimmed);

    const { entry, list } = addTranslationSubmission({
      itemId: activeItem.id,
      title: activeItem.title,
      topic: activeItem.topic,
      answer: trimmed,
      wordCount: words,
      durationSeconds: spentSeconds,
      checkedPhrases: [],
    });

    appendPracticeLog({
      module: 'translation',
      title: activeItem.title,
      durationSeconds: spentSeconds,
      detail: `主题：${activeItem.topic} · 译文 ${words} 词`,
    });

    setHistory(list);
    setActiveSubmissionId(entry.id);
    setActiveTab('feedback');
  };

  const handleTogglePhrase = (phrase: string) => {
    if (!activeSubmission) return;
    const exists = activeSubmission.checkedPhrases.includes(phrase);
    const nextChecked = exists
      ? activeSubmission.checkedPhrases.filter((p) => p !== phrase)
      : [...activeSubmission.checkedPhrases, phrase];
    const nextList = updateTranslationSubmission(activeSubmission.id, {
      checkedPhrases: nextChecked,
    });
    setHistory(nextList);
  };

  const handleSaveAIResult = (result: AIGradeResult) => {
    if (!activeSubmission) return;
    const nextList = updateTranslationSubmission(activeSubmission.id, {
      aiResult: result,
    });
    setHistory(nextList);
  };

  const handleSelectHistoryRecord = (record: TranslationSubmission) => {
    setActiveSubmissionId(record.id);
    const matchedItem = items.find((item) => item.id === record.itemId);
    if (matchedItem) {
      setActiveItemId(matchedItem.id);
    }
    setActiveTab('feedback');
  };

  const handleDeleteHistoryRecord = (id: string) => {
    const nextList = deleteTranslationSubmission(id);
    setHistory(nextList);
    if (activeSubmissionId === id) {
      setActiveSubmissionId(nextList[0]?.id ?? null);
      if (activeTab === 'feedback') {
        setActiveTab(nextList.length > 0 ? 'history' : 'practice');
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="翻译训练"
          subtitle="四级汉译英段落、难点词汇提示、参考译文与可选 AI 点评"
        />
        <Card className="py-12 text-center text-sm text-slate-500">正在加载翻译题库...</Card>
      </div>
    );
  }

  if (!activeItem) {
    return (
      <div>
        <SectionHeader
          title="翻译训练"
          subtitle="四级汉译英段落、难点词汇提示、参考译文与可选 AI 点评"
        />
        <EmptyState
          title="暂无翻译题目"
          description="当前题库中没有可用的翻译段落，你可以前往「设置」导入自定义 JSON 翻译题库。"
          action={
            <a
              href="#/settings"
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              前往设置导入题库
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 min-w-0">
      <SectionHeader
        title="翻译训练"
        subtitle="四级汉译英段落、难点词汇提示、参考译文与可选 AI 点评"
        action={
          <TimerBar
            secondsLeft={secondsLeft}
            running={timerRunning}
            onToggle={() => setTimerRunning((prev) => !prev)}
            onReset={handleResetTimer}
          />
        }
      />

      {/* 顶部模式切换栏 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <Button
          type="button"
          variant={activeTab === 'practice' ? 'primary' : 'secondary'}
          className="px-3.5 py-1.5 text-xs sm:text-sm"
          onClick={() => setActiveTab('practice')}
        >
          <Languages className="h-4 w-4" />
          汉译英练习
        </Button>
        <Button
          type="button"
          variant={activeTab === 'feedback' ? 'primary' : 'secondary'}
          className="px-3.5 py-1.5 text-xs sm:text-sm"
          disabled={!activeSubmission}
          onClick={() => setActiveTab('feedback')}
        >
          <FileCheck2 className="h-4 w-4" />
          交卷反馈
          {activeSubmission?.aiResult && <Sparkles className="h-3.5 w-3.5 text-amber-300" />}
        </Button>
        <Button
          type="button"
          variant={activeTab === 'history' ? 'primary' : 'secondary'}
          className="px-3.5 py-1.5 text-xs sm:text-sm"
          onClick={() => setActiveTab('history')}
        >
          <History className="h-4 w-4" />
          练习历史
          <span
            className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] ${
              activeTab === 'history'
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {history.length}
          </span>
        </Button>
      </div>

      {/* 视图 1：练习模式 */}
      {activeTab === 'practice' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* 左侧 / 顶部：选题列表 */}
          <div className="space-y-3 lg:col-span-4 min-w-0">
            <Card>
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  选题列表
                </h2>
                <span className="text-xs text-slate-400">共 {filteredItems.length} 篇</span>
              </div>

              {/* 主题筛选胶囊 */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {topics.map((topic) => {
                  const selected = topic === selectedTopic;
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setSelectedTopic(topic)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>

              {/* 题目卡片列表 */}
              <div className="mt-3 space-y-2">
                {filteredItems.map((item) => {
                  const isActive = item.id === activeItem.id;
                  const hasDraft = Boolean(drafts[item.id]?.trim());
                  const doneCount = practiceCountByItem[item.id] ?? 0;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <Badge tone={isActive ? 'indigo' : 'slate'}>{item.topic}</Badge>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="h-3 w-3" />
                          建议 {item.suggestedMinutes} 分钟
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-slate-900">{item.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {hasDraft && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                            有未提交草稿
                          </span>
                        )}
                        {doneCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            已练 {doneCount} 次
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* 右侧 / 主体：原文 + 提示卡 + 译文输入区 */}
          <div className="space-y-4 lg:col-span-8 min-w-0">
            {secondsLeft === 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                30 分钟参考计时已结束，你可以继续完成译文后交卷，或点击右上角重置计时。
              </div>
            )}

            {/* 中文原文卡片 */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="indigo">{activeItem.topic}</Badge>
                  <span className="text-xs text-slate-500">
                    建议用时 {activeItem.suggestedMinutes} 分钟 · 原文 {activeItem.sourceText.length} 字
                  </span>
                </div>
              </div>
              <h2 className="mt-2 text-lg font-bold text-slate-900">{activeItem.title}</h2>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm sm:text-base leading-7 sm:leading-8 text-slate-800">
                  {activeItem.sourceText}
                </p>
              </div>
            </Card>

            {/* 核心难点词汇提示卡 */}
            <HintCards
              hints={activeItem.hints}
              revealedIndices={revealedHints}
              onToggleHint={handleToggleHint}
              onRevealAll={handleRevealAllHints}
              onHideAll={handleHideAllHints}
            />

            {/* 译文输入卡片 */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label
                    htmlFor="translation-answer-input"
                    className="text-sm font-bold text-slate-900"
                  >
                    你的英文译文
                  </label>
                  <p className="text-xs text-slate-500">
                    输入内容会自动保存为本地草稿；开始输入时计时器将自动启动。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {draftSavedHint && (
                    <span className="text-xs text-emerald-600">草稿已自动保存</span>
                  )}
                  <Badge tone="slate">当前 {wordCount} 词</Badge>
                </div>
              </div>

              <textarea
                id="translation-answer-input"
                value={activeDraft}
                onChange={(e) => handleDraftChange(e.target.value)}
                rows={8}
                placeholder="请在此输入你的英文译文（例如：In recent years, ...）"
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />

              {submitWarning && (
                <p className="mt-2 text-xs font-medium text-rose-600">{submitWarning}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!activeDraft}
                  onClick={handleClearDraft}
                >
                  <Eraser className="h-4 w-4" />
                  清空当前草稿
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="primary" onClick={handleSubmit}>
                    <Send className="h-4 w-4" />
                    交卷对照范文
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 视图 2：交卷反馈 */}
      {activeTab === 'feedback' && activeSubmission && feedbackItem && (
        <FeedbackPanel
          item={feedbackItem}
          submission={activeSubmission}
          onTogglePhrase={handleTogglePhrase}
          onSaveAIResult={handleSaveAIResult}
          onBackToPractice={() => setActiveTab('practice')}
        />
      )}

      {/* 视图 3：练习历史 */}
      {activeTab === 'history' && (
        <HistoryPanel
          records={history}
          activeRecordId={activeSubmissionId}
          onSelectRecord={handleSelectHistoryRecord}
          onDeleteRecord={handleDeleteHistoryRecord}
        />
      )}
    </div>
  );
}

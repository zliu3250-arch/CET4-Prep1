import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  History,
  Lightbulb,
  PenLine,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeader,
  TimerBar,
} from '../../components/ui';
import { QuestionPickerBar, sortByNewestFirst } from '../../components/ui/QuestionPickerBar';
import { gradeWriting } from '../../services/aiGrader';
import {
  appendPracticeLog,
  getWritingPrompts,
  hasValidAIConfig,
} from '../../services/storage';
import type { AIErrorCode, AIGradeResult, WritingPrompt } from '../../types/cet4';
import { FeedbackPanel } from './components/FeedbackPanel';
import { HistoryDrawer } from './components/HistoryDrawer';
import type { WritingCategoryFilter, WritingSubmission } from './types';
import {
  clearDraft,
  countEnglishWords,
  formatClockTime,
  getWordCountStatus,
  hasSavedDraft,
  readDraft,
  readSubmissions,
  saveDraft,
  saveSubmissions,
  WRITING_CATEGORIES,
} from './utils';

interface AIErrorState {
  errorCode: AIErrorCode;
  message: string;
}

export default function WritingPage() {
  const [prompts, setPrompts] = useState<WritingPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<WritingCategoryFilter>('全部');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');

  // 编辑器与草稿状态
  const [essay, setEssay] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [insertedNotice, setInsertedNotice] = useState<string | null>(null);
  const [helperOpen, setHelperOpen] = useState(false);

  // 倒计时器状态
  const [secondsLeft, setSecondsLeft] = useState(30 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // 历史提交与反馈状态
  const [submissions, setSubmissions] = useState<WritingSubmission[]>(() => readSubmissions());
  const [showHistory, setShowHistory] = useState(false);
  const [historyCurrentOnly, setHistoryCurrentOnly] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);

  // AI 批改状态
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIGradeResult | null>(null);
  const [aiError, setAiError] = useState<AIErrorState | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const feedbackAnchorRef = useRef<HTMLDivElement | null>(null);
  const isHydratingDraftRef = useRef(false);

  // 加载写作题库
  useEffect(() => {
    let mounted = true;
    getWritingPrompts()
      .then((list) => {
        if (!mounted) return;
        const sorted = sortByNewestFirst(list);
        setPrompts(sorted);
        if (sorted.length > 0) {
          setSelectedPromptId(sorted[0].id);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredPrompts = useMemo(() => {
    if (categoryFilter === '全部') return prompts;
    return prompts.filter((p) => p.category === categoryFilter);
  }, [prompts, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<WritingCategoryFilter, number> = {
      全部: prompts.length,
      议论文: 0,
      应用文: 0,
      '图画/图表': 0,
      现象分析: 0,
    };
    for (const p of prompts) {
      counts[p.category] += 1;
    }
    return counts;
  }, [prompts]);

  const activePrompt = useMemo(
    () => prompts.find((p) => p.id === selectedPromptId) ?? filteredPrompts[0] ?? prompts[0] ?? null,
    [prompts, filteredPrompts, selectedPromptId],
  );

  // 切换题目时恢复独立草稿与重置计时器
  useEffect(() => {
    if (!activePrompt) return;
    isHydratingDraftRef.current = true;
    const saved = readDraft(activePrompt.id);
    setEssay(saved?.content ?? '');
    setDraftSavedAt(saved?.updatedAt ?? null);
    setSecondsLeft(activePrompt.suggestedMinutes * 60);
    setTimerRunning(false);
    setConfirmClear(false);
    setActiveSubmissionId(null);
    setAiResult(null);
    setAiError(null);
    setAiLoading(false);
    // 下一帧恢复自动保存监听
    const frame = window.requestAnimationFrame(() => {
      isHydratingDraftRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePrompt?.id]);

  // 自动保存草稿到独立 localStorage key
  useEffect(() => {
    if (!activePrompt || isHydratingDraftRef.current) return;
    const timer = window.setTimeout(() => {
      const saved = saveDraft(activePrompt.id, essay);
      setDraftSavedAt(essay.trim() ? saved.updatedAt : null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activePrompt, essay]);

  // 30 分钟倒计时器
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const activeSubmission = useMemo(
    () => submissions.find((s) => s.id === activeSubmissionId) ?? null,
    [submissions, activeSubmissionId],
  );

  const wordCount = useMemo(() => countEnglishWords(essay), [essay]);

  const wordStatus = useMemo(() => {
    if (!activePrompt) {
      return { tone: 'slate' as const, label: '未开始', hint: '' };
    }
    return getWordCountStatus(wordCount, activePrompt.minWords, activePrompt.maxWords);
  }, [activePrompt, wordCount]);

  const wordProgressPercent = useMemo(() => {
    if (!activePrompt || activePrompt.maxWords <= 0) return 0;
    return Math.min(100, Math.round((wordCount / activePrompt.maxWords) * 100));
  }, [activePrompt, wordCount]);

  const handleSelectPrompt = (promptId: string) => {
    setSelectedPromptId(promptId);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  };

  const handleResetTimer = () => {
    if (!activePrompt) return;
    setTimerRunning(false);
    setSecondsLeft(activePrompt.suggestedMinutes * 60);
  };

  const handleClearDraft = () => {
    if (!activePrompt) return;
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    clearDraft(activePrompt.id);
    setEssay('');
    setDraftSavedAt(null);
    setConfirmClear(false);
  };

  const handleInsertExpression = (expr: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? essay.length;
      const end = el.selectionEnd ?? essay.length;
      const prefix = start > 0 && !/\s$/.test(essay.slice(0, start)) ? ' ' : '';
      const suffix = end < essay.length && !/^\s/.test(essay.slice(end)) ? ' ' : '';
      const next = `${essay.slice(0, start)}${prefix}${expr}${suffix}${essay.slice(end)}`;
      setEssay(next);
      window.requestAnimationFrame(() => {
        el.focus();
        const cursor = start + prefix.length + expr.length + suffix.length;
        el.setSelectionRange(cursor, cursor);
      });
    } else {
      setEssay((prev) => (prev.trim() ? `${prev.trimEnd()} ${expr}` : expr));
    }
    setInsertedNotice(expr);
    window.setTimeout(() => setInsertedNotice(null), 1800);
  };

  const createSubmissionRecord = (logOffline: boolean): WritingSubmission | null => {
    if (!activePrompt || !essay.trim()) return null;
    setTimerRunning(false);
    const totalBudget = activePrompt.suggestedMinutes * 60;
    const durationSeconds = Math.max(1, totalBudget - secondsLeft);
    const currentCount = countEnglishWords(essay);
    const initialChecks: string[] = [];
    if (currentCount >= activePrompt.minWords && currentCount <= activePrompt.maxWords) {
      initialChecks.push('wordCount');
    }

    const record: WritingSubmission = {
      id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      promptId: activePrompt.id,
      promptTitle: activePrompt.title,
      category: activePrompt.category,
      essay: essay.trim(),
      wordCount: currentCount,
      durationSeconds,
      selfChecks: initialChecks,
      createdAt: new Date().toISOString(),
    };

    const nextList = [record, ...submissions];
    setSubmissions(nextList);
    saveSubmissions(nextList);
    setActiveSubmissionId(record.id);
    setAiResult(null);
    setAiError(null);

    if (logOffline) {
      appendPracticeLog({
        module: 'writing',
        title: activePrompt.title,
        durationSeconds,
        detail: `离线交卷自评 · ${currentCount} 词`,
      });
    }

    window.setTimeout(() => {
      feedbackAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);

    return record;
  };

  const handleSubmitOffline = () => {
    createSubmissionRecord(true);
  };

  const runAIGradingForRecord = async (record: WritingSubmission, prompt: WritingPrompt) => {
    setAiError(null);
    if (!hasValidAIConfig()) {
      setAiError({
        errorCode: 'no_key',
        message:
          '尚未配置 AI API Key。请前往「设置」填入你自己的 OpenAI 兼容端点与 Key，或直接使用下方离线范文对照自评。',
      });
      return;
    }

    setAiLoading(true);
    try {
      const response = await gradeWriting({ prompt, essay: record.essay });
      if (!response.ok) {
        setAiError({
          errorCode: response.errorCode,
          message: response.message,
        });
        return;
      }

      setAiResult(response.result);
      setSubmissions((prev) => {
        const updated = prev.map((item) =>
          item.id === record.id ? { ...item, aiResult: response.result } : item,
        );
        saveSubmissions(updated);
        return updated;
      });

      appendPracticeLog({
        module: 'writing',
        title: prompt.title,
        score: response.result.score15,
        maxScore: 15,
        accuracy: Math.round((response.result.score15 / 15) * 100),
        durationSeconds: record.durationSeconds,
        detail: `AI 批改 · ${response.result.score15.toFixed(1)}/15（换算 ${response.result.score106.toFixed(1)}/106.5）· ${record.wordCount} 词`,
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitAndAIGrade = async () => {
    if (!activePrompt || !essay.trim()) return;
    const record = createSubmissionRecord(false);
    if (!record) return;
    if (!hasValidAIConfig()) {
      // 未配置 AI Key 时仍记录本次离线交卷，并明确提示未配置 Key
      appendPracticeLog({
        module: 'writing',
        title: activePrompt.title,
        durationSeconds: record.durationSeconds,
        detail: `离线交卷自评（未配置 AI Key）· ${record.wordCount} 词`,
      });
    }
    await runAIGradingForRecord(record, activePrompt);
  };

  const handleRequestAIGradeFromFeedback = async () => {
    if (!activePrompt || !activeSubmission) return;
    await runAIGradingForRecord(activeSubmission, activePrompt);
  };

  const handleToggleSelfCheck = (criterionId: string) => {
    if (!activeSubmissionId) return;
    setSubmissions((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== activeSubmissionId) return item;
        const exists = item.selfChecks.includes(criterionId);
        const nextChecks = exists
          ? item.selfChecks.filter((c) => c !== criterionId)
          : [...item.selfChecks, criterionId];
        return { ...item, selfChecks: nextChecks };
      });
      saveSubmissions(updated);
      return updated;
    });
  };

  const handleSelectHistorySubmission = (sub: WritingSubmission) => {
    const matchedPrompt = prompts.find((p) => p.id === sub.promptId);
    if (matchedPrompt && matchedPrompt.id !== selectedPromptId) {
      setSelectedPromptId(matchedPrompt.id);
    }
    window.setTimeout(() => {
      setActiveSubmissionId(sub.id);
      setAiResult(sub.aiResult ?? null);
      setAiError(null);
      setShowHistory(false);
      feedbackAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleLoadHistoryToEditor = (sub: WritingSubmission) => {
    const matchedPrompt = prompts.find((p) => p.id === sub.promptId);
    if (matchedPrompt && matchedPrompt.id !== selectedPromptId) {
      setSelectedPromptId(matchedPrompt.id);
    }
    window.setTimeout(() => {
      setEssay(sub.essay);
      setShowHistory(false);
      textareaRef.current?.focus();
    }, 50);
  };

  const handleDeleteSubmission = (id: string) => {
    setSubmissions((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveSubmissions(next);
      return next;
    });
    if (activeSubmissionId === id) {
      setActiveSubmissionId(null);
      setAiResult(null);
      setAiError(null);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">正在加载四级写作题库...</div>
    );
  }

  if (prompts.length === 0 || !activePrompt) {
    return (
      <div>
        <SectionHeader
          title="写作训练"
          subtitle="30 分钟模拟考场倒计时、实时字数统计、离线范文自评与可选 AI 批改"
        />
        <EmptyState
          title="暂无写作题目"
          description="请前往设置与导入中心导入自定义写作题库 JSON。"
          action={
            <a
              href="#/settings"
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              前往设置与导入
            </a>
          }
        />
      </div>
    );
  }

  const aiConfigured = hasValidAIConfig();
  const feedbackPrompt =
    (activeSubmission && prompts.find((p) => p.id === activeSubmission.promptId)) || activePrompt;

  return (
    <div className="space-y-5 min-w-0">
      <SectionHeader
        title="写作训练"
        subtitle="模拟四级 30 分钟写作考场，支持草稿自动保存、离线范文自评与可选 AI 批改"
        action={
          <Button
            type="button"
            variant={showHistory ? 'primary' : 'secondary'}
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="h-4 w-4" />
            历史记录 ({submissions.length})
          </Button>
        }
      />

      {/* 历史提交记录面板 */}
      {showHistory && (
        <HistoryDrawer
          submissions={submissions}
          activePromptId={activePrompt.id}
          filterCurrentOnly={historyCurrentOnly}
          onToggleFilter={() => setHistoryCurrentOnly((v) => !v)}
          onSelectSubmission={handleSelectHistorySubmission}
          onLoadToEditor={handleLoadHistoryToEditor}
          onDeleteSubmission={handleDeleteSubmission}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* 顶部紧凑选题栏：默认最新真题 + 右侧下拉键展开全部题库（按时间从新到旧） */}
      <QuestionPickerBar
        label="当前写作真题"
        currentTitle={activePrompt.title}
        currentBadge={activePrompt.category}
        totalCount={prompts.length}
        filterTabs={WRITING_CATEGORIES.map((cat) => ({
          key: cat,
          label: cat,
          count: categoryCounts[cat],
        }))}
        activeFilter={categoryFilter}
        onFilterChange={(key) => setCategoryFilter(key as WritingCategoryFilter)}
        items={filteredPrompts.map((item) => {
          const draftExists = hasSavedDraft(item.id);
          const subCount = submissions.filter((s) => s.promptId === item.id).length;
          return {
            id: item.id,
            title: item.title,
            badge: item.category,
            meta: `${item.minWords}~${item.maxWords} 词 · 建议 ${item.suggestedMinutes} 分钟`,
            extra:
              draftExists || subCount > 0 ? (
                <span className="flex items-center gap-1.5">
                  {draftExists && <Badge tone="amber">有草稿</Badge>}
                  {subCount > 0 && <Badge tone="emerald">已练 {subCount} 次</Badge>}
                </span>
              ) : undefined,
          };
        })}
        activeId={activePrompt.id}
        onSelect={handleSelectPrompt}
        emptyText={`当前「${categoryFilter}」分类下暂无题目，可切换「全部」或在设置页导入自定义写作题。`}
      />

      {/* 1. 当前题目 Directions 与可折叠审题提纲（默认展示最新真题，置顶直接做题） */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="indigo">{activePrompt.category}</Badge>
              <Badge tone="slate">
                字数要求 {activePrompt.minWords}~{activePrompt.maxWords} 词
              </Badge>
              <Badge tone="slate">建议 {activePrompt.suggestedMinutes} 分钟</Badge>
            </div>
            <h2 className="mt-2 text-base sm:text-lg font-bold text-slate-900 break-words">
              {activePrompt.title}
            </h2>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Directions
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-800 break-words">
            {activePrompt.directions}
          </p>
        </div>

        {/* 可折叠：审题提纲 & 高分句型模板 */}
        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/30">
          <button
            type="button"
            onClick={() => setHelperOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-indigo-900 hover:bg-indigo-50/70 rounded-xl transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
              <span>审题提纲 & 高分句型模板（考前辅助）</span>
            </span>
            {helperOpen ? (
              <ChevronUp className="h-4 w-4 text-indigo-600 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-indigo-600 shrink-0" />
            )}
          </button>

          {helperOpen && (
            <div className="border-t border-indigo-100 px-3.5 py-3.5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1.5">审题与段落提纲</p>
                <ol className="space-y-1.5 text-sm text-slate-700">
                  {activePrompt.outlineTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
                        {idx + 1}
                      </span>
                      <span className="break-words">{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">
                    高分句型与表达（点击可插入作文）
                  </p>
                  {insertedNotice && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已插入到正文
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activePrompt.usefulExpressions.map((expr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleInsertExpression(expr)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors cursor-pointer break-words text-left"
                    >
                      <Plus className="h-3 w-3 shrink-0" />
                      <span>{expr}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 3. 模拟考场写作区 */}
      <Card>
        {/* 顶部工具条：倒计时 + 实时词数状态 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <TimerBar
              secondsLeft={secondsLeft}
              running={timerRunning}
              onToggle={() => setTimerRunning((r) => !r)}
              onReset={handleResetTimer}
            />
            {secondsLeft === 0 && (
              <Badge tone="rose">倒计时已结束，可继续完善或交卷</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={wordStatus.tone}>
              <PenLine className="mr-1 h-3 w-3" />
              {wordCount} 词 · {wordStatus.label}
            </Badge>
            <span className="text-xs text-slate-500">{wordStatus.hint}</span>
          </div>
        </div>

        {/* 字数区间可视化进度条 */}
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                wordStatus.tone === 'emerald'
                  ? 'bg-emerald-500'
                  : wordStatus.tone === 'rose'
                    ? 'bg-rose-500'
                    : wordStatus.tone === 'amber'
                      ? 'bg-amber-500'
                      : 'bg-slate-300'
              }`}
              style={{ width: `${wordProgressPercent}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>0 词</span>
            <span>下限 {activePrompt.minWords} 词</span>
            <span>上限 {activePrompt.maxWords} 词</span>
          </div>
        </div>

        {/* 英文作文输入区 */}
        <div className="mt-3">
          <textarea
            ref={textareaRef}
            value={essay}
            onChange={(e) => {
              const next = e.target.value;
              setEssay(next);
              if (
                !timerRunning &&
                activePrompt &&
                secondsLeft === activePrompt.suggestedMinutes * 60 &&
                next.trim().length > 0
              ) {
                setTimerRunning(true);
              }
            }}
            placeholder="请在此用英文撰写你的四级作文（开始输入自动启动倒计时，自动保存草稿）..."
            spellCheck={false}
            className="w-full min-h-[260px] sm:min-h-[320px] rounded-xl border border-slate-300 bg-white p-3.5 sm:p-4 text-sm sm:text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
          />
        </div>

        {/* 底部状态与交卷按钮 */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              {draftSavedAt
                ? `草稿已自动保存（${formatClockTime(draftSavedAt)}）`
                : '输入内容后自动本地保存草稿'}
            </span>
            {essay.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClearDraft}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                  confirmClear
                    ? 'bg-rose-100 text-rose-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <RotateCcw className="h-3 w-3" />
                {confirmClear ? '再次点击确认清空' : '清空草稿'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSubmitOffline}
              disabled={!essay.trim() || aiLoading}
              className="flex-1 sm:flex-none"
            >
              <FileCheck2 className="h-4 w-4" />
              交卷看范文与自评
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmitAndAIGrade}
              disabled={!essay.trim() || aiLoading}
              className="flex-1 sm:flex-none"
            >
              <Sparkles className="h-4 w-4" />
              {aiLoading ? 'AI 批改中...' : '交卷并 AI 批改'}
            </Button>
          </div>
        </div>

        {/* 未配置 AI Key 的温和提示 */}
        {!aiConfigured && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              未检测到 AI API Key：点击「交卷看范文与自评」可完整离线使用参考范文与四级自评；如需
              AI 自动打分与润色，请先前往{' '}
              <a href="#/settings" className="font-medium text-indigo-600 underline underline-offset-2">
                设置中心
              </a>{' '}
              配置。
            </span>
          </div>
        )}
      </Card>

      {/* 4. 交卷反馈区域（AI 批改 + 离线高分范文 + 四级维度自评） */}
      <div ref={feedbackAnchorRef}>
        {activeSubmission && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">
                  本次交卷反馈 · {activeSubmission.promptTitle}
                </span>
              </div>
              <Badge tone="slate">{activeSubmission.wordCount} 词</Badge>
            </div>

            <FeedbackPanel
              prompt={feedbackPrompt}
              essay={activeSubmission.essay}
              wordCount={activeSubmission.wordCount}
              selfChecks={activeSubmission.selfChecks}
              onToggleSelfCheck={handleToggleSelfCheck}
              hasAIKey={aiConfigured}
              aiLoading={aiLoading}
              aiResult={aiResult}
              aiError={aiError}
              onRequestAIGrade={handleRequestAIGradeFromFeedback}
            />
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Headphones,
  Languages,
  Loader2,
  PenLine,
  RotateCcw,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, SectionHeader, TimerBar } from '../../components/ui';
import { gradeTranslation, gradeWriting } from '../../services/aiGrader';
import {
  appendPracticeLog,
  getActiveAccountId,
  getScopedStorageKey,
  hasValidAIConfig,
} from '../../services/storage';
import type { AIGradeResult, ReadingPassage } from '../../types/cet4';
import {
  computeMockScores,
  countEnglishWords,
  getMockHistory,
  loadMockExamPapers,
  upsertMockHistoryRecord,
  type MockExamPaper,
  type MockHistoryRecord,
} from './assemblePapers';
import { MockAudioPlayer } from './MockAudioPlayer';

type ExamPart = 'writing' | 'listening' | 'reading' | 'translation' | 'report';

const EXAM_DURATION_SECONDS = 125 * 60; // 四级全真考试 125 分钟
const MOCK_DRAFTS_KEY = 'cet4_mock_drafts_v1';

interface MockExamDraft {
  paperId: string;
  activePart: ExamPart;
  activeReadingIdx: number;
  writingEssay: string;
  listeningAnswers: Record<string, string>;
  readingAnswers: Record<string, string>;
  translationAnswer: string;
  secondsLeft: number;
  savedAt: string;
}

function readMockDrafts(): Record<string, MockExamDraft> {
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(MOCK_DRAFTS_KEY));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, MockExamDraft>;
  } catch {
    return {};
  }
}

function saveMockDraft(draft: MockExamDraft): Record<string, MockExamDraft> {
  const all = readMockDrafts();
  all[draft.paperId] = draft;
  try {
    window.localStorage.setItem(getScopedStorageKey(MOCK_DRAFTS_KEY), JSON.stringify(all));
  } catch {
    // ignore quota errors
  }
  return all;
}

function clearMockDraft(paperId: string): Record<string, MockExamDraft> {
  const all = readMockDrafts();
  delete all[paperId];
  try {
    window.localStorage.setItem(getScopedStorageKey(MOCK_DRAFTS_KEY), JSON.stringify(all));
  } catch {
    // ignore
  }
  return all;
}

function formatRemainMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const READING_TYPE_LABEL: Record<ReadingPassage['type'], string> = {
  banked_cloze: '选词填空',
  matching: '长篇匹配',
  careful: '仔细阅读',
};

export default function MockExamPage() {
  const [papers, setPapers] = useState<MockExamPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('全部');
  const [history, setHistory] = useState<MockHistoryRecord[]>(() => getMockHistory());
  const [drafts, setDrafts] = useState<Record<string, MockExamDraft>>(() => readMockDrafts());
  const [dismissedTimeout, setDismissedTimeout] = useState(false);

  // 当前正在进行的套卷状态
  const [activePaper, setActivePaper] = useState<MockExamPaper | null>(null);
  const [activePart, setActivePart] = useState<ExamPart>('writing');
  const [activeReadingIdx, setActiveReadingIdx] = useState(0);
  const [mobileReadingTab, setMobileReadingTab] = useState<'passage' | 'questions'>('passage');

  const [writingEssay, setWritingEssay] = useState('');
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({});
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [translationAnswer, setTranslationAnswer] = useState('');

  const [secondsLeft, setSecondsLeft] = useState(EXAM_DURATION_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const deadlineMsRef = useRef<number | null>(null);

  // 交卷与 AI 打分状态（含请求版本与账号锁，防切号/重考串写）
  const [submitted, setSubmitted] = useState(false);
  const [gradingWriting, setGradingWriting] = useState(false);
  const [gradingTranslation, setGradingTranslation] = useState(false);
  const [writingAI, setWritingAI] = useState<AIGradeResult | null>(null);
  const [writingAIError, setWritingAIError] = useState<string | null>(null);
  const [translationAI, setTranslationAI] = useState<AIGradeResult | null>(null);
  const [translationAIError, setTranslationAIError] = useState<string | null>(null);
  const examVersionRef = useRef(0);
  const currentAttemptRef = useRef<{
    id: string;
    accountId: string;
    durationSeconds: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    loadMockExamPapers()
      .then((list) => {
        if (mounted) setPapers(list);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!timerRunning || !activePaper || submitted) {
      deadlineMsRef.current = null;
      return;
    }
    deadlineMsRef.current = Date.now() + secondsLeft * 1000;
    const syncRemaining = () => {
      if (deadlineMsRef.current === null) return;
      const remain = Math.max(0, Math.ceil((deadlineMsRef.current - Date.now()) / 1000));
      setSecondsLeft(remain);
      if (remain <= 0) {
        setTimerRunning(false);
        deadlineMsRef.current = null;
      }
    };
    const timer = window.setInterval(syncRemaining, 1000);
    window.addEventListener('visibilitychange', syncRemaining);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('visibilitychange', syncRemaining);
    };
  }, [timerRunning, activePaper, submitted]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const p of papers) set.add(p.year);
    return ['全部', ...Array.from(set).sort().reverse()];
  }, [papers]);

  const filteredPapers = useMemo(() => {
    if (selectedYear === '全部') return papers;
    return papers.filter((p) => p.year === selectedYear);
  }, [papers, selectedYear]);

  const bestScoreByPaper = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of history) {
      if (map[h.paperId] === undefined || h.totalScore > map[h.paperId]) {
        map[h.paperId] = h.totalScore;
      }
    }
    return map;
  }, [history]);

  const startExam = (paper: MockExamPaper, resumeDraft?: MockExamDraft) => {
    examVersionRef.current += 1;
    currentAttemptRef.current = null;
    setDismissedTimeout(false);
    setActivePaper(paper);
    if (resumeDraft) {
      setActivePart(resumeDraft.activePart === 'report' ? 'writing' : resumeDraft.activePart);
      setActiveReadingIdx(resumeDraft.activeReadingIdx ?? 0);
      setWritingEssay(resumeDraft.writingEssay ?? '');
      setListeningAnswers(resumeDraft.listeningAnswers ?? {});
      setReadingAnswers(resumeDraft.readingAnswers ?? {});
      setTranslationAnswer(resumeDraft.translationAnswer ?? '');
      setSecondsLeft(
        typeof resumeDraft.secondsLeft === 'number' && resumeDraft.secondsLeft > 0
          ? resumeDraft.secondsLeft
          : EXAM_DURATION_SECONDS,
      );
      setTimerRunning(true);
    } else {
      setDrafts(clearMockDraft(paper.paperId));
      setActivePart('writing');
      setActiveReadingIdx(0);
      setWritingEssay('');
      setListeningAnswers({});
      setReadingAnswers({});
      setTranslationAnswer('');
      setSecondsLeft(EXAM_DURATION_SECONDS);
      setTimerRunning(true);
    }
    setSubmitted(false);
    setGradingWriting(false);
    setGradingTranslation(false);
    setWritingAI(null);
    setWritingAIError(null);
    setTranslationAI(null);
    setTranslationAIError(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  // 自动暂存进行中的模考进度（切走底部 Tab 或退出页面也不会丢进度）
  useEffect(() => {
    if (!activePaper || submitted) return;
    const hasProgress =
      writingEssay.trim().length > 0 ||
      translationAnswer.trim().length > 0 ||
      Object.keys(listeningAnswers).length > 0 ||
      Object.keys(readingAnswers).length > 0 ||
      secondsLeft < EXAM_DURATION_SECONDS;
    if (!hasProgress) return;
    const t = window.setTimeout(() => {
      const next = saveMockDraft({
        paperId: activePaper.paperId,
        activePart,
        activeReadingIdx,
        writingEssay,
        listeningAnswers,
        readingAnswers,
        translationAnswer,
        secondsLeft,
        savedAt: new Date().toISOString(),
      });
      setDrafts(next);
    }, 600);
    return () => window.clearTimeout(t);
  }, [
    activePaper,
    submitted,
    activePart,
    activeReadingIdx,
    writingEssay,
    listeningAnswers,
    readingAnswers,
    translationAnswer,
    secondsLeft,
  ]);

  const handleExitToPaperList = () => {
    if (activePaper && !submitted) {
      const next = saveMockDraft({
        paperId: activePaper.paperId,
        activePart,
        activeReadingIdx,
        writingEssay,
        listeningAnswers,
        readingAnswers,
        translationAnswer,
        secondsLeft,
        savedAt: new Date().toISOString(),
      });
      setDrafts(next);
    }
    setActivePaper(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  const syncAttemptHistory = useCallback(
    (paper: MockExamPaper, nextWritingAI: AIGradeResult | null, nextTranslationAI: AIGradeResult | null) => {
      const attempt = currentAttemptRef.current;
      if (!attempt) return null;
      const finalScores = computeMockScores({
        paper,
        listeningAnswers,
        readingAnswers,
        writingAI: nextWritingAI,
        translationAI: nextTranslationAI,
      });
      const nextHistory = upsertMockHistoryRecord(
        attempt.id,
        {
          paperId: paper.paperId,
          paperTitle: paper.title,
          totalScore: finalScores.totalScore,
          listeningScore: finalScores.listeningScore,
          readingScore: finalScores.readingScore,
          writingScore: finalScores.writingScore,
          translationScore: finalScores.translationScore,
          durationSeconds: attempt.durationSeconds,
        },
        attempt.accountId,
      );
      if (getActiveAccountId() === attempt.accountId) {
        setHistory(nextHistory);
      }
      return finalScores;
    },
    [listeningAnswers, readingAnswers],
  );

  const runWritingAI = useCallback(
    async (paper: MockExamPaper, essay: string, version: number, isRegrade = false) => {
      if (!essay.trim()) {
        setWritingAIError('写作部分未作答（0 分）。');
        return null;
      }
      if (!hasValidAIConfig()) {
        setWritingAIError('未配置 AI Key，请前往「设置与导入」配置后点击下方「AI 打分」。');
        return null;
      }
      setGradingWriting(true);
      setWritingAIError(null);
      try {
        const res = await gradeWriting({ prompt: paper.writing, essay });
        if (examVersionRef.current !== version) return null;
        if (res.ok) {
          setWritingAI(res.result);
          if (isRegrade) syncAttemptHistory(paper, res.result, translationAI);
          return res.result;
        }
        setWritingAIError(res.message);
        return null;
      } finally {
        if (examVersionRef.current === version) setGradingWriting(false);
      }
    },
    [syncAttemptHistory, translationAI],
  );

  const runTranslationAI = useCallback(
    async (paper: MockExamPaper, answer: string, version: number, isRegrade = false) => {
      if (!answer.trim()) {
        setTranslationAIError('翻译部分未作答（0 分）。');
        return null;
      }
      if (!hasValidAIConfig()) {
        setTranslationAIError('未配置 AI Key，请前往「设置与导入」配置后点击下方「AI 打分」。');
        return null;
      }
      setGradingTranslation(true);
      setTranslationAIError(null);
      try {
        const res = await gradeTranslation({ item: paper.translation, answer });
        if (examVersionRef.current !== version) return null;
        if (res.ok) {
          setTranslationAI(res.result);
          if (isRegrade) syncAttemptHistory(paper, writingAI, res.result);
          return res.result;
        }
        setTranslationAIError(res.message);
        return null;
      } finally {
        if (examVersionRef.current === version) setGradingTranslation(false);
      }
    },
    [syncAttemptHistory, writingAI],
  );

  const handleSubmitExam = async () => {
    if (!activePaper) return;
    const version = examVersionRef.current;
    const accountId = getActiveAccountId();
    const spentSeconds = Math.max(1, EXAM_DURATION_SECONDS - secondsLeft);
    const attemptId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    currentAttemptRef.current = { id: attemptId, accountId, durationSeconds: spentSeconds };

    setTimerRunning(false);
    setSubmitted(true);
    setActivePart('report');
    setDrafts(clearMockDraft(activePaper.paperId));
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    // 先立即落盘客观分（听力+阅读），让成绩单秒出客观题分数，随后并发 AI 批改并补齐主观题分数
    syncAttemptHistory(activePaper, null, null);
    const [wRes, tRes] = await Promise.all([
      runWritingAI(activePaper, writingEssay, version, false),
      runTranslationAI(activePaper, translationAnswer, version, false),
    ]);

    if (examVersionRef.current !== version) return;

    const finalScores =
      syncAttemptHistory(activePaper, wRes, tRes) ??
      computeMockScores({
        paper: activePaper,
        listeningAnswers,
        readingAnswers,
        writingAI: wRes,
        translationAI: tRes,
      });

    appendPracticeLog(
      {
        module: 'mock',
        title: `全真模考 · ${activePaper.title}`,
        score: Math.round(finalScores.totalScore),
        maxScore: 710,
        accuracy: Math.round((finalScores.totalScore / 710) * 100),
        durationSeconds: spentSeconds,
        detail: `估分 ${finalScores.totalScore}/710（听 ${finalScores.listeningScore} · 读 ${finalScores.readingScore} · 写 ${finalScores.writingScore} · 译 ${finalScores.translationScore}）`,
      },
      accountId,
    );
  };

  const scores = useMemo(() => {
    if (!activePaper) return null;
    return computeMockScores({
      paper: activePaper,
      listeningAnswers,
      readingAnswers,
      writingAI,
      translationAI,
    });
  }, [activePaper, listeningAnswers, readingAnswers, writingAI, translationAI]);

  const listeningAnswered = Object.keys(listeningAnswers).length;
  const listeningTotal = activePaper?.listening?.questions.length ?? 0;
  const readingAnswered = Object.keys(readingAnswers).length;
  const readingTotal = useMemo(
    () => (activePaper ? activePaper.readings.reduce((s, p) => s + p.questions.length, 0) : 0),
    [activePaper],
  );
  const writingWordCount = useMemo(() => countEnglishWords(writingEssay), [writingEssay]);
  const translationWordCount = useMemo(
    () => countEnglishWords(translationAnswer),
    [translationAnswer],
  );

  if (loading) {
    return (
      <div>
        <SectionHeader
          title="综合测试（全真套卷模考）"
          subtitle="近五年四级真题完整套卷 · 710 分制 + AI 自动批改写作与翻译"
        />
        <Card className="py-12 text-center text-sm text-slate-500">正在组装历年真题套卷...</Card>
      </div>
    );
  }

  /* ==================== 视图 A：套卷选择大厅 ==================== */
  if (!activePaper) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="综合测试（全真套卷模考）"
          subtitle={`已整合 ${papers.length} 套 2021–2026 四级官方完整真题套卷 · 125 分钟考场计时 · 710 分制自动判分 + AI 批改`}
          action={
            <Badge tone={hasValidAIConfig() ? 'emerald' : 'amber'}>
              {hasValidAIConfig() ? 'AI 写作/翻译自动打分已就绪' : '未配置 AI（可客观判分+范文对照）'}
            </Badge>
          }
        />

        {/* 年份筛选 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                selectedYear === y
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {y === '全部' ? `全部套卷 (${papers.length})` : `${y} 年真题`}
            </button>
          ))}
        </div>

        {filteredPapers.length === 0 ? (
          <EmptyState title="暂无可组装的完整套卷" description="请检查真题数据文件是否完整。" />
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            {filteredPapers.map((paper) => {
              const best = bestScoreByPaper[paper.paperId];
              const qReadingCount = paper.readings.reduce((s, r) => s + r.questions.length, 0);
              const qListeningCount = paper.listening?.questions.length ?? 0;

              return (
                <Card
                  key={paper.paperId}
                  className="flex flex-col justify-between gap-4 hover:border-indigo-300 transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{paper.title}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          四级全真 710 分制 · 建议用时 125 分钟
                        </p>
                      </div>
                      {best !== undefined && (
                        <Badge tone={best >= 425 ? 'emerald' : 'amber'}>
                          最高 {best} 分
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <Badge tone="indigo">Part I 写作</Badge>
                      <Badge tone="emerald">
                        Part II 听力 {qListeningCount} 题{paper.listening?.audioUrl ? '（原声）' : ''}
                      </Badge>
                      <Badge tone="slate">Part III 阅读 {qReadingCount} 题</Badge>
                      <Badge tone="amber">Part IV 翻译</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    {drafts[paper.paperId] ? (
                      <>
                        <span className="text-xs font-medium text-indigo-700">
                          已暂存进度 · 剩余 {formatRemainMMSS(drafts[paper.paperId].secondsLeft)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2.5 py-1.5 text-xs"
                            onClick={() => {
                              if (window.confirm('确认放弃上次暂存进度并重新开始本套卷吗？')) {
                                startExam(paper);
                              }
                            }}
                          >
                            重新开始
                          </Button>
                          <Button
                            type="button"
                            onClick={() => startExam(paper, drafts[paper.paperId])}
                          >
                            <Award className="h-4 w-4" />
                            继续上次进度
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500">
                          写作 + 翻译支持 AI 自动打分
                        </span>
                        <Button type="button" onClick={() => startExam(paper)}>
                          <Award className="h-4 w-4" />
                          开始全真模考
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ==================== 视图 B：全真模考考场 & 成绩单 ==================== */
  const currentReading = activePaper.readings[activeReadingIdx] ?? activePaper.readings[0];

  return (
    <div className="space-y-4">
      {/* 顶部考场导航栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            type="button"
            variant="secondary"
            className="px-2.5 py-1.5 text-xs shrink-0"
            onClick={handleExitToPaperList}
          >
            <ArrowLeft className="h-4 w-4" />
            {submitted ? '返回套卷列表' : '暂存并返回'}
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {activePaper.title}
            </h1>
            <p className="text-xs text-slate-500">四级全真模考 · 满分 710 分（425 分及格）</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TimerBar
            secondsLeft={secondsLeft}
            running={timerRunning && !submitted}
            onToggle={() => {
              if (!submitted) setTimerRunning((r) => !r);
            }}
            onReset={() => {
              if (!submitted && window.confirm('确认将模考剩余时间重置为 125 分钟吗？')) {
                setSecondsLeft(EXAM_DURATION_SECONDS);
                setTimerRunning(false);
                setDismissedTimeout(false);
              }
            }}
          />
          {!submitted ? (
            <Button type="button" onClick={() => void handleSubmitExam()}>
              <Send className="h-4 w-4" />
              交卷并 AI 打分
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => startExam(activePaper)}>
              <RotateCcw className="h-4 w-4" />
              重做本套卷
            </Button>
          )}
        </div>
      </div>

      {/* 125 分钟时间归零提醒横幅 */}
      {!submitted && secondsLeft === 0 && !dismissedTimeout && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>125 分钟模考时间已到，建议立即交卷评分，也可以选择延时继续练习。</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-2.5 py-1 text-xs"
              onClick={() => setDismissedTimeout(true)}
            >
              延时继续练习
            </Button>
            <Button
              type="button"
              className="px-2.5 py-1 text-xs"
              onClick={() => void handleSubmitExam()}
            >
              立即交卷评分
            </Button>
          </div>
        </div>
      )}

      {/* 四大板块切换 Tab */}
      <Card className="p-2">
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          {(
            [
              {
                key: 'writing',
                label: 'Part I 写作',
                badge: `${writingWordCount}词`,
                icon: PenLine,
              },
              {
                key: 'listening',
                label: 'Part II 听力',
                badge: `${listeningAnswered}/${listeningTotal}`,
                icon: Headphones,
              },
              {
                key: 'reading',
                label: 'Part III 阅读',
                badge: `${readingAnswered}/${readingTotal}`,
                icon: BookOpen,
              },
              {
                key: 'translation',
                label: 'Part IV 翻译',
                badge: `${translationWordCount}词`,
                icon: Languages,
              },
              ...(submitted
                ? [
                    {
                      key: 'report' as const,
                      label: '710 分成绩单',
                      badge: `${scores?.totalScore ?? 0}分`,
                      icon: Award,
                    },
                  ]
                : []),
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activePart === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivePart(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ==================== Part I：写作 ==================== */}
      {activePart === 'writing' && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="indigo">Part I Writing（15% · 满分 106.5 分）</Badge>
              <Badge tone="slate">{activePaper.writing.category}</Badge>
            </div>
            <Badge
              tone={
                writingWordCount >= 120 && writingWordCount <= 180
                  ? 'emerald'
                  : writingWordCount > 0
                    ? 'amber'
                    : 'slate'
              }
            >
              当前 {writingWordCount} 词（要求 120–180 词）
            </Badge>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
            {activePaper.writing.directions}
          </div>

          <textarea
            value={writingEssay}
            onChange={(e) => setWritingEssay(e.target.value)}
            readOnly={submitted}
            rows={12}
            placeholder="请在此撰写你的英语四级作文（120–180 词）..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
          />

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setActivePart('listening')}>
              下一部分：Part II 听力 →
            </Button>
          </div>
        </Card>
      )}

      {/* ==================== Part II：听力 ==================== */}
      {activePart === 'listening' && (
        <div className="space-y-4">
          {activePaper.listening ? (
            <>
              <MockAudioPlayer listening={activePaper.listening} />

              <div className="space-y-3">
                {activePaper.listening.questions.map((q) => {
                  const picked = listeningAnswers[q.id] ?? '';
                  const isCorrect = submitted && picked === q.answer;
                  return (
                    <Card key={q.id} className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {q.number}. {q.stem || `第 ${q.number} 题`}
                        </p>
                        {submitted && (
                          <Badge tone={isCorrect ? 'emerald' : 'rose'}>
                            {isCorrect ? '正确' : `正解 ${q.answer}`}
                          </Badge>
                        )}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.options.map((opt) => {
                          const selected = picked === opt.label;
                          let cls =
                            'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40';
                          if (submitted) {
                            if (opt.label === q.answer) {
                              cls = 'border-emerald-400 bg-emerald-50 text-emerald-900 font-medium';
                            } else if (selected) {
                              cls = 'border-rose-400 bg-rose-50 text-rose-900';
                            }
                          } else if (selected) {
                            cls = 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium';
                          }

                          return (
                            <button
                              key={opt.label}
                              type="button"
                              disabled={submitted}
                              onClick={() =>
                                setListeningAnswers((prev) => ({ ...prev, [q.id]: opt.label }))
                              }
                              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs sm:text-sm transition-colors cursor-pointer disabled:cursor-default ${cls}`}
                            >
                              <span className="font-bold shrink-0">{opt.label}.</span>
                              <span>{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>

                      {submitted && q.explanation && (
                        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap">
                          {q.explanation}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState title="本套卷暂无听力数据" description="请继续完成阅读、写作与翻译部分。" />
          )}

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setActivePart('reading')}>
              下一部分：Part III 阅读 →
            </Button>
          </div>
        </div>
      )}

      {/* ==================== Part III：阅读 ==================== */}
      {activePart === 'reading' && currentReading && (
        <div className="space-y-4">
          {/* 阅读子篇切换 */}
          <div className="flex flex-wrap gap-1.5">
            {activePaper.readings.map((r, idx) => {
              const done = r.questions.filter((q) => Boolean(readingAnswers[q.id])).length;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveReadingIdx(idx)}
                  className={`rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    idx === activeReadingIdx
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {READING_TYPE_LABEL[r.type]} {idx >= 2 ? idx - 1 : ''} ({done}/{r.questions.length})
                </button>
              );
            })}
          </div>

          {/* 移动端阅读「看原文 / 做题」快捷切换 */}
          <div className="lg:hidden sticky top-[calc(3.25rem+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-1 px-1 py-1 bg-slate-50/95 backdrop-blur">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setMobileReadingTab('passage')}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  mobileReadingTab === 'passage'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                看原文
              </button>
              <button
                type="button"
                onClick={() => setMobileReadingTab('questions')}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  mobileReadingTab === 'questions'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                做题（{currentReading.questions.filter((q) => Boolean(readingAnswers[q.id])).length}/
                {currentReading.questions.length}）
              </button>
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
            {/* 左：原文 + 词库 */}
            <Card
              className={`${
                mobileReadingTab === 'passage' ? 'block' : 'hidden'
              } lg:block lg:col-span-7 lg:max-h-[70vh] lg:overflow-y-auto space-y-3`}
            >
              <div className="flex items-center gap-2">
                <Badge tone="indigo">{READING_TYPE_LABEL[currentReading.type]}</Badge>
                <h3 className="text-sm font-bold text-slate-900">{currentReading.title}</h3>
              </div>

              {currentReading.wordBank && currentReading.wordBank.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                  <p className="mb-2 text-xs font-semibold text-indigo-800">选词填空词库（A–O）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentReading.wordBank.map((wb) => (
                      <span
                        key={wb.label}
                        className="rounded-lg border border-indigo-200 bg-white px-2 py-0.5 font-mono text-xs text-slate-800"
                      >
                        <strong>{wb.label})</strong> {wb.word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 text-sm leading-7 text-slate-800">
                {currentReading.paragraphs.map((para, pIdx) => (
                  <p key={pIdx} className="break-words">
                    {para.label && (
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-100 font-mono text-xs font-bold text-indigo-700">
                        {para.label}
                      </span>
                    )}
                    {para.text}
                  </p>
                ))}
              </div>
            </Card>

            {/* 右：题目 */}
            <div
              className={`${
                mobileReadingTab === 'questions' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 lg:max-h-[70vh] lg:overflow-y-auto space-y-3`}
            >
              {currentReading.questions.map((q) => {
                const picked = readingAnswers[q.id] ?? '';
                const isCorrect = submitted && picked === q.answer;
                const isDropdown =
                  currentReading.type === 'banked_cloze' || currentReading.type === 'matching';

                return (
                  <Card key={q.id} className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {q.number}. {q.stem}
                      </p>
                      {submitted && (
                        <Badge tone={isCorrect ? 'emerald' : 'rose'}>
                          {isCorrect ? '正确' : `正解 ${q.answer}`}
                        </Badge>
                      )}
                    </div>

                    {isDropdown ? (
                      <select
                        value={picked}
                        disabled={submitted}
                        onChange={(e) =>
                          setReadingAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">请选择答案...</option>
                        {q.options.map((opt) => (
                          <option key={opt.label} value={opt.label}>
                            {opt.label}) {opt.text}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1.5">
                        {q.options.map((opt) => {
                          const selected = picked === opt.label;
                          let cls =
                            'border-slate-200 bg-white text-slate-700 hover:border-indigo-300';
                          if (submitted) {
                            if (opt.label === q.answer) {
                              cls = 'border-emerald-400 bg-emerald-50 text-emerald-900 font-medium';
                            } else if (selected) {
                              cls = 'border-rose-400 bg-rose-50 text-rose-900';
                            }
                          } else if (selected) {
                            cls = 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium';
                          }
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              disabled={submitted}
                              onClick={() =>
                                setReadingAnswers((prev) => ({ ...prev, [q.id]: opt.label }))
                              }
                              className={`w-full flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs sm:text-sm cursor-pointer disabled:cursor-default ${cls}`}
                            >
                              <span className="font-bold shrink-0">{opt.label}.</span>
                              <span>{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {submitted && q.explanation && (
                      <div className="rounded-xl bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap">
                        {q.explanation}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setActivePart('translation')}>
              下一部分：Part IV 翻译 →
            </Button>
          </div>
        </div>
      )}

      {/* ==================== Part IV：翻译 ==================== */}
      {activePart === 'translation' && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="amber">Part IV Translation（15% · 满分 106.5 分）</Badge>
            <Badge tone="slate">当前 {translationWordCount} 词</Badge>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:text-base leading-8 text-slate-800">
            {activePaper.translation.sourceText}
          </div>

          <textarea
            value={translationAnswer}
            onChange={(e) => setTranslationAnswer(e.target.value)}
            readOnly={submitted}
            rows={8}
            placeholder="请将上方中文段落翻译为英文..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />

          {!submitted && (
            <div className="flex justify-end">
              <Button type="button" onClick={() => void handleSubmitExam()}>
                <Sparkles className="h-4 w-4" />
                完成全部作答 · 交卷并 AI 打分
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ==================== 710 分综合成绩单 ==================== */}
      {activePart === 'report' && submitted && scores && (
        <div className="space-y-5">
          {/* 总分横幅 */}
          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Award className="h-6 w-6 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    {activePaper.title} · 710 分制练习估分报告
                  </h2>
                </div>
                <p className="text-xs text-slate-600">
                  客观题（听力+阅读）按四级题型权重即时判分；主观题（写作+翻译）由 AI 按 106.5 分制估分（参考 425 分线）。
                </p>
              </div>

              <div className="flex items-baseline gap-2">
                <span
                  className={`font-mono text-4xl font-extrabold ${
                    scores.totalScore >= 425 ? 'text-emerald-600' : 'text-indigo-600'
                  }`}
                >
                  {scores.totalScore}
                </span>
                <span className="text-sm font-medium text-slate-500">/ 710</span>
                <Badge tone={scores.totalScore >= 425 ? 'emerald' : 'amber'}>
                  {scores.totalScore >= 425 ? '已过 425 及格线' : `距 425 差 ${(425 - scores.totalScore).toFixed(1)} 分`}
                </Badge>
              </div>
            </div>

            {/* 四板块分项条 */}
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {[
                {
                  name: 'Part I 写作',
                  score: scores.writingScore,
                  max: 106.5,
                  sub: gradingWriting ? 'AI 批改中...' : writingAI ? `${writingAI.score15}/15 分` : '未 AI 打分',
                },
                {
                  name: 'Part II 听力',
                  score: scores.listeningScore,
                  max: 248.5,
                  sub: `答对 ${scores.listeningCorrect}/${scores.listeningTotal} 题`,
                },
                {
                  name: 'Part III 阅读',
                  score: scores.readingScore,
                  max: 248.5,
                  sub: `答对 ${scores.readingCorrect}/${scores.readingTotal} 题`,
                },
                {
                  name: 'Part IV 翻译',
                  score: scores.translationScore,
                  max: 106.5,
                  sub: gradingTranslation
                    ? 'AI 批改中...'
                    : translationAI
                      ? `${translationAI.score15}/15 分`
                      : '未 AI 打分',
                },
              ].map((sec) => (
                <div key={sec.name} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium text-slate-500">{sec.name}</p>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                    {sec.score} <span className="text-xs font-normal text-slate-400">/ {sec.max}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{sec.sub}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* 写作 AI 打分详情 */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Part I 写作 · AI 批改与参考范文</h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="text-xs px-3 py-1.5"
                disabled={gradingWriting}
                onClick={() =>
                  void runWritingAI(activePaper, writingEssay, examVersionRef.current, true)
                }
              >
                {gradingWriting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {gradingWriting ? 'AI 批改中...' : writingAI ? '重新 AI 打分' : '发起 AI 打分'}
              </Button>
            </div>

            {writingAIError && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{writingAIError}</span>
              </div>
            )}

            {writingAI && (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="emerald">原始分 {writingAI.score15} / 15</Badge>
                  <Badge tone="indigo">换算分 {writingAI.score106} / 106.5</Badge>
                </div>
                <p className="text-slate-800 leading-relaxed">{writingAI.overallComment}</p>
                {writingAI.issues.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-700">修改建议：</p>
                    {writingAI.issues.map((iss, idx) => (
                      <div key={idx} className="rounded-lg bg-white p-2.5 text-xs space-y-1">
                        <p className="text-rose-700 line-through">{iss.original}</p>
                        <p className="text-emerald-700 font-medium">→ {iss.suggestion}</p>
                        <p className="text-slate-500">{iss.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
                {writingAI.polishedVersion && (
                  <div className="rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                    <p className="mb-1 font-bold text-indigo-700">AI 润色高分版：</p>
                    {writingAI.polishedVersion}
                  </div>
                )}
              </div>
            )}

            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700">
                展开真题参考范文
              </summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700">
                {activePaper.writing.sampleEssay}
              </p>
            </details>
          </Card>

          {/* 翻译 AI 打分详情 */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Part IV 翻译 · AI 批改与参考译文</h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="text-xs px-3 py-1.5"
                disabled={gradingTranslation}
                onClick={() =>
                  void runTranslationAI(activePaper, translationAnswer, examVersionRef.current, true)
                }
              >
                {gradingTranslation ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {gradingTranslation ? 'AI 批改中...' : translationAI ? '重新 AI 打分' : '发起 AI 打分'}
              </Button>
            </div>

            {translationAIError && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{translationAIError}</span>
              </div>
            )}

            {translationAI && (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="emerald">原始分 {translationAI.score15} / 15</Badge>
                  <Badge tone="indigo">换算分 {translationAI.score106} / 106.5</Badge>
                </div>
                <p className="text-slate-800 leading-relaxed">{translationAI.overallComment}</p>
                {translationAI.issues.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-700">逐句问题诊断：</p>
                    {translationAI.issues.map((iss, idx) => (
                      <div key={idx} className="rounded-lg bg-white p-2.5 text-xs space-y-1">
                        <p className="text-rose-700 line-through">{iss.original}</p>
                        <p className="text-emerald-700 font-medium">→ {iss.suggestion}</p>
                        <p className="text-slate-500">{iss.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
                {translationAI.polishedVersion && (
                  <div className="rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                    <p className="mb-1 font-bold text-indigo-700">AI 优化译文：</p>
                    {translationAI.polishedVersion}
                  </div>
                )}
              </div>
            )}

            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700">
                展开真题参考译文
              </summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700">
                {activePaper.translation.referenceTranslation}
              </p>
            </details>
          </Card>

          {/* 快捷跳转查看客观题逐题解析 */}
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              {scores.listeningCorrect + scores.readingCorrect > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-slate-400" />
              )}
              <span>点击上方「Part II 听力」或「Part III 阅读」标签即可查看每道客观题的详细解析与定位句。</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setActivePart('listening')}>
                复盘听力解析
              </Button>
              <Button type="button" variant="secondary" onClick={() => setActivePart('reading')}>
                复盘阅读解析
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

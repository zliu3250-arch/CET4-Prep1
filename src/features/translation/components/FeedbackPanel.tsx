import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RotateCcw,
  Settings,
  Sparkles,
  Square,
  CheckSquare,
} from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ui';
import { gradeTranslation } from '../../../services/aiGrader';
import { hasValidAIConfig } from '../../../services/storage';
import type { AIGradeResult, TranslationItem } from '../../../types/cet4';
import { formatDateTime, formatDuration, type TranslationSubmission } from '../storage';

interface FeedbackPanelProps {
  item: TranslationItem;
  submission: TranslationSubmission;
  autoGradeNonce?: number;
  onTogglePhrase: (phrase: string) => void;
  onSaveAIResult: (result: AIGradeResult) => void;
  onBackToPractice: () => void;
}

function isPhraseMatched(answer: string, phrase: string): boolean {
  const normalizedAnswer = answer.toLowerCase();
  const cleanPhrase = phrase
    .toLowerCase()
    .replace(/\.\.\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanPhrase) return false;
  if (normalizedAnswer.includes(cleanPhrase)) return true;
  const segments = cleanPhrase
    .split(' ')
    .filter((token) => token.length >= 3);
  if (segments.length >= 2) {
    const matchedCount = segments.filter((seg) => normalizedAnswer.includes(seg)).length;
    return matchedCount === segments.length;
  }
  return false;
}

export function FeedbackPanel({
  item,
  submission,
  autoGradeNonce = 0,
  onTogglePhrase,
  onSaveAIResult,
  onBackToPractice,
}: FeedbackPanelProps) {
  const [grading, setGrading] = useState(false);
  const [aiError, setAiError] = useState<{ code: string; message: string } | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<'reference' | 'polished' | null>(null);
  const lastAutoNonceRef = useRef(0);

  const aiConfigured = hasValidAIConfig();
  const aiResult = submission.aiResult;
  const totalPhrases = item.keyPhrases.length;
  const checkedCount = submission.checkedPhrases.filter((p) =>
    item.keyPhrases.includes(p),
  ).length;
  const checkPercent =
    totalPhrases > 0 ? Math.round((checkedCount / totalPhrases) * 100) : 0;

  const handleCopy = async (text: string, target: 'reference' | 'polished') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 1800);
    } catch {
      // 浏览器不支持剪贴板时静默忽略
    }
  };

  const handleRequestAIGrade = useCallback(async () => {
    setAiError(null);
    if (!hasValidAIConfig()) {
      setAiError({
        code: 'no_key',
        message:
          '尚未配置 AI API Key。请前往「设置」填入你自己的端点与 Key，或继续使用下方的参考译文与自评清单。',
      });
      return;
    }

    setGrading(true);
    try {
      const response = await gradeTranslation({
        item,
        answer: submission.answer,
      });
      if (response.ok) {
        onSaveAIResult(response.result);
      } else {
        setAiError({ code: response.errorCode, message: response.message });
      }
    } finally {
      setGrading(false);
    }
  }, [item, submission.answer, onSaveAIResult]);

  useEffect(() => {
    if (autoGradeNonce > 0 && autoGradeNonce !== lastAutoNonceRef.current) {
      lastAutoNonceRef.current = autoGradeNonce;
      void handleRequestAIGrade();
    }
  }, [autoGradeNonce, handleRequestAIGrade]);

  return (
    <div className="space-y-5">
      {/* 顶部提交概览 */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="emerald">已提交</Badge>
              <Badge tone="indigo">{item.topic}</Badge>
              <span className="text-xs text-slate-500">
                提交于 {formatDateTime(submission.createdAt)}
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-bold text-slate-900">{item.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              译文词数：{submission.wordCount} 词 · 用时：{formatDuration(submission.durationSeconds)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={onBackToPractice}>
              <RotateCcw className="h-4 w-4" />
              返回修改 / 再练一次
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={grading}
              onClick={handleRequestAIGrade}
            >
              {grading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 批改中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {aiResult ? '重新 AI 批改' : '发起 AI 批改'}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* AI 批改状态 / 错误降级提示 */}
      {!aiConfigured && !aiResult && !aiError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">当前处于离线范文自评模式（未配置 AI Key）</p>
              <p className="mt-0.5 text-xs text-amber-800">
                你可以直接使用下方的「原文 / 我的译文 / 参考译文对照」与「关键采分短语自评清单」完成复盘；如需 AI 逐句诊断与打分，可前往设置配置 API Key。
              </p>
            </div>
          </div>
          <a
            href="#/settings"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            <Settings className="h-3.5 w-3.5" />
            前往设置
          </a>
        </div>
      )}

      {aiError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="text-sm text-rose-900">
              <p className="font-semibold">AI 批改暂不可用（已保留离线参考译文与自评功能）</p>
              <p className="mt-0.5 text-xs leading-relaxed text-rose-800">{aiError.message}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {(aiError.code === 'no_key' ||
              aiError.code === 'auth_error' ||
              aiError.code === 'cors_or_network') && (
              <a
                href="#/settings"
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
              >
                <Settings className="h-3.5 w-3.5" />
                检查设置
              </a>
            )}
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              disabled={grading}
              onClick={handleRequestAIGrade}
            >
              重试
            </Button>
          </div>
        </div>
      )}

      {/* AI 批改结果展示 */}
      {aiResult && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">AI 四级阅卷报告</h3>
                <p className="text-xs text-slate-500">基于四级翻译 15 分制评分标准生成</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-center">
                <p className="text-[11px] font-medium text-slate-500">原始分（满分 15）</p>
                <p className="text-xl font-bold text-indigo-600 tabular-nums">
                  {aiResult.score15}
                  <span className="text-xs font-normal text-slate-400"> / 15</span>
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-center">
                <p className="text-[11px] font-medium text-slate-500">报道分换算（满分 106.5）</p>
                <p className="text-xl font-bold text-emerald-600 tabular-nums">
                  {aiResult.score106}
                  <span className="text-xs font-normal text-slate-400"> / 106.5</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                总体评价
              </h4>
              <p className="mt-1.5 rounded-xl bg-white p-3.5 text-sm leading-relaxed text-slate-700 border border-slate-200/80">
                {aiResult.overallComment}
              </p>
            </div>

            {aiResult.strengths.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  译文亮点
                </h4>
                <ul className="mt-1.5 space-y-1.5">
                  {aiResult.strengths.map((strength, idx) => (
                    <li
                      key={`${strength}-${idx}`}
                      className="flex items-start gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiResult.issues.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  逐句问题诊断（{aiResult.issues.length} 处）
                </h4>
                <div className="mt-2 space-y-2.5">
                  {aiResult.issues.map((issue, idx) => (
                    <div
                      key={`${issue.original}-${idx}`}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-lg bg-rose-50/70 p-2.5">
                          <span className="text-[11px] font-semibold text-rose-700">原句表达</span>
                          <p className="mt-1 break-words text-slate-800">{issue.original || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50/70 p-2.5">
                          <span className="text-[11px] font-semibold text-emerald-700">
                            修改建议
                          </span>
                          <p className="mt-1 break-words text-slate-800">
                            {issue.suggestion || '—'}
                          </p>
                        </div>
                      </div>
                      {issue.reason && (
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          <span className="font-semibold text-slate-700">原因解析：</span>
                          {issue.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiResult.polishedVersion && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    AI 高分优化译文
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => handleCopy(aiResult.polishedVersion, 'polished')}
                  >
                    {copiedTarget === 'polished' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        复制优化译文
                      </>
                    )}
                  </Button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-indigo-200 bg-white p-3.5 text-sm leading-relaxed text-slate-800">
                  {aiResult.polishedVersion}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 离线对照区：中文原文 + 用户译文 + 参考译文 */}
      <Card>
        <h3 className="text-base font-bold text-slate-900">三栏对照复盘（离线可用）</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          对照中文原文、你的译文与四级参考译文，检查漏译、时态与核心句型。
        </p>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">中文原文</span>
              <span className="text-xs text-slate-400">{item.sourceText.length} 字</span>
            </div>
            <p className="text-sm leading-7 text-slate-800">{item.sourceText}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-indigo-700">我的译文</span>
                <span className="text-xs text-indigo-600">{submission.wordCount} 词</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                {submission.answer}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-emerald-700">参考译文</span>
                <button
                  type="button"
                  onClick={() => handleCopy(item.referenceTranslation, 'reference')}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                >
                  {copiedTarget === 'reference' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      复制
                    </>
                  )}
                </button>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                {item.referenceTranslation}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 关键采分短语自评清单 */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">关键采分短语自评清单</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              勾选你已准确译出或使用了等效表达的采分点，进度将自动保存到本条练习记录。
            </p>
          </div>
          <Badge tone={checkPercent >= 80 ? 'emerald' : checkPercent >= 50 ? 'indigo' : 'amber'}>
            自评命中 {checkedCount} / {totalPhrases}（{checkPercent}%）
          </Badge>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${checkPercent}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {item.keyPhrases.map((phrase) => {
            const checked = submission.checkedPhrases.includes(phrase);
            const autoMatched = isPhraseMatched(submission.answer, phrase);
            return (
              <button
                key={phrase}
                type="button"
                onClick={() => onTogglePhrase(phrase)}
                aria-pressed={checked}
                className={`flex items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                  checked
                    ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {checked ? (
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span className="break-words text-sm font-medium">{phrase}</span>
                </div>
                {autoMatched && (
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                    译文疑似命中
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

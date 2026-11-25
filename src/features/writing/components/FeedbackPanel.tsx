import { useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Loader2,
  Settings,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ui';
import type { AIErrorCode, AIGradeResult, WritingPrompt } from '../../../types/cet4';
import {
  countEnglishWords,
  getScoreBandLabel,
  getWordCountStatus,
  SELF_CHECK_CRITERIA,
} from '../utils';

interface AIErrorState {
  errorCode: AIErrorCode;
  message: string;
}

interface FeedbackPanelProps {
  prompt: WritingPrompt;
  essay: string;
  wordCount: number;
  selfChecks: string[];
  onToggleSelfCheck: (criterionId: string) => void;
  hasAIKey: boolean;
  aiLoading: boolean;
  aiResult: AIGradeResult | null;
  aiError: AIErrorState | null;
  onRequestAIGrade: () => void;
}

export function FeedbackPanel({
  prompt,
  essay,
  wordCount,
  selfChecks,
  onToggleSelfCheck,
  hasAIKey,
  aiLoading,
  aiResult,
  aiError,
  onRequestAIGrade,
}: FeedbackPanelProps) {
  const [copiedPolished, setCopiedPolished] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);

  const sampleWordCount = countEnglishWords(prompt.sampleEssay);
  const wordStatus = getWordCountStatus(wordCount, prompt.minWords, prompt.maxWords);
  const checkedCount = selfChecks.length;

  const handleCopyText = async (text: string, target: 'polished' | 'sample') => {
    try {
      await navigator.clipboard.writeText(text);
      if (target === 'polished') {
        setCopiedPolished(true);
        window.setTimeout(() => setCopiedPolished(false), 1800);
      } else {
        setCopiedSample(true);
        window.setTimeout(() => setCopiedSample(false), 1800);
      }
    } catch {
      // 某些无权限环境忽略剪贴板报错
    }
  };

  const getSelfEstimateLabel = (count: number) => {
    if (count >= 5) return { text: '预计 13~15 分（优秀档）', tone: 'emerald' as const };
    if (count >= 4) return { text: '预计 10~12 分（良好档）', tone: 'indigo' as const };
    if (count >= 3) return { text: '预计 8~10 分（及格档）', tone: 'amber' as const };
    return { text: '建议对照范文重点修改', tone: 'slate' as const };
  };

  const selfEstimate = getSelfEstimateLabel(checkedCount);

  return (
    <div className="space-y-5">
      {/* 1. AI 智能批改区域 */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">AI 四级阅卷批改（可选）</h2>
              <p className="text-xs text-slate-500">
                按四级 15 分制与 106.5 换算分评估，提供逐句纠错与高分润色
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!hasAIKey && (
              <a
                href="#/settings"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                去设置配置 AI Key
              </a>
            )}
            <Button
              type="button"
              variant={aiResult ? 'secondary' : 'primary'}
              onClick={onRequestAIGrade}
              disabled={aiLoading || !essay.trim()}
              className="text-xs sm:text-sm"
            >
              {aiLoading ? (
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

        {/* 加载中 */}
        {aiLoading && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-800">
            <Loader2 className="h-5 w-5 animate-spin shrink-0 text-indigo-600" />
            <div>
              <p className="font-medium">正在调用 AI 阅卷老师批改作文...</p>
              <p className="mt-0.5 text-xs text-indigo-600/90">
                通常需要 10~30 秒，你可以先在下方对照参考范文或完成自评。
              </p>
            </div>
          </div>
        )}

        {/* 错误或未配置降级提示 */}
        {!aiLoading && aiError && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold text-amber-900">
                  {aiError.errorCode === 'no_key' ? '尚未配置 AI 批改服务' : 'AI 批改请求未成功'}
                </p>
                <p className="text-sm text-amber-800 break-words">{aiError.message}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="#/settings"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    前往设置页配置
                  </a>
                  <span className="text-xs text-amber-700">
                    下方离线高分范文与四级维度自评清单仍可正常使用。
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 尚未触发 AI 批改时的说明 */}
        {!aiLoading && !aiError && !aiResult && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            {hasAIKey ? (
              <p>
                已检测到本地 AI 配置。点击右上角「发起 AI 批改」即可获取四级估算分数、语法纠错与润色版本。
              </p>
            ) : (
              <p>
                当前处于<span className="font-medium text-slate-800">离线自评模式</span>（未配置 AI API
                Key）。如需 AI 自动打分与逐句润色，请前往{' '}
                <a href="#/settings" className="font-medium text-indigo-600 underline underline-offset-2">
                  设置中心
                </a>{' '}
                填入你自己的 OpenAI 兼容端点与 Key；也可直接使用下方离线范文与自评清单。
              </p>
            )}
          </div>
        )}

        {/* AI 批改成功结果 */}
        {!aiLoading && aiResult && (
          <div className="mt-4 space-y-5">
            {/* 分数与总评 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-indigo-700">四级原始分（满分 15）</span>
                  <Badge tone={getScoreBandLabel(aiResult.score15).tone}>
                    {getScoreBandLabel(aiResult.score15).label}
                  </Badge>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums text-indigo-700">
                    {aiResult.score15.toFixed(1)}
                  </span>
                  <span className="text-sm text-indigo-500">/ 15</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  换算报道分：
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {aiResult.score106.toFixed(1)}
                  </span>{' '}
                  / 106.5
                </p>
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  阅卷总评
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {aiResult.overallComment}
                </p>
              </div>
            </div>

            {/* 亮点表达 */}
            {aiResult.strengths.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <Award className="h-4 w-4 text-emerald-600" />
                  亮点表达与得分点
                </h3>
                <ul className="space-y-1.5">
                  {aiResult.strengths.map((item, idx) => (
                    <li
                      key={`${idx}-${item.slice(0, 16)}`}
                      className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm text-emerald-900"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 语法与表达修改建议 */}
            {aiResult.issues.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <Wrench className="h-4 w-4 text-amber-600" />
                  语法与表达修改建议（{aiResult.issues.length} 处）
                </h3>
                <div className="space-y-2.5">
                  {aiResult.issues.map((issue, idx) => (
                    <div
                      key={`${idx}-${issue.original.slice(0, 16)}`}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm space-y-2"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg bg-rose-50/80 px-3 py-2">
                          <span className="block text-[11px] font-semibold text-rose-700">
                            原句 / 问题表达
                          </span>
                          <p className="mt-0.5 text-rose-900 break-words">{issue.original || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50/80 px-3 py-2">
                          <span className="block text-[11px] font-semibold text-emerald-700">
                            修改建议
                          </span>
                          <p className="mt-0.5 text-emerald-900 break-words">
                            {issue.suggestion || '—'}
                          </p>
                        </div>
                      </div>
                      {issue.reason && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-medium text-slate-700">原因说明：</span>
                          {issue.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 高分润色范文 */}
            {aiResult.polishedVersion && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">AI 高分润色版本</span>
                    <Badge tone="indigo">
                      {countEnglishWords(aiResult.polishedVersion)} 词
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(aiResult.polishedVersion, 'polished')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    {copiedPolished ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        复制润色版
                      </>
                    )}
                  </button>
                </div>
                <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                  {aiResult.polishedVersion}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 2. 离线参考范文与我的作文对照 */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">参考高分范文与得分要点</h2>
          </div>
          <Badge tone="emerald">离线可用</Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 我的作文 */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4 min-w-0">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">我的作文</span>
              <Badge tone={wordStatus.tone}>
                {wordCount} 词 · {wordStatus.label}
              </Badge>
            </div>
            <div className="flex-1 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
              {essay.trim() || '（暂无正文内容）'}
            </div>
          </div>

          {/* 参考高分范文 */}
          <div className="flex flex-col rounded-xl border border-indigo-200/70 bg-indigo-50/30 p-4 min-w-0">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-indigo-950">参考高分范文</span>
                <Badge tone="indigo">{sampleWordCount} 词</Badge>
              </div>
              <button
                type="button"
                onClick={() => handleCopyText(prompt.sampleEssay, 'sample')}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 cursor-pointer"
              >
                {copiedSample ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    复制范文
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
              {prompt.sampleEssay}
            </div>
          </div>
        </div>

        {/* 关键得分点与亮点表达 */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-xs font-semibold text-slate-700 mb-2">关键得分要点</p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {prompt.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                    {idx + 1}
                  </span>
                  <span className="break-words">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-xs font-semibold text-slate-700 mb-2">范文亮点词句积累</p>
            <div className="flex flex-wrap gap-1.5">
              {prompt.usefulExpressions.map((expr, idx) => (
                <span
                  key={idx}
                  className="inline-block rounded-lg border border-indigo-100 bg-indigo-50/70 px-2.5 py-1 text-xs font-medium text-indigo-800 break-words"
                >
                  {expr}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. 四级评分维度自评清单 */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900">四级评分维度自评清单</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="slate">
              已勾选 {checkedCount} / {SELF_CHECK_CRITERIA.length}
            </Badge>
            <Badge tone={selfEstimate.tone}>{selfEstimate.text}</Badge>
          </div>
        </div>

        <p className="mb-3 text-xs text-slate-500">
          对照上方参考范文与四级阅卷标准，逐项勾选你的作文已达标维度（自动保存至本次提交记录）：
        </p>

        <div className="space-y-2">
          {SELF_CHECK_CRITERIA.map((criterion) => {
            const checked = selfChecks.includes(criterion.id);
            const isWordCountRow = criterion.id === 'wordCount';
            return (
              <label
                key={criterion.id}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-colors cursor-pointer ${
                  checked
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleSelfCheck(criterion.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{criterion.label}</span>
                    {isWordCountRow && (
                      <Badge tone={wordStatus.tone}>
                        当前 {wordCount} 词（要求 {prompt.minWords}~{prompt.maxWords}）
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                    {criterion.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

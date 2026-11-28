import { useEffect, useRef, useState } from 'react';
import {
  Award,
  BookMarked,
  Check,
  CheckCircle2,
  Copy,
  Flame,
  RotateCcw,
  Volume2,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import type { VocabItem } from '../../types/cet4';
import { formatDuration } from './utils';

export interface SessionRecord {
  item: VocabItem;
  userInput: string;
  correct: boolean;
  revealedAnswer: boolean;
}

interface SessionSummaryProps {
  modeLabel: string;
  records: SessionRecord[];
  bestStreak: number;
  durationSeconds: number;
  speechSupported: boolean;
  speakingWordId: string | null;
  onSpeak: (item: VocabItem) => void;
  onRestartSameFilter: () => void;
  onPracticeSessionWrong: (wrongItems: VocabItem[]) => void;
  onOpenWrongBook: () => void;
}

export function SessionSummary({
  modeLabel,
  records,
  bestStreak,
  durationSeconds,
  speechSupported,
  speakingWordId,
  onSpeak,
  onRestartSameFilter,
  onPracticeSessionWrong,
  onOpenWrongBook,
}: SessionSummaryProps) {
  const total = records.length;
  const correctCount = records.filter((r) => r.correct).length;
  const wrongRecords = records.filter((r) => !r.correct);
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const copyTimerRef = useRef<number | null>(null);

  const summaryText = `CET4-Prep 词汇练习（${modeLabel}）：${correctCount}/${total}（正确率 ${accuracy}% · 最高连对 ${bestStreak} · 错词 ${wrongRecords.length} · 用时 ${formatDuration(durationSeconds)}）`;

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopySummary = async () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }

    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
        setCopyState('copied');
        copyTimerRef.current = window.setTimeout(() => {
          setCopyState('idle');
          copyTimerRef.current = null;
        }, 2500);
        return;
      }
    } catch {
      // 某些移动端或 file:// 环境下 Clipboard API 会被浏览器拒绝，降级为可见手动选择区
    }

    setCopyState('manual');
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Award className="h-7 w-7" />
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">本轮练习完成！</h2>
          <p className="mt-1 text-sm text-slate-500">
            练习范围：{modeLabel} · 用时 {formatDuration(durationSeconds)} · 成绩已计入学习记录
          </p>

          <div className="mt-5 grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">本轮正确率</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{accuracy}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">答对 / 总数</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {correctCount}
                <span className="text-sm font-medium text-slate-400"> / {total}</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">新增/复错</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{wrongRecords.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center justify-center gap-1 text-xs text-slate-500">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                最高连对
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{bestStreak}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Button onClick={onRestartSameFilter}>
              <RotateCcw className="h-4 w-4" />
              再练一轮
            </Button>
            {wrongRecords.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => onPracticeSessionWrong(wrongRecords.map((r) => r.item))}
              >
                重练本轮 {wrongRecords.length} 个错词
              </Button>
            )}
            <Button variant="secondary" onClick={() => void handleCopySummary()}>
              {copyState === 'copied' ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  已复制战绩
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  复制本轮战绩
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={onOpenWrongBook}>
              <BookMarked className="h-4 w-4" />
              查看错词本
            </Button>
          </div>

          {copyState === 'manual' && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-3 text-left"
            >
              <p className="text-xs font-medium text-amber-800">
                当前环境不支持自动复制（例如手机本地 file:// 打开），请长按或全选下方战绩文本手动复制：
              </p>
              <textarea
                readOnly
                rows={2}
                value={summaryText}
                aria-label="本轮战绩文本"
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                className="mt-2 w-full resize-none rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      </Card>

      {wrongRecords.length > 0 ? (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              本轮错词回顾（{wrongRecords.length}）
            </h3>
            <Badge tone="rose">已自动加入错词本</Badge>
          </div>

          <div className="divide-y divide-slate-100">
            {wrongRecords.map((record) => (
              <div
                key={record.item.id}
                className="flex flex-col gap-2 py-3 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{record.item.word}</span>
                    <Badge tone="indigo">{record.item.pos}</Badge>
                    {record.item.phonetic && (
                      <span className="font-mono text-xs text-slate-500">
                        {record.item.phonetic}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{record.item.meaning}</p>
                  <p className="flex items-center gap-1.5 text-xs text-rose-600">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    {record.revealedAnswer
                      ? '已查看完整答案'
                      : `你的作答：${record.userInput || '（未填写）'}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSpeak(record.item)}
                  disabled={!speechSupported}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                    speakingWordId === record.item.id
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                  aria-label={`播放 ${record.item.word} 发音`}
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center gap-2.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>本轮全部答对，零失误！</span>
          </div>
        </Card>
      )}
    </div>
  );
}

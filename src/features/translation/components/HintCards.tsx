import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Lightbulb } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ui';

interface HintItem {
  zh: string;
  en: string;
}

interface HintCardsProps {
  hints: HintItem[];
  revealedIndices: number[];
  onToggleHint: (index: number) => void;
  onRevealAll: () => void;
  onHideAll: () => void;
}

export function HintCards({
  hints,
  revealedIndices,
  onToggleHint,
  onRevealAll,
  onHideAll,
}: HintCardsProps) {
  const [expanded, setExpanded] = useState(true);

  if (hints.length === 0) {
    return null;
  }

  const allRevealed = revealedIndices.length === hints.length;

  return (
    <Card className="border-amber-200/80 bg-amber-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Lightbulb className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-slate-900">核心难点词汇提示卡</span>
          <Badge tone="amber">
            已揭晓 {revealedIndices.length}/{hints.length}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {expanded && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-2.5 py-1 text-xs"
              onClick={allRevealed ? onHideAll : onRevealAll}
            >
              {allRevealed ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  全部隐藏
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  全部显示
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3">
          <p className="mb-2.5 text-xs text-slate-500">
            默认仅显示中文核心词，点击单个词卡可揭晓或收起对应英文表达。
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {hints.map((hint, idx) => {
              const isRevealed = revealedIndices.includes(idx);
              return (
                <button
                  key={`${hint.zh}-${idx}`}
                  type="button"
                  onClick={() => onToggleHint(idx)}
                  aria-pressed={isRevealed}
                  className={`group flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    isRevealed
                      ? 'border-indigo-300 bg-white shadow-xs'
                      : 'border-amber-200 bg-white/80 hover:border-amber-300 hover:bg-white'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{hint.zh}</span>
                    <span
                      className={`shrink-0 text-xs ${
                        isRevealed
                          ? 'text-indigo-600'
                          : 'text-slate-400 group-hover:text-amber-600'
                      }`}
                    >
                      {isRevealed ? '点击隐藏' : '点击揭晓'}
                    </span>
                  </div>
                  {isRevealed ? (
                    <span className="mt-1.5 break-words text-sm font-medium text-indigo-700">
                      {hint.en}
                    </span>
                  ) : (
                    <span className="mt-1.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                      ••••••
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

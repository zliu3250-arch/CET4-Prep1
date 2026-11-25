import { useEffect, useRef } from 'react';
import { BookOpen, Check, Type } from 'lucide-react';
import { Badge, Card } from '../../components/ui';
import type { ReadingPassage } from '../../types/cet4';
import {
  READING_TYPE_META,
  getParagraphLabel,
  type FontSizeMode,
} from './types';

interface PassageViewerProps {
  passage: ReadingPassage;
  fontSize: FontSizeMode;
  onChangeFontSize: (mode: FontSizeMode) => void;
  answers: Record<string, string>;
  submitted: boolean;
  activeQuestionId: string | null;
  highlightedParagraph: string | null;
  onSelectBlankQuestion: (questionId: string) => void;
  onPickWordFromBank: (label: string) => void;
}

/** 渲染包含 [1] / [2] 等挖空标记的选词填空段落 */
function renderClozeText(
  text: string,
  passage: ReadingPassage,
  answers: Record<string, string>,
  submitted: boolean,
  activeQuestionId: string | null,
  onSelectBlankQuestion: (questionId: string) => void,
) {
  const parts = text.split(/(\[\d+\])/g);
  const wordBankMap = new Map<string, string>();
  if (passage.wordBank) {
    for (const item of passage.wordBank) {
      wordBankMap.set(item.label, item.word);
    }
  }

  return parts.map((part, idx) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) {
      return <span key={idx}>{part}</span>;
    }

    const blankNum = Number(match[1]);
    const question = passage.questions.find((q) => q.number === blankNum);
    if (!question) {
      return (
        <span
          key={idx}
          className="mx-1 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600"
        >
          {part}
        </span>
      );
    }

    const selectedLabel = answers[question.id] ?? '';
    const selectedWord = selectedLabel ? wordBankMap.get(selectedLabel) : undefined;
    const isActive = activeQuestionId === question.id;
    const isCorrect = submitted && selectedLabel === question.answer;
    const isWrong = submitted && selectedLabel !== question.answer;

    let styleClass =
      'border-indigo-300 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100';
    if (isActive && !submitted) {
      styleClass =
        'border-indigo-600 bg-indigo-600 text-white ring-2 ring-indigo-200';
    } else if (selectedLabel && !submitted) {
      styleClass =
        'border-indigo-400 bg-indigo-50 text-indigo-800 hover:bg-indigo-100';
    } else if (isCorrect) {
      styleClass = 'border-emerald-400 bg-emerald-50 text-emerald-700';
    } else if (isWrong) {
      styleClass = 'border-rose-400 bg-rose-50 text-rose-700';
    }

    return (
      <button
        key={idx}
        type="button"
        onClick={() => onSelectBlankQuestion(question.id)}
        className={`mx-1 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 align-baseline font-sans text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${styleClass}`}
        title={
          submitted
            ? `第 ${blankNum} 空 · 正确答案：${question.answer}${
                wordBankMap.get(question.answer)
                  ? ` (${wordBankMap.get(question.answer)})`
                  : ''
              }`
            : `点击定位或填入第 ${blankNum} 空`
        }
      >
        <span className="opacity-75">[{blankNum}]</span>
        <span>
          {selectedLabel
            ? selectedWord
              ? `${selectedLabel}. ${selectedWord}`
              : selectedLabel
            : '____'}
        </span>
        {isWrong && (
          <span className="ml-0.5 text-[11px] font-bold text-emerald-700">
            → {question.answer}
          </span>
        )}
      </button>
    );
  });
}

export function PassageViewer({
  passage,
  fontSize,
  onChangeFontSize,
  answers,
  submitted,
  activeQuestionId,
  highlightedParagraph,
  onSelectBlankQuestion,
  onPickWordFromBank,
}: PassageViewerProps) {
  const paragraphRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const typeMeta = READING_TYPE_META[passage.type];

  useEffect(() => {
    if (!highlightedParagraph) return;
    const node = paragraphRefs.current[highlightedParagraph];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedParagraph]);

  // 统计选词填空词库中每个词被哪些题号选中
  const usedBankLabels = new Map<string, number[]>();
  if (passage.type === 'banked_cloze') {
    for (const q of passage.questions) {
      const chosen = answers[q.id];
      if (chosen) {
        const list = usedBankLabels.get(chosen) ?? [];
        list.push(q.number);
        usedBankLabels.set(chosen, list);
      }
    }
  }

  const activeQuestion = passage.questions.find((q) => q.id === activeQuestionId) ?? null;

  const textSizeClass =
    fontSize === 'large'
      ? 'text-base sm:text-[17px] leading-8'
      : 'text-sm sm:text-[15px] leading-7';

  return (
    <Card className="flex flex-col gap-4">
      {/* 原文头部：题型徽章 + 标题 + 字号切换 */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={typeMeta.badgeTone}>{typeMeta.label}</Badge>
            <span className="text-xs text-slate-500">
              共 {passage.paragraphs.length} 段 · {passage.questions.length} 题 · 建议{' '}
              {passage.suggestedMinutes} 分钟
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 break-words">
            {passage.title}
          </h2>
        </div>

        {/* 字号调节 */}
        <div
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
          role="group"
          aria-label="正文字号调节"
        >
          <Type className="ml-1.5 h-3.5 w-3.5 text-slate-400" />
          <button
            type="button"
            onClick={() => onChangeFontSize('standard')}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
              fontSize === 'standard'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            标准
          </button>
          <button
            type="button"
            onClick={() => onChangeFontSize('large')}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
              fontSize === 'large'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            舒适大字
          </button>
        </div>
      </div>

      {/* 选词填空词库面板 */}
      {passage.type === 'banked_cloze' &&
        passage.wordBank &&
        passage.wordBank.length > 0 && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <BookOpen className="h-3.5 w-3.5 text-amber-600" />
                <span>备选词库（Word Bank）</span>
              </div>
              {!submitted && (
                <span className="text-[11px] text-amber-700">
                  {activeQuestion
                    ? `点击词汇直接填入第 [${activeQuestion.number}] 空`
                    : '先点选原文空位或题目，再点词填入'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {passage.wordBank.map((item) => {
                const usedBy = usedBankLabels.get(item.label) ?? [];
                const isUsed = usedBy.length > 0;
                const isSelectedForActive =
                  activeQuestion !== null && answers[activeQuestion.id] === item.label;

                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled={submitted}
                    onClick={() => onPickWordFromBank(item.label)}
                    className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs sm:text-sm transition-colors ${
                      submitted
                        ? 'cursor-default border-slate-200 bg-white text-slate-600'
                        : isSelectedForActive
                          ? 'cursor-pointer border-indigo-500 bg-indigo-50 text-indigo-800 font-semibold'
                          : isUsed
                            ? 'cursor-pointer border-slate-200 bg-slate-100/80 text-slate-400 hover:border-amber-300 hover:text-slate-600'
                            : 'cursor-pointer border-amber-200/80 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40'
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      <span className="mr-1.5 font-mono font-bold text-amber-700">
                        {item.label}.
                      </span>
                      <span className={isUsed && !isSelectedForActive ? 'line-through' : ''}>
                        {item.word}
                      </span>
                    </span>
                    {isUsed && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-slate-200/80 px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                        <Check className="h-2.5 w-2.5" />
                        {usedBy.map((n) => `[${n}]`).join(',')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* 原文段落区 */}
      <div className="space-y-4">
        {passage.paragraphs.map((para, idx) => {
          const label = getParagraphLabel(passage, idx, para.label);
          const isHighlighted =
            highlightedParagraph !== null &&
            highlightedParagraph.toUpperCase() === label.toUpperCase();

          return (
            <div
              key={`${passage.id}-p-${idx}`}
              ref={(el) => {
                paragraphRefs.current[label.toUpperCase()] = el;
              }}
              className={`flex items-start gap-3 rounded-xl p-2.5 transition-colors ${
                isHighlighted
                  ? 'bg-indigo-50/90 ring-1 ring-indigo-300'
                  : 'bg-transparent'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  isHighlighted
                    ? 'bg-indigo-600 text-white'
                    : passage.type === 'matching'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
                aria-label={`段落 ${label}`}
              >
                {label}
              </span>
              <p className={`min-w-0 flex-1 text-slate-800 break-words ${textSizeClass}`}>
                {passage.type === 'banked_cloze'
                  ? renderClozeText(
                      para.text,
                      passage,
                      answers,
                      submitted,
                      activeQuestionId,
                      onSelectBlankQuestion,
                    )
                  : para.text}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

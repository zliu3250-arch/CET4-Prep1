import { useEffect, useRef } from 'react';
import {
  CheckCircle2,
  MapPin,
  RotateCcw,
  Send,
  XCircle,
  BookOpenCheck,
  Award,
} from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import type { ReadingPassage, ReadingQuestion } from '../../types/cet4';
import {
  formatDuration,
  getQuestionOptions,
  parseLocateParagraphLabel,
  type GradeSummary,
} from './types';

interface QuestionListProps {
  passage: ReadingPassage;
  answers: Record<string, string>;
  submitted: boolean;
  gradeSummary: GradeSummary | null;
  activeQuestionId: string | null;
  onSelectAnswer: (questionId: string, label: string) => void;
  onFocusQuestion: (questionId: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onLocateParagraph: (paragraphLabel: string) => void;
}

export function QuestionList({
  passage,
  answers,
  submitted,
  gradeSummary,
  activeQuestionId,
  onSelectAnswer,
  onFocusQuestion,
  onSubmit,
  onReset,
  onLocateParagraph,
}: QuestionListProps) {
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activeQuestionId) return;
    const node = questionRefs.current[activeQuestionId];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeQuestionId]);

  const answeredCount = passage.questions.reduce(
    (acc, q) => (answers[q.id] ? acc + 1 : acc),
    0,
  );
  const totalCount = passage.questions.length;
  const unansweredCount = totalCount - answeredCount;

  // 选词填空：记录每个词汇被哪些题号选中，方便在下拉和点选中标记已选词汇
  const usedLabelToQuestions = new Map<string, number[]>();
  if (passage.type === 'banked_cloze') {
    for (const q of passage.questions) {
      const val = answers[q.id];
      if (val) {
        const list = usedLabelToQuestions.get(val) ?? [];
        list.push(q.number);
        usedLabelToQuestions.set(val, list);
      }
    }
  }

  const getOptionDisplay = (
    question: ReadingQuestion,
    label: string,
  ): string => {
    const opts = getQuestionOptions(passage, question);
    const found = opts.find((o) => o.label === label);
    if (!found) return label;
    if (passage.type === 'matching' && found.text === `段落 ${found.label}`) {
      return `段落 ${found.label}`;
    }
    return `${found.label}. ${found.text}`;
  };

  return (
    <div className="space-y-4">
      {/* 交卷成绩总览 */}
      {submitted && gradeSummary && (
        <Card className="border-indigo-200 bg-indigo-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  本次阅读判分完成 · 得分 {gradeSummary.score} / {gradeSummary.maxScore}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  正确率{' '}
                  <span className="font-semibold text-emerald-700">
                    {gradeSummary.accuracy}%
                  </span>{' '}
                  · 对 {gradeSummary.correctCount} 题 / 错 {gradeSummary.wrongCount} 题
                  {gradeSummary.unansweredCount > 0
                    ? `（含 ${gradeSummary.unansweredCount} 题未答）`
                    : ''}{' '}
                  · 用时 {formatDuration(gradeSummary.durationSeconds)}
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={onReset} className="shrink-0">
              <RotateCcw className="h-4 w-4" />
              重新作答
            </Button>
          </div>
        </Card>
      )}

      {/* 题目列表 */}
      {passage.questions.map((question) => {
        const options = getQuestionOptions(passage, question);
        const userAnswer = answers[question.id] ?? '';
        const isCorrect = submitted && userAnswer === question.answer;
        const isWrong = submitted && userAnswer !== question.answer;
        const isActive = activeQuestionId === question.id && !submitted;

        const targetParagraph =
          parseLocateParagraphLabel(question.locateHint) ??
          (passage.type === 'matching' ? question.answer.toUpperCase() : null);

        return (
          <div
            key={question.id}
            ref={(el) => {
              questionRefs.current[question.id] = el;
            }}
            onClick={() => {
              if (!submitted && passage.type === 'banked_cloze') {
                onFocusQuestion(question.id);
              }
            }}
            className={`rounded-2xl border bg-white p-4 shadow-xs transition-colors ${
              isCorrect
                ? 'border-emerald-300 bg-emerald-50/20'
                : isWrong
                  ? 'border-rose-300 bg-rose-50/20'
                  : isActive
                    ? 'border-indigo-400 ring-1 ring-indigo-200'
                    : 'border-slate-200'
            }`}
          >
            {/* 题干头部 */}
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isCorrect
                      ? 'bg-emerald-600 text-white'
                      : isWrong
                        ? 'bg-rose-600 text-white'
                        : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {question.number}
                </span>
                <p className="text-sm font-semibold text-slate-900 leading-relaxed break-words">
                  {question.stem}
                </p>
              </div>

              {submitted && (
                <div className="shrink-0">
                  {isCorrect ? (
                    <Badge tone="emerald">正确</Badge>
                  ) : userAnswer ? (
                    <Badge tone="rose">答错</Badge>
                  ) : (
                    <Badge tone="amber">未答</Badge>
                  )}
                </div>
              )}
            </div>

            {/* 题型 1：仔细阅读（四选一单选） */}
            {passage.type === 'careful' && (
              <div className="space-y-2">
                {options.map((opt) => {
                  const selected = userAnswer === opt.label;
                  const optIsAnswer = submitted && opt.label === question.answer;
                  const optIsWrongChoice =
                    submitted && selected && opt.label !== question.answer;

                  let btnClass =
                    'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50';
                  if (optIsAnswer) {
                    btnClass =
                      'border-emerald-400 bg-emerald-50 text-emerald-900 font-medium';
                  } else if (optIsWrongChoice) {
                    btnClass =
                      'border-rose-400 bg-rose-50 text-rose-900 font-medium';
                  } else if (selected && !submitted) {
                    btnClass =
                      'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium';
                  }

                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={submitted}
                      onClick={() => onSelectAnswer(question.id, opt.label)}
                      className={`w-full flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        submitted ? 'cursor-default' : 'cursor-pointer'
                      } ${btnClass}`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          optIsAnswer
                            ? 'bg-emerald-600 text-white'
                            : optIsWrongChoice
                              ? 'bg-rose-600 text-white'
                              : selected && !submitted
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="min-w-0 flex-1 leading-relaxed break-words">
                        {opt.text}
                      </span>
                      {optIsAnswer && (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      )}
                      {optIsWrongChoice && (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 题型 2：选词填空（下拉选择 + 词卡点选） */}
            {passage.type === 'banked_cloze' && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`第 ${question.number} 空选择答案`}
                    disabled={submitted}
                    value={userAnswer}
                    onFocus={() => onFocusQuestion(question.id)}
                    onChange={(e) => onSelectAnswer(question.id, e.target.value)}
                    className={`w-full sm:w-auto sm:min-w-[200px] rounded-xl border px-3 py-2 text-sm font-medium outline-none transition-colors ${
                      isCorrect
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                        : isWrong
                          ? 'border-rose-400 bg-rose-50 text-rose-900'
                          : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                    }`}
                  >
                    <option value="">-- 请选择词库中的词汇 --</option>
                    {options.map((opt) => {
                      const usedByOthers = (
                        usedLabelToQuestions.get(opt.label) ?? []
                      ).filter((n) => n !== question.number);
                      const suffix =
                        usedByOthers.length > 0
                          ? `（已用于 [${usedByOthers.join(',')}]）`
                          : '';
                      return (
                        <option key={opt.label} value={opt.label}>
                          {opt.label}. {opt.text}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                  {!submitted && userAnswer && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAnswer(question.id, '');
                      }}
                      className="text-xs text-slate-500 hover:text-rose-600 cursor-pointer"
                    >
                      清空此空
                    </button>
                  )}
                </div>

                {/* 快捷点选胶囊 */}
                <div className="flex flex-wrap gap-1.5">
                  {options.map((opt) => {
                    const selected = userAnswer === opt.label;
                    const optIsAnswer = submitted && opt.label === question.answer;
                    const optIsWrongChoice =
                      submitted && selected && opt.label !== question.answer;
                    const usedByOthers = (
                      usedLabelToQuestions.get(opt.label) ?? []
                    ).filter((n) => n !== question.number);

                    let pillClass =
                      'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60';
                    if (optIsAnswer) {
                      pillClass =
                        'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold';
                    } else if (optIsWrongChoice) {
                      pillClass =
                        'border-rose-400 bg-rose-50 text-rose-800 font-semibold';
                    } else if (selected && !submitted) {
                      pillClass =
                        'border-indigo-600 bg-indigo-600 text-white font-semibold';
                    } else if (usedByOthers.length > 0 && !submitted) {
                      pillClass =
                        'border-slate-200 bg-slate-100/70 text-slate-400 line-through hover:text-slate-600';
                    }

                    return (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={submitted}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusQuestion(question.id);
                          onSelectAnswer(
                            question.id,
                            selected ? '' : opt.label,
                          );
                        }}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                          submitted ? 'cursor-default' : 'cursor-pointer'
                        } ${pillClass}`}
                      >
                        <span className="font-mono font-bold">{opt.label}.</span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 题型 3：长篇匹配（段落字母选择） */}
            {passage.type === 'matching' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">选择匹配的段落编号：</p>
                <div className="flex flex-wrap gap-2">
                  {options.map((opt) => {
                    const selected = userAnswer === opt.label;
                    const optIsAnswer = submitted && opt.label === question.answer;
                    const optIsWrongChoice =
                      submitted && selected && opt.label !== question.answer;

                    let chipClass =
                      'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/40';
                    if (optIsAnswer) {
                      chipClass =
                        'border-emerald-500 bg-emerald-600 text-white font-bold';
                    } else if (optIsWrongChoice) {
                      chipClass =
                        'border-rose-500 bg-rose-600 text-white font-bold';
                    } else if (selected && !submitted) {
                      chipClass =
                        'border-indigo-600 bg-indigo-600 text-white font-bold';
                    }

                    return (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={submitted}
                        onClick={() => onSelectAnswer(question.id, opt.label)}
                        className={`inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors ${
                          submitted ? 'cursor-default' : 'cursor-pointer'
                        } ${chipClass}`}
                        title={opt.text}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 交卷后展开的解析与定位提示 */}
            {submitted && (
              <div className="mt-3.5 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3 text-xs sm:text-sm space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <BookOpenCheck className="h-3.5 w-3.5" />
                      正确答案：{getOptionDisplay(question, question.answer)}
                    </span>
                    {!isCorrect && (
                      <span className="text-rose-600">
                        （你的作答：
                        {userAnswer ? getOptionDisplay(question, userAnswer) : '未作答'}）
                      </span>
                    )}
                  </div>

                  {targetParagraph && (
                    <button
                      type="button"
                      onClick={() => onLocateParagraph(targetParagraph)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                    >
                      <MapPin className="h-3 w-3" />
                      定位第 {targetParagraph} 段
                    </button>
                  )}
                </div>

                {question.locateHint && (
                  <p className="text-xs text-indigo-700">
                    <span className="font-semibold">原文定位：</span>
                    {question.locateHint}
                  </p>
                )}

                <p className="text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-800">题目解析：</span>
                  {question.explanation}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* 底部提交 / 重做栏 */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {submitted ? (
            <span>已展示全部解析与原文定位，可随时重置重练。</span>
          ) : (
            <span>
              已完成{' '}
              <strong className="text-indigo-700">
                {answeredCount} / {totalCount}
              </strong>{' '}
              题
              {unansweredCount > 0 && (
                <span className="ml-1.5 text-xs text-slate-400">
                  （还剩 {unansweredCount} 题未答）
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {submitted ? (
            <Button variant="secondary" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
              重新作答
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={totalCount === 0}>
              <Send className="h-4 w-4" />
              交卷并查看解析
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

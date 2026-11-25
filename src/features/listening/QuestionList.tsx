import { CheckCircle2, CircleHelp, RotateCcw, Send, XCircle } from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import type { ListeningQuestion } from '../../types/cet4';

interface QuestionListProps {
  questions: ListeningQuestion[];
  answers: Record<string, string>;
  submitted: boolean;
  scoreSummary: {
    correctCount: number;
    total: number;
    accuracy: number;
    durationSeconds: number;
  } | null;
  onSelectAnswer: (questionId: string, optionLabel: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function QuestionList({
  questions,
  answers,
  submitted,
  scoreSummary,
  onSelectAnswer,
  onSubmit,
  onReset,
}: QuestionListProps) {
  const answeredCount = questions.filter((q) => Boolean(answers[q.id])).length;

  if (questions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500 text-center py-6">
          当前听力套题暂未配置选择题，你可以专注精听音频并对照原文脚本练习。
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 交卷成绩汇总栏 */}
      {submitted && scoreSummary && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-slate-900">
                  本次得分：{scoreSummary.correctCount} / {scoreSummary.total} 题
                </span>
                <Badge
                  tone={
                    scoreSummary.accuracy >= 80
                      ? 'emerald'
                      : scoreSummary.accuracy >= 60
                        ? 'amber'
                        : 'rose'
                  }
                >
                  正确率 {scoreSummary.accuracy}%
                </Badge>
                <Badge tone="slate">用时 {scoreSummary.durationSeconds} 秒</Badge>
              </div>
              <p className="text-xs text-slate-600">
                练习记录已自动保存至学习统计。下方可查看错题标红、正解标绿与逐题解析，并展开听力原文复盘。
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onReset}
              className="shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
              重新作答
            </Button>
          </div>
        </Card>
      )}

      {/* 逐题卡片 */}
      <div className="space-y-3">
        {questions.map((question) => {
          const selected = answers[question.id];
          const isCorrect = submitted && selected === question.answer;
          const isWrong = submitted && selected !== question.answer;

          return (
            <Card
              key={question.id}
              className={`space-y-3 transition-colors ${
                submitted
                  ? isCorrect
                    ? 'border-emerald-200'
                    : 'border-rose-200'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      submitted
                        ? isCorrect
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                        : selected
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {question.number}
                  </span>
                  <p className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed break-words">
                    {question.stem || `第 ${question.number} 题（请根据听力内容选择最佳答案）`}
                  </p>
                </div>

                {submitted && (
                  <div className="shrink-0">
                    {isCorrect ? (
                      <Badge tone="emerald">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        正确
                      </Badge>
                    ) : (
                      <Badge tone="rose">
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        {selected ? '答错' : '未选'}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* 选项列表 */}
              <div className="grid gap-2">
                {question.options.map((opt) => {
                  const isUserChoice = selected === opt.label;
                  const isAnswer = opt.label === question.answer;

                  let optionStyle =
                    'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40';

                  if (!submitted && isUserChoice) {
                    optionStyle =
                      'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-600/20';
                  } else if (submitted) {
                    if (isAnswer) {
                      optionStyle =
                        'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium';
                    } else if (isUserChoice && !isAnswer) {
                      optionStyle = 'border-rose-500 bg-rose-50 text-rose-900';
                    } else {
                      optionStyle = 'border-slate-200 bg-slate-50/60 text-slate-500';
                    }
                  }

                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={submitted}
                      onClick={() => onSelectAnswer(question.id, opt.label)}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors flex items-start gap-2.5 ${
                        submitted ? 'cursor-default' : 'cursor-pointer'
                      } ${optionStyle}`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                          !submitted && isUserChoice
                            ? 'bg-indigo-600 text-white'
                            : submitted && isAnswer
                              ? 'bg-emerald-600 text-white'
                              : submitted && isUserChoice && !isAnswer
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="flex-1 leading-relaxed break-words">{opt.text}</span>
                      {submitted && isAnswer && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      )}
                      {submitted && isUserChoice && !isAnswer && (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 交卷后逐题解析 */}
              {submitted && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                    isWrong
                      ? 'border-rose-200 bg-rose-50/60 text-slate-700'
                      : 'border-emerald-200 bg-emerald-50/60 text-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800 mb-1">
                    <CircleHelp className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>正确答案：{question.answer}</span>
                    {!isCorrect && (
                      <span className="text-rose-600 font-normal">
                        （你的选择：{selected ?? '未作答'}）
                      </span>
                    )}
                  </div>
                  <p className="break-words text-slate-700">
                    {question.explanation || '暂无文字解析，请展开下方听力原文核对关键句。'}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 底部交卷操作栏 */}
      {!submitted && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-sm text-slate-600">
            已完成作答：
            <span className="font-semibold text-indigo-600 ml-1">
              {answeredCount} / {questions.length}
            </span>{' '}
            题
          </div>
          <div className="flex items-center gap-2">
            {answeredCount > 0 && (
              <Button type="button" variant="ghost" onClick={onReset}>
                清空选择
              </Button>
            )}
            <Button type="button" onClick={onSubmit} className="flex-1 sm:flex-none">
              <Send className="h-4 w-4" />
              交卷判分
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

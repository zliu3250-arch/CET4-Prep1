import { Clock, FileText, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../../../components/ui';
import type { WritingSubmission } from '../types';
import { formatDuration, formatTimeShort, SELF_CHECK_CRITERIA } from '../utils';

interface HistoryDrawerProps {
  submissions: WritingSubmission[];
  activePromptId: string | null;
  filterCurrentOnly: boolean;
  onToggleFilter: () => void;
  onSelectSubmission: (sub: WritingSubmission) => void;
  onLoadToEditor: (sub: WritingSubmission) => void;
  onDeleteSubmission: (id: string) => void;
  onClose: () => void;
}

export function HistoryDrawer({
  submissions,
  activePromptId,
  filterCurrentOnly,
  onToggleFilter,
  onSelectSubmission,
  onLoadToEditor,
  onDeleteSubmission,
  onClose,
}: HistoryDrawerProps) {
  const visibleList =
    filterCurrentOnly && activePromptId
      ? submissions.filter((s) => s.promptId === activePromptId)
      : submissions;

  return (
    <Card className="border-indigo-200 bg-white">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">
            历史提交记录（{visibleList.length}）
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {activePromptId && (
            <button
              type="button"
              onClick={onToggleFilter}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                filterCurrentOnly
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filterCurrentOnly ? '仅看本题' : '显示全部题目'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="关闭历史记录"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {visibleList.length === 0 ? (
        <EmptyState
          title="暂无写作提交记录"
          description="完成作文并点击「交卷查看范文与自评」或「AI 批改」后，记录将自动保存在本地浏览器中。"
        />
      ) : (
        <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
          {visibleList.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="indigo">{sub.category}</Badge>
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {sub.promptTitle}
                    </h3>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeShort(sub.createdAt)}
                    </span>
                    <span>{sub.wordCount} 词</span>
                    <span>用时 {formatDuration(sub.durationSeconds)}</span>
                    <span>
                      自评 {sub.selfChecks.length}/{SELF_CHECK_CRITERIA.length}
                    </span>
                  </div>
                </div>

                {sub.aiResult && (
                  <Badge tone="emerald" className="shrink-0">
                    <Sparkles className="mr-1 h-3 w-3" />
                    AI {sub.aiResult.score15.toFixed(1)}/15
                  </Badge>
                )}
              </div>

              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                {sub.essay}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  onClick={() => onDeleteSubmission(sub.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => onLoadToEditor(sub)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  载入编辑
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => onSelectSubmission(sub)}
                >
                  查看反馈
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

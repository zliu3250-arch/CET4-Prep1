import { Clock, Eye, FileText, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../../../components/ui';
import { formatDateTime, formatDuration, type TranslationSubmission } from '../storage';

interface HistoryPanelProps {
  records: TranslationSubmission[];
  activeRecordId: string | null;
  onSelectRecord: (record: TranslationSubmission) => void;
  onDeleteRecord: (id: string) => void;
}

export function HistoryPanel({
  records,
  activeRecordId,
  onSelectRecord,
  onDeleteRecord,
}: HistoryPanelProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        title="暂无翻译提交记录"
        description="完成一篇汉译英练习并点击「交卷对照范文」后，系统会自动保存你的译文、自评与 AI 批改报告。"
      />
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => {
        const isSelected = record.id === activeRecordId;
        return (
          <Card
            key={record.id}
            className={`transition-colors ${
              isSelected ? 'border-indigo-300 ring-1 ring-indigo-200' : ''
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="indigo">{record.topic}</Badge>
                  {record.aiResult ? (
                    <Badge tone="emerald">
                      <Sparkles className="mr-1 h-3 w-3" />
                      AI {record.aiResult.score15}/15（{record.aiResult.score106}分）
                    </Badge>
                  ) : (
                    <Badge tone="slate">离线自评</Badge>
                  )}
                  <span className="text-xs text-slate-400">
                    {formatDateTime(record.createdAt)}
                  </span>
                </div>

                <h3 className="mt-1.5 text-base font-semibold text-slate-900">
                  {record.title}
                </h3>

                <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">
                  {record.answer}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {record.wordCount} 词
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    用时 {formatDuration(record.durationSeconds)}
                  </span>
                  <span>自评勾选 {record.checkedPhrases.length} 项短语</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => onSelectRecord(record)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  查看复盘
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                  title="删除该条记录"
                  onClick={() => onDeleteRecord(record.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

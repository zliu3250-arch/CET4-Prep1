import { ChevronDown, ChevronUp, FileText, Volume2 } from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import type { ListeningSet } from '../../types/cet4';

interface TranscriptCardProps {
  transcript: ListeningSet['transcript'];
  submitted: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  activeSpeechIndex: number | null;
  canClickLineToSpeak: boolean;
  onSpeakLine: (index: number) => void;
}

export function TranscriptCard({
  transcript,
  submitted,
  expanded,
  onToggleExpand,
  activeSpeechIndex,
  canClickLineToSpeak,
  onSpeakLine,
}: TranscriptCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900">听力原文脚本</h3>
          <Badge tone="slate">{transcript.length} 句</Badge>
          {!submitted && <Badge tone="amber">建议交卷后对照</Badge>}
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={onToggleExpand}
          disabled={transcript.length === 0}
          className="text-xs px-3 py-1.5"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              收起原文
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {submitted ? '展开听力原文' : '提前查看原文'}
            </>
          )}
        </Button>
      </div>

      {transcript.length === 0 ? (
        <p className="text-xs text-slate-500">当前听力套题未附带文字脚本。</p>
      ) : !expanded ? (
        <p className="text-xs text-slate-500">
          {submitted
            ? '已交卷，点击右上角「展开听力原文」逐句核对并精听复盘。'
            : '为模拟真实四级考场体验，原文默认收起；交卷后可一键展开对照。'}
        </p>
      ) : (
        <div className="space-y-2 pt-1">
          {canClickLineToSpeak && (
            <p className="text-xs text-slate-500">
              提示：语音朗读模式下，点击任意一句即可从该句开始跟读。
            </p>
          )}
          <div className="space-y-2">
            {transcript.map((line, index) => {
              const isActive = activeSpeechIndex === index;
              return (
                <div
                  key={`${index}-${line.speaker ?? 'line'}`}
                  onClick={() => {
                    if (canClickLineToSpeak) {
                      onSpeakLine(index);
                    }
                  }}
                  role={canClickLineToSpeak ? 'button' : undefined}
                  tabIndex={canClickLineToSpeak ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (canClickLineToSpeak && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSpeakLine(index);
                    }
                  }}
                  className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed transition-colors ${
                    isActive
                      ? 'border-indigo-400 bg-indigo-50 text-slate-900'
                      : 'border-slate-200 bg-slate-50/70 text-slate-700'
                  } ${canClickLineToSpeak ? 'cursor-pointer hover:border-indigo-300' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-xs font-mono text-slate-400 shrink-0 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {line.speaker && (
                          <Badge tone={isActive ? 'indigo' : 'slate'}>{line.speaker}</Badge>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                            <Volume2 className="h-3.5 w-3.5" />
                            正在朗读
                          </span>
                        )}
                      </div>
                      <p className="break-words">{line.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

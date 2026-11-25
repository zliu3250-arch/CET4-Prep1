import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Play,
  Search,
  Trash2,
  Volume2,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../../components/ui';
import type { VocabItem, VocabProgress } from '../../types/cet4';

interface WrongBookViewProps {
  wrongItems: VocabItem[];
  progressMap: Record<string, VocabProgress>;
  speechSupported: boolean;
  speakingWordId: string | null;
  accent: 'en-US' | 'en-GB';
  onSpeak: (item: VocabItem) => void;
  onStartWrongPractice: () => void;
  onStartAllPractice: () => void;
  onRemoveFromWrongBook: (wordId: string) => void;
  onClearAllWrongBook: () => void;
}

export function WrongBookView({
  wrongItems,
  progressMap,
  speechSupported,
  speakingWordId,
  accent,
  onSpeak,
  onStartWrongPractice,
  onStartAllPractice,
  onRemoveFromWrongBook,
  onClearAllWrongBook,
}: WrongBookViewProps) {
  const [keyword, setKeyword] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = q
      ? wrongItems.filter(
          (item) =>
            item.word.toLowerCase().includes(q) ||
            item.meaning.toLowerCase().includes(q) ||
            item.pos.toLowerCase().includes(q),
        )
      : wrongItems;

    return [...list].sort((a, b) => {
      const wrongDiff =
        (progressMap[b.id]?.wrongCount ?? 0) - (progressMap[a.id]?.wrongCount ?? 0);
      if (wrongDiff !== 0) return wrongDiff;
      return a.word.localeCompare(b.word);
    });
  }, [wrongItems, keyword, progressMap]);

  if (wrongItems.length === 0) {
    return (
      <EmptyState
        title="错词本空空如也"
        description="拼写错误的单词会自动收录到这里，连续拼对两次后自动移出。继续保持好状态！"
        action={
          <Button onClick={onStartAllPractice}>
            <Play className="h-4 w-4" />
            去练习全部词库
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                当前共有 <span className="text-rose-600">{wrongItems.length}</span> 个错词待攻克
              </p>
              <p className="text-xs text-slate-500">
                按错误次数降序排列 · 发音口音：{accent === 'en-US' ? '美音 US' : '英音 UK'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onStartWrongPractice}>
              <Play className="h-4 w-4" />
              专项拼写错词本
            </Button>
            {!confirmClear && (
              <Button variant="secondary" onClick={() => setConfirmClear(true)}>
                <Trash2 className="h-4 w-4 text-rose-600" />
                清空错词本
              </Button>
            )}
          </div>
        </div>

        {confirmClear && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>确定要清空全部 {wrongItems.length} 个错词吗？清空后历史拼写统计仍会保留。</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="danger"
                onClick={() => {
                  onClearAllWrongBook();
                  setConfirmClear(false);
                }}
              >
                确认清空
              </Button>
              <Button variant="secondary" onClick={() => setConfirmClear(false)}>
                取消
              </Button>
            </div>
          </div>
        )}

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索错词（支持英文单词或中文释义）..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </div>
      </Card>

      {filteredItems.length === 0 ? (
        <EmptyState
          title="没有匹配的错词"
          description="请尝试换一个关键词搜索。"
          action={
            <Button variant="secondary" onClick={() => setKeyword('')}>
              清除搜索词
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredItems.map((item) => {
            const progress = progressMap[item.id];
            const wrongCount = progress?.wrongCount ?? 1;
            const correctCount = progress?.correctCount ?? 0;
            const isSpeaking = speakingWordId === item.id;

            return (
              <Card key={item.id} className="flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold tracking-tight text-slate-900 break-all">
                          {item.word}
                        </h3>
                        <Badge tone="indigo">{item.pos}</Badge>
                      </div>
                      {item.phonetic && (
                        <p className="mt-0.5 font-mono text-xs text-slate-500">{item.phonetic}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSpeak(item)}
                      disabled={!speechSupported}
                      title={speechSupported ? '播放单词发音' : '当前浏览器不支持语音朗读'}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSpeaking
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                      aria-label={`播放 ${item.word} 发音`}
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-sm font-medium text-slate-800">{item.meaning}</p>

                  {item.example && (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                      <p>{item.example}</p>
                      {item.exampleCn && (
                        <p className="mt-1 text-slate-500">{item.exampleCn}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="rose">错 {wrongCount} 次</Badge>
                    <Badge tone="slate">对 {correctCount} 次</Badge>
                  </div>

                  <Button
                    variant="ghost"
                    className="px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                    onClick={() => onRemoveFromWrongBook(item.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    移出错词本
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

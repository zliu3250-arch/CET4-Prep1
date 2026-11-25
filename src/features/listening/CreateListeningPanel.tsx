import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, FileAudio, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import type { ListeningQuestion, ListeningSet } from '../../types/cet4';

interface DraftQuestion {
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

const createEmptyQuestion = (): DraftQuestion => ({
  stem: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  answer: 'A',
  explanation: '',
});

interface CreateListeningPanelProps {
  onCreate: (newSet: ListeningSet, audioFile: File | null) => Promise<void>;
  onCancel: () => void;
}

export function CreateListeningPanel({ onCreate, onCancel }: CreateListeningPanelProps) {
  const [title, setTitle] = useState('');
  const [section, setSection] = useState<ListeningSet['section']>('长对话');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptRaw, setTranscriptRaw] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([createEmptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAudioSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    if (file.type && !file.type.startsWith('audio/')) {
      setError('请选择有效的音频文件（如 MP3、WAV、M4A、OGG）。');
      return;
    }
    setError(null);
    setAudioFile(file);
  };

  const updateQuestion = <K extends keyof DraftQuestion>(
    idx: number,
    field: K,
    value: DraftQuestion[K],
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('请填写听力练习标题。');
      return;
    }

    const transcriptLines = transcriptRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = /^([A-Za-z\u4e00-\u9fa5]{1,16})\s*[:：]\s*(.+)$/.exec(line);
        if (match) {
          return { speaker: match[1], text: match[2].trim() };
        }
        return { text: line };
      });

    if (!audioFile && transcriptLines.length === 0) {
      setError('请至少上传一个本地音频文件，或输入听力原文脚本（用于语音朗读）。');
      return;
    }

    const builtQuestions: ListeningQuestion[] = [];
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const hasAnyInput = Boolean(
        q.stem.trim() ||
          q.optionA.trim() ||
          q.optionB.trim() ||
          q.optionC.trim() ||
          q.optionD.trim(),
      );
      if (!hasAnyInput) continue;

      const options = [
        { label: 'A', text: q.optionA.trim() || 'Option A' },
        { label: 'B', text: q.optionB.trim() || 'Option B' },
        { label: 'C', text: q.optionC.trim() || 'Option C' },
        { label: 'D', text: q.optionD.trim() || 'Option D' },
      ];

      builtQuestions.push({
        id: `custom-q-${Date.now()}-${i + 1}`,
        number: builtQuestions.length + 1,
        stem: q.stem.trim() || undefined,
        options,
        answer: q.answer,
        explanation: q.explanation.trim(),
      });
    }

    const setId = `l-custom-${Date.now()}`;
    const audioId = audioFile ? `audio_${setId}` : undefined;

    const newSet: ListeningSet = {
      id: setId,
      title: trimmedTitle,
      section,
      audioId,
      transcript: transcriptLines,
      questions: builtQuestions,
    };

    setSubmitting(true);
    try {
      await onCreate(newSet, audioFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建自定义听力练习失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-indigo-200 bg-white space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileAudio className="h-5 w-5 text-indigo-600 shrink-0" />
          <h2 className="text-base font-bold text-slate-900">新建自定义本地音频听力练习</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          aria-label="关闭新建面板"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">套题标题 *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：2024年6月真题 · 新闻报道 Section A"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">题型分类</span>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as ListeningSet['section'])}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="新闻报道">新闻报道</option>
              <option value="长对话">长对话</option>
              <option value="听力篇章">听力篇章</option>
            </select>
          </label>
        </div>

        {/* 本地音频文件选择 */}
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <p className="font-medium text-slate-700">本地音频文件（MP3 / WAV，存本机 IndexedDB）</p>
              <p className="text-xs text-slate-500">
                {audioFile
                  ? `已选择：${audioFile.name}（${(audioFile.size / 1024 / 1024).toFixed(2)} MB）`
                  : '未选择音频时，也可仅填写下方脚本使用浏览器语音朗读'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                <FileAudio className="h-3.5 w-3.5 text-indigo-600" />
                {audioFile ? '重新选择' : '选择音频'}
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,audio/*"
                  onChange={handleAudioSelect}
                  className="hidden"
                />
              </label>
              {audioFile && (
                <button
                  type="button"
                  onClick={() => setAudioFile(null)}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  移除
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 可选原文脚本 */}
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            听力原文脚本（可选，每行一句，支持 <code className="text-xs">Woman: ...</code> 标注说话人）
          </span>
          <textarea
            rows={4}
            value={transcriptRaw}
            onChange={(e) => setTranscriptRaw(e.target.value)}
            placeholder={`Woman: Good morning, everyone.\nMan: Today we will discuss the campus library schedule.`}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>

        {/* 题目编辑区 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">
              配套选择题（可选，留空题目会自动忽略）
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setQuestions((prev) => [...prev, createEmptyQuestion()])}
              className="text-xs px-2.5 py-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              增加一题
            </Button>
          </div>

          {questions.map((q, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">第 {idx + 1} 题</span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                )}
              </div>

              <input
                type="text"
                value={q.stem}
                onChange={(e) => updateQuestion(idx, 'stem', e.target.value)}
                placeholder="题干（可留空，四级听力真题通常仅印选项）"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={q.optionA}
                  onChange={(e) => updateQuestion(idx, 'optionA', e.target.value)}
                  placeholder="选项 A"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={q.optionB}
                  onChange={(e) => updateQuestion(idx, 'optionB', e.target.value)}
                  placeholder="选项 B"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={q.optionC}
                  onChange={(e) => updateQuestion(idx, 'optionC', e.target.value)}
                  placeholder="选项 C"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={q.optionD}
                  onChange={(e) => updateQuestion(idx, 'optionD', e.target.value)}
                  placeholder="选项 D"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <span className="shrink-0 font-medium">正确答案</span>
                  <select
                    value={q.answer}
                    onChange={(e) =>
                      updateQuestion(idx, 'answer', e.target.value as 'A' | 'B' | 'C' | 'D')
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </label>
                <input
                  type="text"
                  value={q.explanation}
                  onChange={(e) => updateQuestion(idx, 'explanation', e.target.value)}
                  placeholder="解析说明（可选）"
                  className="sm:col-span-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            取消
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            保存并开始练习
          </Button>
        </div>
      </form>
    </Card>
  );
}

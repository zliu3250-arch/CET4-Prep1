import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileAudio, Headphones, Loader2, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui';
import { stopSpeaking } from '../../services/speech';
import {
  appendPracticeLog,
  deleteAudioBlob,
  getListeningSets,
  importListeningSets,
  saveAudioBlob,
} from '../../services/storage';
import type { ListeningSet } from '../../types/cet4';
import { AudioPlayerCard } from './AudioPlayerCard';
import { CreateListeningPanel } from './CreateListeningPanel';
import { QuestionList } from './QuestionList';
import { TranscriptCard } from './TranscriptCard';
import {
  SECTION_FILTERS,
  type ListeningSectionFilter,
  type NoticeMessage,
} from './types';

interface ScoreSummary {
  correctCount: number;
  total: number;
  accuracy: number;
  durationSeconds: number;
}

export default function ListeningPage() {
  const [sets, setSets] = useState<ListeningSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState<ListeningSectionFilter>('全部');
  const [activeSetId, setActiveSetId] = useState<string>('');

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  const [activeSpeechIndex, setActiveSpeechIndex] = useState<number | null>(null);
  const [speechTrigger, setSpeechTrigger] = useState<{ index: number; nonce: number } | null>(
    null,
  );

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [playerNotice, setPlayerNotice] = useState<NoticeMessage | null>(null);

  const startedAtRef = useRef<number>(Date.now());

  const loadListeningSets = useCallback(async (preferredId?: string) => {
    setLoading(true);
    try {
      const data = await getListeningSets();
      setSets(data);
      setActiveSetId((prev) => {
        if (preferredId && data.some((item) => item.id === preferredId)) {
          return preferredId;
        }
        if (prev && data.some((item) => item.id === prev)) {
          return prev;
        }
        return data[0]?.id ?? '';
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListeningSets();
    return () => {
      stopSpeaking();
    };
  }, [loadListeningSets]);

  const filteredSets = useMemo(() => {
    if (sectionFilter === '全部') return sets;
    return sets.filter((item) => item.section === sectionFilter);
  }, [sectionFilter, sets]);

  const resetPracticeState = useCallback(() => {
    setAnswers({});
    setSubmitted(false);
    setScoreSummary(null);
    setTranscriptExpanded(false);
    setActiveSpeechIndex(null);
    setSpeechTrigger(null);
    startedAtRef.current = Date.now();
  }, []);

  // 切换题型筛选后，如果当前选中套题不在列表中，自动切到该分类第一套并重置作答状态
  useEffect(() => {
    if (filteredSets.length === 0) return;
    if (!filteredSets.some((item) => item.id === activeSetId)) {
      stopSpeaking();
      setActiveSetId(filteredSets[0].id);
      setPlayerNotice(null);
      resetPracticeState();
    }
  }, [activeSetId, filteredSets, resetPracticeState]);

  const activeSet = useMemo(
    () => filteredSets.find((item) => item.id === activeSetId) ?? null,
    [activeSetId, filteredSets],
  );

  const handleSelectSet = (setId: string) => {
    if (setId === activeSetId) return;
    stopSpeaking();
    setActiveSetId(setId);
    setPlayerNotice(null);
    resetPracticeState();
  };

  const handleSelectAnswer = (questionId: string, optionLabel: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionLabel }));
  };

  const handleSubmit = () => {
    if (!activeSet || submitted) return;
    const total = activeSet.questions.length;
    if (total === 0) return;

    let correctCount = 0;
    for (const q of activeSet.questions) {
      if (answers[q.id] === q.answer) {
        correctCount += 1;
      }
    }

    const accuracy = Math.round((correctCount / total) * 100);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));

    setScoreSummary({ correctCount, total, accuracy, durationSeconds });
    setSubmitted(true);

    try {
      appendPracticeLog({
        module: 'listening',
        title: activeSet.title,
        score: correctCount,
        maxScore: total,
        accuracy,
        durationSeconds,
        detail: `${activeSet.section} · 答对 ${correctCount}/${total} 题`,
      });
    } catch (err) {
      setPlayerNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '保存练习记录失败，请检查浏览器存储空间。',
      });
    }
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
    setScoreSummary(null);
    setTranscriptExpanded(false);
    startedAtRef.current = Date.now();
  };

  const handleUploadAudioForActiveSet = async (file: File) => {
    if (!activeSet) return;
    if (file.type && !file.type.startsWith('audio/')) {
      setPlayerNotice({
        type: 'err',
        text: '请选择音频文件（支持 MP3、WAV、M4A、OGG 等浏览器可播放格式）。',
      });
      return;
    }

    setUploadingAudio(true);
    setPlayerNotice(null);

    const newAudioId = `audio_${activeSet.id}_${Date.now()}`;
    const prevAudioId = activeSet.audioId;

    try {
      await saveAudioBlob(newAudioId, file);
      const updatedSet: ListeningSet = {
        ...activeSet,
        audioId: newAudioId,
      };
      await importListeningSets([updatedSet]);
      if (prevAudioId && prevAudioId !== newAudioId) {
        await deleteAudioBlob(prevAudioId).catch(() => {});
      }
      await loadListeningSets(updatedSet.id);
      setPlayerNotice({
        type: 'ok',
        text: `已绑定本地音频「${file.name}」（仅存本机 IndexedDB），现在可使用倍速与 -5s 播放控制。`,
      });
    } catch (err) {
      setPlayerNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '保存本地音频失败，请检查文件大小或存储空间。',
      });
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleRemoveAudioForActiveSet = async () => {
    if (!activeSet || !activeSet.audioId) return;
    setUploadingAudio(true);
    setPlayerNotice(null);

    const prevAudioId = activeSet.audioId;
    try {
      const updatedSet: ListeningSet = {
        id: activeSet.id,
        title: activeSet.title,
        section: activeSet.section,
        transcript: activeSet.transcript,
        questions: activeSet.questions,
      };
      await importListeningSets([updatedSet]);
      await deleteAudioBlob(prevAudioId).catch(() => {});
      await loadListeningSets(updatedSet.id);
      setPlayerNotice({
        type: 'ok',
        text: '已解绑本地音频并释放本地空间，当前已切换回语音朗读模式。',
      });
    } catch (err) {
      setPlayerNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '解绑本地音频失败，请重试。',
      });
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleCreateCustomSet = async (newSet: ListeningSet, audioFile: File | null) => {
    if (audioFile && newSet.audioId) {
      await saveAudioBlob(newSet.audioId, audioFile);
    }
    await importListeningSets([newSet]);
    setSectionFilter('全部');
    await loadListeningSets(newSet.id);
    resetPracticeState();
    setShowCreatePanel(false);
    setPlayerNotice({
      type: 'ok',
      text: audioFile
        ? `已创建「${newSet.title}」并绑定本地音频「${audioFile.name}」。`
        : `已创建自定义听力练习「${newSet.title}」。`,
    });
  };

  const handleSpeakLine = (index: number) => {
    setSpeechTrigger((prev) => ({ index, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  return (
    <div className="space-y-5 min-w-0">
      <SectionHeader
        title="听力训练"
        subtitle="支持本地 MP3/WAV 倍速回退播放与 Web Speech API 逐句朗读，交卷自动判分并对照原文"
        action={
          <Button
            type="button"
            variant={showCreatePanel ? 'secondary' : 'primary'}
            onClick={() => setShowCreatePanel((prev) => !prev)}
          >
            <Plus className="h-4 w-4" />
            {showCreatePanel ? '收起新建' : '新建本地音频练习'}
          </Button>
        }
      />

      {/* 新建自定义听力练习面板 */}
      {showCreatePanel && (
        <CreateListeningPanel
          onCreate={handleCreateCustomSet}
          onCancel={() => setShowCreatePanel(false)}
        />
      )}

      {/* 题型筛选与套题选择 */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {SECTION_FILTERS.map((sec) => {
              const count =
                sec === '全部' ? sets.length : sets.filter((s) => s.section === sec).length;
              const active = sectionFilter === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSectionFilter(sec)}
                  className={`rounded-xl px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sec}
                  <span
                    className={`ml-1.5 text-xs ${
                      active ? 'text-indigo-100' : 'text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <span className="text-xs text-slate-500">共 {filteredSets.length} 套可选</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-slate-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            正在加载听力题库…
          </div>
        ) : filteredSets.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSets.map((item) => {
              const isSelected = item.id === activeSet?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSet(item.id)}
                  className={`rounded-xl border p-3 text-left transition-colors cursor-pointer min-w-0 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 line-clamp-2 break-words">
                      {item.title}
                    </span>
                    {item.audioId ? (
                      <FileAudio className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <Headphones className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={isSelected ? 'indigo' : 'slate'}>{item.section}</Badge>
                    <Badge tone="slate">{item.questions.length} 题</Badge>
                    {item.audioId && <Badge tone="emerald">已绑音频</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </Card>

      {/* 主训练区 */}
      {!loading && !activeSet ? (
        <EmptyState
          title={`「${sectionFilter}」分类下暂无听力套题`}
          description="你可以切换回「全部」查看内置示例题，或点击右上角「新建本地音频练习」导入自己的四级真题音频。"
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {sectionFilter !== '全部' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSectionFilter('全部')}
                >
                  查看全部套题
                </Button>
              )}
              <Button type="button" onClick={() => setShowCreatePanel(true)}>
                <Plus className="h-4 w-4" />
                新建本地音频练习
              </Button>
            </div>
          }
        />
      ) : activeSet ? (
        <div className="space-y-4 min-w-0">
          <AudioPlayerCard
            listeningSet={activeSet}
            activeSpeechIndex={activeSpeechIndex}
            onActiveSpeechIndexChange={setActiveSpeechIndex}
            speechTrigger={speechTrigger}
            onUploadAudio={handleUploadAudioForActiveSet}
            onRemoveAudio={handleRemoveAudioForActiveSet}
            uploading={uploadingAudio}
            notice={playerNotice}
          />

          <QuestionList
            questions={activeSet.questions}
            answers={answers}
            submitted={submitted}
            scoreSummary={scoreSummary}
            onSelectAnswer={handleSelectAnswer}
            onSubmit={handleSubmit}
            onReset={handleReset}
          />

          <TranscriptCard
            transcript={activeSet.transcript}
            submitted={submitted}
            expanded={transcriptExpanded}
            onToggleExpand={() => setTranscriptExpanded((prev) => !prev)}
            activeSpeechIndex={activeSpeechIndex}
            canClickLineToSpeak={!activeSet.audioId}
            onSpeakLine={handleSpeakLine}
          />
        </div>
      ) : null}
    </div>
  );
}

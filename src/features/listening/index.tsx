import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui';
import { QuestionPickerBar, sortByNewestFirst } from '../../components/ui/QuestionPickerBar';
import { stopSpeaking } from '../../services/speech';
import {
  appendPracticeLog,
  deleteAudioBlob,
  getListeningSets,
  getScopedStorageKey,
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

const LISTENING_DRAFT_KEY = 'cet4_listening_draft_v1';

function readListeningDraft(setId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(LISTENING_DRAFT_KEY));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { setId?: string; answers?: Record<string, string> };
    return parsed.setId === setId && parsed.answers ? parsed.answers : {};
  } catch {
    return {};
  }
}

function saveListeningDraft(setId: string, answers: Record<string, string>): void {
  try {
    if (Object.keys(answers).length === 0) {
      window.localStorage.removeItem(getScopedStorageKey(LISTENING_DRAFT_KEY));
      return;
    }
    window.localStorage.setItem(
      getScopedStorageKey(LISTENING_DRAFT_KEY),
      JSON.stringify({ setId, answers }),
    );
  } catch {
    // ignore
  }
}

function clearListeningDraft(): void {
  try {
    window.localStorage.removeItem(getScopedStorageKey(LISTENING_DRAFT_KEY));
  } catch {
    // ignore
  }
}

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
      const raw = await getListeningSets();
      const data = sortByNewestFirst(raw);
      setSets(data);
      let resolvedId = '';
      setActiveSetId((prev) => {
        if (preferredId && data.some((item) => item.id === preferredId)) {
          resolvedId = preferredId;
          return preferredId;
        }
        if (prev && data.some((item) => item.id === prev)) {
          resolvedId = prev;
          return prev;
        }
        resolvedId = data[0]?.id ?? '';
        return resolvedId;
      });
      if (resolvedId) {
        const restored = readListeningDraft(resolvedId);
        if (Object.keys(restored).length > 0) {
          setAnswers(restored);
        }
      }
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
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const scrollTopNow = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    if (setId === activeSetId) {
      scrollTopNow();
      return;
    }
    if (
      !submitted &&
      Object.keys(answers).length > 0 &&
      !window.confirm('当前听力套题还有未交卷的作答，切换套题将清空已选答案，确认切换吗？')
    ) {
      return;
    }
    stopSpeaking();
    clearListeningDraft();
    setActiveSetId(setId);
    setPlayerNotice(null);
    resetPracticeState();
    scrollTopNow();
    window.requestAnimationFrame(scrollTopNow);
  };

  const handleSelectAnswer = (questionId: string, optionLabel: string) => {
    if (submitted) return;
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionLabel };
      if (activeSetId) saveListeningDraft(activeSetId, next);
      return next;
    });
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
    clearListeningDraft();

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
    clearListeningDraft();
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

      {/* 顶部紧凑选题栏：默认最新真题 + 右侧下拉键展开全部套题（按时间从新到旧） */}
      {!loading && sets.length > 0 && (
        <QuestionPickerBar
          label="当前听力真题"
          currentTitle={activeSet?.title ?? '请选择听力套题'}
          currentBadge={activeSet?.section}
          totalCount={sets.length}
          filterTabs={SECTION_FILTERS.map((sec) => ({
            key: sec,
            label: sec,
            count: sec === '全部' ? sets.length : sets.filter((s) => s.section === sec).length,
          }))}
          activeFilter={sectionFilter}
          onFilterChange={(key) => setSectionFilter(key as ListeningSectionFilter)}
          items={filteredSets.map((item) => ({
            id: item.id,
            title: item.title,
            badge: item.section,
            meta: `${item.questions.length} 题`,
            extra: item.audioId ? <Badge tone="emerald">已绑本地音频</Badge> : undefined,
          }))}
          activeId={activeSet?.id ?? ''}
          onSelect={handleSelectSet}
        />
      )}

      {/* 主训练区（默认展示最新真题，置顶直接听题作答） */}
      {loading ? (
        <Card className="flex items-center justify-center py-10 text-sm text-slate-500 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          正在加载听力题库…
        </Card>
      ) : !activeSet ? (
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
      ) : (
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
      )}
    </div>
  );
}

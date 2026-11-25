import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  AlertCircle,
  FileAudio,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import { useAudioObjectUrl } from '../../hooks/useAudioObjectUrl';
import { isSpeechSupported, speakText, stopSpeaking } from '../../services/speech';
import type { ListeningSet } from '../../types/cet4';
import {
  PLAYBACK_RATES,
  formatAudioTime,
  type NoticeMessage,
  type PlaybackRate,
} from './types';

interface AudioPlayerCardProps {
  listeningSet: ListeningSet;
  activeSpeechIndex: number | null;
  onActiveSpeechIndexChange: (index: number | null) => void;
  speechTrigger: { index: number; nonce: number } | null;
  onUploadAudio: (file: File) => Promise<void>;
  onRemoveAudio: () => Promise<void>;
  uploading: boolean;
  notice: NoticeMessage | null;
}

export function AudioPlayerCard({
  listeningSet,
  activeSpeechIndex,
  onActiveSpeechIndexChange,
  speechTrigger,
  onUploadAudio,
  onRemoveAudio,
  uploading,
  notice,
}: AudioPlayerCardProps) {
  const { url: audioUrl, loading: audioLoading, error: audioError } = useAudioObjectUrl(
    listeningSet.audioId,
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rate, setRate] = useState<PlaybackRate>(1.0);

  // 本地音频播放状态
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioPlayError, setAudioPlayError] = useState<string | null>(null);

  // Web Speech API 朗读状态
  const [speechPlaying, setSpeechPlaying] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechSessionRef = useRef(0);
  const speechSupported = isSpeechSupported();

  const hasLocalAudio = Boolean(listeningSet.audioId && audioUrl && !audioError);
  const transcript = listeningSet.transcript;

  const stopSpeechPlayback = useCallback(() => {
    speechSessionRef.current += 1;
    stopSpeaking();
    setSpeechPlaying(false);
    onActiveSpeechIndexChange(null);
  }, [onActiveSpeechIndexChange]);

  // 切换套题或组件卸载时，停止一切播放并重置状态
  useEffect(() => {
    setAudioPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioPlayError(null);
    setSpeechError(null);
    stopSpeechPlayback();

    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }

    return () => {
      speechSessionRef.current += 1;
      stopSpeaking();
    };
  }, [listeningSet.id, listeningSet.audioId, stopSpeechPlayback]);

  // 同步倍速到 <audio>
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, [rate, audioUrl]);

  // Web Speech API 逐句朗读
  const speakFromIndex = useCallback(
    (startIndex: number, playbackRate: PlaybackRate) => {
      if (!speechSupported) {
        setSpeechError('当前浏览器不支持 Web Speech API 语音朗读，请上传本地 MP3/WAV 音频播放。');
        return;
      }
      if (transcript.length === 0) {
        setSpeechError('当前套题暂无可朗读的听力原文脚本，请上传本地 MP3/WAV 音频。');
        return;
      }

      const safeIndex = Math.max(0, Math.min(startIndex, transcript.length - 1));
      const sessionId = speechSessionRef.current + 1;
      speechSessionRef.current = sessionId;
      setSpeechError(null);
      setSpeechPlaying(true);

      const playLine = (idx: number) => {
        if (speechSessionRef.current !== sessionId) return;
        if (idx >= transcript.length) {
          setSpeechPlaying(false);
          onActiveSpeechIndexChange(null);
          return;
        }

        onActiveSpeechIndexChange(idx);
        const line = transcript[idx];
        speakText(line.text, {
          lang: 'en-US',
          rate: playbackRate,
          onEnd: () => {
            if (speechSessionRef.current !== sessionId) return;
            playLine(idx + 1);
          },
          onError: (msg) => {
            if (speechSessionRef.current !== sessionId) return;
            setSpeechError(msg);
            setSpeechPlaying(false);
            onActiveSpeechIndexChange(null);
          },
        });
      };

      playLine(safeIndex);
    },
    [onActiveSpeechIndexChange, speechSupported, transcript],
  );

  // 支持从原文脚本点击某一句直接跳转朗读
  useEffect(() => {
    if (!speechTrigger || hasLocalAudio) return;
    speakFromIndex(speechTrigger.index, rate);
  }, [speechTrigger, hasLocalAudio, rate, speakFromIndex]);

  const handleToggleAudio = async () => {
    const el = audioRef.current;
    if (!el) return;
    setAudioPlayError(null);

    if (el.paused) {
      try {
        el.playbackRate = rate;
        await el.play();
        setAudioPlaying(true);
      } catch {
        setAudioPlayError('音频播放失败，请检查音频格式是否受浏览器支持（推荐 MP3/WAV）。');
        setAudioPlaying(false);
      }
    } else {
      el.pause();
      setAudioPlaying(false);
    }
  };

  const handleRewind5s = () => {
    const el = audioRef.current;
    if (!el) return;
    const nextTime = Math.max(0, el.currentTime - 5);
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    const nextTime = Number(e.target.value);
    if (!el || !Number.isFinite(nextTime)) return;
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleRateChange = (nextRate: PlaybackRate) => {
    setRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
    if (!hasLocalAudio && speechPlaying) {
      const resumeIdx = activeSpeechIndex ?? 0;
      speakFromIndex(resumeIdx, nextRate);
    }
  };

  const handleToggleSpeech = () => {
    if (speechPlaying) {
      stopSpeechPlayback();
    } else {
      speakFromIndex(activeSpeechIndex ?? 0, rate);
    }
  };

  const handleSpeechStep = (delta: -1 | 1) => {
    if (transcript.length === 0) return;
    const base = activeSpeechIndex ?? 0;
    const next = Math.max(0, Math.min(transcript.length - 1, base + delta));
    speakFromIndex(next, rate);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stopSpeechPlayback();
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
    }
    await onUploadAudio(file);
  };

  const currentLine =
    activeSpeechIndex !== null && transcript[activeSpeechIndex]
      ? transcript[activeSpeechIndex]
      : null;

  return (
    <Card className="space-y-4">
      {/* 顶部信息与上传操作 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            {hasLocalAudio ? (
              <FileAudio className="h-5 w-5" />
            ) : (
              <Headphones className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 break-words">
                {listeningSet.title}
              </h2>
              <Badge tone="indigo">{listeningSet.section}</Badge>
              {hasLocalAudio ? (
                <Badge tone="emerald">本地音频模式</Badge>
              ) : (
                <Badge tone="amber">语音朗读模式</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {hasLocalAudio
                ? '正在使用本地上传的音频文件播放（安全存储于 IndexedDB）'
                : '未绑定本地音频，已自动降级为浏览器 Web Speech API 逐句朗读'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-xs px-3 py-1.5"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {listeningSet.audioId ? '更换本地音频' : '上传本地 MP3/WAV'}
          </Button>
          {listeningSet.audioId && (
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={onRemoveAudio}
              className="text-xs px-2.5 py-1.5 text-rose-600 hover:bg-rose-50"
              title="解绑本地音频并切回语音朗读"
            >
              <Trash2 className="h-3.5 w-3.5" />
              解绑音频
            </Button>
          )}
        </div>
      </div>

      {/* 上传/操作提示 */}
      {notice && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs flex items-start gap-2 ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-words">{notice.text}</span>
        </div>
      )}

      {/* 本地音频加载中或读取报错 */}
      {listeningSet.audioId && audioLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          正在从本地浏览器存储加载音频文件…
        </div>
      )}

      {listeningSet.audioId && audioError && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{audioError}</p>
            {transcript.length > 0 && (
              <p className="text-amber-700">你可点击上方「更换本地音频」重新导入，或直接使用下方语音朗读模式。</p>
            )}
          </div>
        </div>
      )}

      {/* 模式 A：本地真实音频控制条 */}
      {hasLocalAudio && audioUrl ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              setDuration(Number.isFinite(el.duration) ? el.duration : 0);
              el.playbackRate = rate;
            }}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onEnded={() => {
              setAudioPlaying(false);
            }}
            onError={() => {
              setAudioPlaying(false);
              setAudioPlayError('无法解码该本地音频，请尝试重新上传标准 MP3 或 WAV 文件。');
            }}
          />

          {/* 进度条 + 时间 */}
          <div className="space-y-1.5">
            <input
              type="range"
              aria-label="音频播放进度"
              min={0}
              max={duration > 0 ? duration : 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={handleSeek}
              disabled={duration <= 0}
              className="w-full accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 tabular-nums">
              <span>{formatAudioTime(currentTime)}</span>
              <span>{formatAudioTime(duration)}</span>
            </div>
          </div>

          {/* 播放、后退 5 秒、倍速 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleToggleAudio}
                className="min-w-[92px]"
              >
                {audioPlaying ? (
                  <>
                    <Pause className="h-4 w-4" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    播放
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRewind5s}
                title="后退 5 秒"
              >
                <RotateCcw className="h-4 w-4" />
                -5s
              </Button>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
              {PLAYBACK_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRateChange(r)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    rate === r
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {r.toFixed(r === 1 ? 1 : r === 0.8 ? 1 : 2)}x
                </button>
              ))}
            </div>
          </div>

          {audioPlayError && (
            <p className="text-xs text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {audioPlayError}
            </p>
          )}
        </div>
      ) : (
        /* 模式 B：Web Speech API 备用逐句朗读控制条 */
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handleToggleSpeech}
                disabled={!speechSupported || transcript.length === 0}
                className="min-w-[104px]"
              >
                {speechPlaying ? (
                  <>
                    <Square className="h-3.5 w-3.5" />
                    停止朗读
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4" />
                    {activeSpeechIndex !== null ? '继续朗读' : '朗读听力'}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={!speechSupported || transcript.length === 0}
                onClick={() => handleSpeechStep(-1)}
                title="上一句"
                className="px-2.5"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!speechSupported || transcript.length === 0}
                onClick={() => handleSpeechStep(1)}
                title="下一句"
                className="px-2.5"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
              {PLAYBACK_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRateChange(r)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    rate === r
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {r.toFixed(r === 1 ? 1 : r === 0.8 ? 1 : 2)}x
                </button>
              ))}
            </div>
          </div>

          {/* 朗读进度条与当前句状态 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  speechPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}
              />
              {speechPlaying && activeSpeechIndex !== null ? (
                <span>
                  正在朗读第 <strong>{activeSpeechIndex + 1}</strong> / {transcript.length} 句
                  {currentLine?.speaker ? `（${currentLine.speaker}）` : ''}
                </span>
              ) : transcript.length > 0 ? (
                <span>共 {transcript.length} 句脚本，点击「朗读听力」开始逐句播报</span>
              ) : (
                <span>暂无脚本，请点击右上角上传本地 MP3/WAV 音频</span>
              )}
            </div>
            {transcript.length > 0 && (
              <span className="font-mono text-slate-500 tabular-nums">
                {activeSpeechIndex !== null ? activeSpeechIndex + 1 : 0} / {transcript.length}
              </span>
            )}
          </div>

          {!speechSupported && (
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              当前浏览器不支持 Web Speech API，请上传本地 MP3/WAV 文件进行听力训练。
            </p>
          )}

          {speechError && (
            <p className="text-xs text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {speechError}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

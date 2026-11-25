import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Loader2, Pause, Play, Radio, RotateCcw } from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import type { ListeningSet } from '../../types/cet4';

const RATES = [0.8, 1.0, 1.25] as const;

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MockAudioPlayer({ listening }: { listening: ListeningSet }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const url = listening.audioUrl;
  const pieces = listening.audioPieces ?? [];

  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);

    const el = audioRef.current;
    if (!el || !url) return;

    if (url.includes('.m3u8') && Hls.isSupported()) {
      setLoading(true);
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        el.playbackRate = rate;
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setLoading(false);
          setPlaying(false);
          setError('真题在线音频加载失败，请确认网络连接正常。');
        }
      });
      return () => {
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      };
    }

    el.src = url;
    el.load();
    return undefined;
  }, [listening.id, url]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    setError(null);
    if (el.paused) {
      try {
        el.playbackRate = rate;
        await el.play();
        setPlaying(true);
      } catch {
        setError('浏览器拦截了音频播放，请再点击一次播放按钮。');
      }
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const rewind5 = () => {
    const el = audioRef.current;
    if (!el) return;
    const t = Math.max(0, el.currentTime - 5);
    el.currentTime = t;
    setCurrentTime(t);
  };

  const seek = (e: ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    const t = Number(e.target.value);
    if (!el || !Number.isFinite(t)) return;
    el.currentTime = t;
    setCurrentTime(t);
  };

  const changeRate = (r: number) => {
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };

  const jumpTo = async (start: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = start;
    setCurrentTime(start);
    if (el.paused) {
      try {
        el.playbackRate = rate;
        await el.play();
        setPlaying(true);
      } catch {
        // ignore autoplay block
      }
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-bold text-slate-900">真题听力原声播放器</span>
          <Badge tone="emerald">原声音频</Badge>
        </div>
        {loading && (
          <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            缓冲音频中...
          </span>
        )}
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration)) setDuration(el.duration);
          el.playbackRate = rate;
        }}
        onDurationChange={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
      />

      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={seek}
          disabled={duration <= 0}
          className="w-full accent-indigo-600 cursor-pointer"
        />
        <div className="flex justify-between font-mono text-xs text-slate-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => void togglePlay()} className="min-w-[88px]">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? '暂停' : '播放'}
          </Button>
          <Button type="button" variant="secondary" onClick={rewind5}>
            <RotateCcw className="h-4 w-4" />
            -5s
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changeRate(r)}
              className={`rounded-lg px-2 py-1 text-xs font-medium cursor-pointer ${
                rate === r ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-white'
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
      </div>

      {pieces.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
          {pieces.map((p) => {
            const active = currentTime >= p.start && currentTime < p.end;
            return (
              <button
                key={`${p.label}-${p.start}`}
                type="button"
                onClick={() => void jumpTo(p.start)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </Card>
  );
}

import type { ListeningSet } from '../../types/cet4';

export type PlaybackRate = 0.8 | 1.0 | 1.25;

export const PLAYBACK_RATES: readonly PlaybackRate[] = [0.8, 1.0, 1.25];

export type ListeningSectionFilter = '全部' | ListeningSet['section'];

export const SECTION_FILTERS: readonly ListeningSectionFilter[] = [
  '全部',
  '新闻报道',
  '长对话',
  '听力篇章',
];

export interface NoticeMessage {
  type: 'ok' | 'err';
  text: string;
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

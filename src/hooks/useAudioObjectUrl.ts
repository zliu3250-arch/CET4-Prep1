import { useEffect, useState } from 'react';
import { getAudioBlob } from '../services/storage';

/**
 * 安全读取 IndexedDB 中的音频 Blob 并创建临时 Object URL。
 * 组件卸载、切换 audioId 或发生错误时自动 revokeObjectURL，避免内存泄漏。
 */
export function useAudioObjectUrl(audioId?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioId) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    setLoading(true);
    setError(null);

    getAudioBlob(audioId)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setUrl(null);
          setError('未在本地存储中找到该音频文件，可能已被浏览器清理，请重新导入。');
          return;
        }
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null);
          setError('读取本地音频失败，请重试或改用语音朗读模式。');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [audioId]);

  return { url, loading, error };
}

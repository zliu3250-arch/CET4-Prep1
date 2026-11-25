/**
 * 浏览器 Web Speech API 朗读封装
 * 用于单词发音与无本地 MP3 时的听力备用朗读。
 */

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SpeakOptions {
  lang?: 'en-US' | 'en-GB';
  rate?: number;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(text: string, options: SpeakOptions = {}): void {
  if (!isSpeechSupported()) {
    options.onError?.('当前浏览器不支持语音朗读（Web Speech API）。');
    return;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    options.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = options.lang ?? 'en-US';
  utterance.rate = options.rate ?? 1.0;

  utterance.onend = () => {
    options.onEnd?.();
  };

  utterance.onerror = (event) => {
    if (event.error === 'interrupted' || event.error === 'canceled') {
      return;
    }
    options.onError?.(`语音播放失败：${event.error}`);
  };

  window.speechSynthesis.speak(utterance);
}

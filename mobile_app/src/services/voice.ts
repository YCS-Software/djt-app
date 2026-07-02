/**
 * voice — turn-by-turn speech that works in the BUILT app, not just the browser.
 *
 * The Android WebView's window.speechSynthesis is unreliable (often no voices /
 * silent), which is why voice "works locally but not after building". On native
 * we use the device text-to-speech engine via @capacitor-community/text-to-speech
 * (no permission required); on the web we fall back to speechSynthesis.
 */
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

let enabled = true;

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  if (!on) void stopSpeaking();
}

export async function speakText(text: string, lang = 'en-IN'): Promise<void> {
  if (!enabled || !text) return;

  if (Capacitor.isNativePlatform()) {
    try {
      await TextToSpeech.stop().catch(() => {});
      await TextToSpeech.speak({
        text,
        lang,
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
      return;
    } catch {
      /* fall through to the web engine */
    }
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.lang = lang;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }
}

export async function stopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try { await TextToSpeech.stop(); return; } catch { /* ignore */ }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Safe Text-to-Speech (TTS) engine optimized for elderly listeners
import { SPEECHMATICS_VOICE_OPTIONS, Language } from '../types';
import { speechLocaleFor } from '../locales/translations';

// Voice IDs currently supported by the Speechmatics TTS preview API
const VALID_TTS_VOICE_IDS = new Set(SPEECHMATICS_VOICE_OPTIONS.map((v) => v.id));

let currentAudioElement: HTMLAudioElement | null = null;

// Helper: Strip markdown formatting, emojis, URLs, and asterisks for smooth TTS audio
export function cleanSpeakableText(text: string): string {
  if (!text) return '';
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\*\_~`#>\[\]\(\)]/g, ' ')
    .replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function speakSpeechmaticsOrFallback(
  text: string, 
  voice: string = 'sarah', 
  onEnd?: () => void,
  rate: number = 0.9,
  language: Language = 'en'
): Promise<void> {
  stopSpeaking();

  const sanitized = cleanSpeakableText(text);
  if (!sanitized) {
    if (onEnd) onEnd();
    return;
  }

  // Speechmatics TTS preview only synthesizes English. For Mandarin, Malay,
  // and Tamil readouts we route straight to native Web Speech synthesis with
  // the matching locale so elders hear their own language, not English TTS.
  if (language !== 'en') {
    speakText(sanitized, onEnd, speechLocaleFor(language));
    return;
  }

  try {
    // Guard against stale/invalid persisted voice IDs so we never hit an
    // unknown Speechmatics voice (which would silently fall back to Web Speech).
    const safeVoice = VALID_TTS_VOICE_IDS.has(voice) ? voice : 'sarah';

    const res = await fetch('/api/speechmatics/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sanitized, voice: safeVoice }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      currentAudioElement = audio;

      if (rate && rate > 0.5 && rate <= 2.0) {
        try {
          audio.playbackRate = rate;
        } catch (e) {}
      }

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
        // Fallback to Web Speech API
        speakText(sanitized, onEnd);
      };

      await audio.play();
      return;
    } else {
      const errBody = await res.text().catch(() => '');
      console.warn(`Speechmatics TTS returned ${res.status} for voice "${safeVoice}":`, errBody);
    }
  } catch (err) {
    console.warn('Speechmatics TTS unavailable, falling back to Web Speech synthesis:', err);
  }

  // Fallback to native Web Speech
  speakText(sanitized, onEnd);
}

export function speakText(text: string, onEnd?: () => void, locale: string = 'en-SG'): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported on this device.');
    if (onEnd) onEnd();
    return false;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = 0.88; // Slower, clearer cadence for older ears
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick a natural sounding voice matching the target locale if available
    const langPrefix = locale.split('-')[0].toLowerCase();
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => (v.lang.toLowerCase().startsWith(langPrefix) && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Premium')))
    ) || voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('Speech utterance error:', e);
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('TTS error:', err);
    if (onEnd) onEnd();
    return false;
  }
}

export function stopSpeaking(): void {
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch (e) {}
    currentAudioElement = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export interface SpeechRecognitionController {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function initSpeechRecognition(
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
): SpeechRecognitionController | null {
  if (!isSpeechRecognitionSupported()) return null;

  try {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) {
        onResult(final.trim(), true);
      } else if (interim) {
        onResult(interim.trim(), false);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      onError(event.error || 'Voice input error');
    };

    recognition.onend = () => {
      onEnd();
    };

    return {
      start: () => {
        try {
          recognition.start();
        } catch (e) {
          console.warn('Recognition start exception:', e);
        }
      },
      stop: () => {
        try {
          recognition.stop();
        } catch (e) {}
      },
      abort: () => {
        try {
          recognition.abort();
        } catch (e) {}
      },
    };
  } catch (e) {
    console.error('Failed to initialize speech recognition:', e);
    return null;
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Safe Text-to-Speech (TTS) engine optimized for elderly listeners
let currentAudioElement: HTMLAudioElement | null = null;

export async function speakSpeechmaticsOrFallback(
  text: string, 
  voice: string = 'sarah', 
  onEnd?: () => void
): Promise<void> {
  stopSpeaking();

  try {
    const res = await fetch('/api/speechmatics/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      currentAudioElement = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioElement = null;
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioElement = null;
        // Fallback to Web Speech API
        speakText(text, onEnd);
      };

      await audio.play();
      return;
    }
  } catch (err) {
    console.warn('Speechmatics TTS unavailable, falling back to Web Speech synthesis:', err);
  }

  // Fallback to native Web Speech
  speakText(text, onEnd);
}

export function speakText(text: string, onEnd?: () => void): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported on this device.');
    if (onEnd) onEnd();
    return false;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88; // Slower, clearer cadence for older ears
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick a natural sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => (v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Premium')))
    ) || voices.find((v) => v.lang.startsWith('en'));

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

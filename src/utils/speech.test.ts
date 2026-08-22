/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanSpeakableText, speakSpeechmaticsOrFallback } from './speech';

describe('cleanSpeakableText', () => {
  it('returns empty string for empty input', () => {
    expect(cleanSpeakableText('')).toBe('');
  });

  it('strips URLs so TTS never reads raw links', () => {
    const result = cleanSpeakableText('Go to https://maps.google.com/x?q=1 now');
    expect(result).not.toContain('https');
    expect(result).toBe('Go to now');
  });

  it('strips markdown syntax characters', () => {
    const result = cleanSpeakableText('**Bold** address _with_ [brackets](link)');
    expect(result).not.toMatch(/[\*\[\]_]/);
  });

  it('strips emojis', () => {
    const result = cleanSpeakableText('You are safe 📍🚗 here');
    expect(result).toBe('You are safe here');
  });

  it('collapses repeated whitespace', () => {
    expect(cleanSpeakableText('a   b\n\nc')).toBe('a b c');
  });
});

describe('voice actor routing', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes English readouts through the Speechmatics TTS endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'mock failure',
    });
    vi.stubGlobal('fetch', fetchMock);

    await speakSpeechmaticsOrFallback('Hello senior', 'sarah');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/speechmatics/tts',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('replaces stale/invalid persisted voice IDs with the sarah default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    await speakSpeechmaticsOrFallback('Hello senior', 'ariana');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.voice).toBe('sarah');
  });

  it('bypasses Speechmatics for Mandarin and uses native Web Speech', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await speakSpeechmaticsOrFallback('你好，您现在很安全', 'sarah', undefined, 0.9, 'zh');

    // Speechmatics TTS is English-only; zh/ms/ta must never hit the endpoint
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bypasses Speechmatics for Malay and Tamil as well', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await speakSpeechmaticsOrFallback('Anda selamat', 'sarah', undefined, 0.9, 'ms');
    await speakSpeechmaticsOrFallback('நீங்கள் பாதுகாப்பு', 'sarah', undefined, 0.9, 'ta');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls onEnd immediately for empty-after-sanitize text', async () => {
    const onEnd = vi.fn();
    await speakSpeechmaticsOrFallback('📍', 'sarah', onEnd);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

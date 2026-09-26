/**
 * Unit tests for the config schema validation.
 */

import { describe, it, expect } from 'vitest';
import { parseConfig, parseConfigWithDefaults } from '@nazzel/config/schema.js';
import { DEFAULT_CONFIG } from '@nazzel/config/defaults.js';

describe('parseConfig', () => {
  const validConfig = {
    outputDir: '/home/user/Downloads',
    concurrency: 1,
    maxRetries: 3,
    retryBackoffMs: 2000,
    preferredFormat: 'bestvideo+bestaudio/best',
    audioFormat: 'm4a',
    videoFormat: 'mp4',
    historyFile: '/home/user/.config/nazzel/history.ndjson',
    ytdlpPath: null,
    ffmpegPath: null,
    ffprobePath: null,
    denoPath: null,
  };

  it('parses a valid config', () => {
    const result = parseConfig(validConfig);
    expect(result.outputDir).toBe('/home/user/Downloads');
    expect(result.concurrency).toBe(1);
  });

  it('rejects unknown keys (strict mode)', () => {
    expect(() =>
      parseConfig({ ...validConfig, unknownKey: 'oops' }),
    ).toThrow();
  });

  it('rejects concurrency > 5', () => {
    expect(() => parseConfig({ ...validConfig, concurrency: 10 })).toThrow();
  });

  it('rejects maxRetries > MAX_RETRY_HARD_LIMIT', () => {
    expect(() => parseConfig({ ...validConfig, maxRetries: 100 })).toThrow();
  });

  it('rejects invalid audioFormat', () => {
    expect(() => parseConfig({ ...validConfig, audioFormat: 'mp4' })).toThrow();
  });

  it('rejects invalid videoFormat', () => {
    expect(() => parseConfig({ ...validConfig, videoFormat: 'mp3' })).toThrow();
  });

  it('accepts null for optional binary paths', () => {
    const result = parseConfig({ ...validConfig, ytdlpPath: null });
    expect(result.ytdlpPath).toBeNull();
  });

  it('accepts non-null string for optional binary paths', () => {
    const result = parseConfig({ ...validConfig, ytdlpPath: '/usr/local/bin/yt-dlp' });
    expect(result.ytdlpPath).toBe('/usr/local/bin/yt-dlp');
  });
});

describe('parseConfigWithDefaults', () => {
  it('uses defaults when raw is empty object', () => {
    const result = parseConfigWithDefaults({}, DEFAULT_CONFIG);
    expect(result.outputDir).toBe(DEFAULT_CONFIG.outputDir);
    expect(result.concurrency).toBe(DEFAULT_CONFIG.concurrency);
  });

  it('overrides defaults with provided values', () => {
    const result = parseConfigWithDefaults({ concurrency: 3 }, DEFAULT_CONFIG);
    expect(result.concurrency).toBe(3);
    expect(result.outputDir).toBe(DEFAULT_CONFIG.outputDir);
  });

  it('uses defaults when raw is null', () => {
    const result = parseConfigWithDefaults(null, DEFAULT_CONFIG);
    expect(result.concurrency).toBe(DEFAULT_CONFIG.concurrency);
  });

  it('uses defaults when raw is undefined', () => {
    const result = parseConfigWithDefaults(undefined, DEFAULT_CONFIG);
    expect(result.concurrency).toBe(DEFAULT_CONFIG.concurrency);
  });
});

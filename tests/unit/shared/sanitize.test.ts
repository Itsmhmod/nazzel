/**
 * Unit tests for input sanitization guards.
 */

import { describe, it, expect } from 'vitest';
import {
  validateUrl,
  validateOutputDir,
  sanitizeFilename,
  validateFormatId,
} from '@nazzel/shared/sanitize.js';
import { AppError } from '@nazzel/domain/errors.js';

describe('validateUrl', () => {
  it('accepts valid http URLs', () => {
    expect(validateUrl('http://example.com/video')).toBe('http://example.com/video');
  });

  it('accepts valid https URLs', () => {
    expect(validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });

  it('trims whitespace and returns trimmed URL', () => {
    expect(validateUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('rejects empty string', () => {
    expect(() => validateUrl('')).toThrow(AppError);
    expect(() => validateUrl('   ')).toThrow(AppError);
  });

  it('rejects non-string input', () => {
    expect(() => validateUrl(null)).toThrow(AppError);
    expect(() => validateUrl(42)).toThrow(AppError);
    expect(() => validateUrl(undefined)).toThrow(AppError);
  });

  it('rejects javascript: protocol', () => {
    expect(() => validateUrl('javascript:alert(1)')).toThrow(AppError);
  });

  it('rejects file: protocol', () => {
    expect(() => validateUrl('file:///etc/passwd')).toThrow(AppError);
  });

  it('rejects malformed URLs', () => {
    expect(() => validateUrl('not a url at all')).toThrow(AppError);
  });

  it('rejects URLs over MAX_URL_LENGTH', () => {
    const long = 'https://example.com/' + 'a'.repeat(3000);
    expect(() => validateUrl(long)).toThrow(AppError);
  });
});

describe('validateOutputDir', () => {
  it('accepts a normal path', () => {
    expect(validateOutputDir('/home/user/Downloads')).toBe('/home/user/Downloads');
  });

  it('accepts Windows-style paths', () => {
    expect(validateOutputDir('C:\\Users\\user\\Downloads')).toBe('C:\\Users\\user\\Downloads');
  });

  it('rejects empty string', () => {
    expect(() => validateOutputDir('')).toThrow(AppError);
  });

  it('rejects null bytes', () => {
    expect(() => validateOutputDir('/home/user/\0evil')).toThrow(AppError);
  });

  it('rejects path traversal sequences', () => {
    expect(() => validateOutputDir('/home/user/../../../etc')).toThrow(AppError);
  });

  it('rejects non-string input', () => {
    expect(() => validateOutputDir(null)).toThrow(AppError);
  });
});

describe('sanitizeFilename', () => {
  it('replaces forbidden characters with underscores', () => {
    expect(sanitizeFilename('video: "best" <content>')).toBe('video_ _best_ _content_');
  });

  it('preserves normal characters', () => {
    const result = sanitizeFilename('My Cool Video 2024');
    expect(result).toBe('My Cool Video 2024');
  });

  it('truncates to MAX_FILENAME_LENGTH characters', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(200);
  });

  it('returns "untitled" for empty or all-invalid titles', () => {
    expect(sanitizeFilename('')).toBe('untitled');
    expect(sanitizeFilename('\0\0\0')).toBe('untitled');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeFilename('a   b')).toBe('a b');
  });
});

describe('validateFormatId', () => {
  it('accepts simple format IDs', () => {
    expect(validateFormatId('137')).toBe('137');
    expect(validateFormatId('140')).toBe('140');
  });

  it('accepts compound format selectors', () => {
    expect(validateFormatId('bestvideo+bestaudio')).toBe('bestvideo+bestaudio');
    expect(validateFormatId('137+140')).toBe('137+140');
  });

  it('rejects empty string', () => {
    expect(() => validateFormatId('')).toThrow(AppError);
  });

  it('rejects shell metacharacters', () => {
    expect(() => validateFormatId('137;rm -rf /')).toThrow(AppError);
    expect(() => validateFormatId('137 && evil')).toThrow(AppError);
    expect(() => validateFormatId('137\n140')).toThrow(AppError);
  });

  it('rejects non-string input', () => {
    expect(() => validateFormatId(null)).toThrow(AppError);
  });
});

/**
 * @fileoverview Input sanitization guards.
 *
 * All user-controlled input must pass through these guards before use.
 * These are pure validation functions — they throw AppError on invalid input,
 * never silently modify the value.
 *
 * SECURITY PRINCIPLE: We validate, we do not silently transform.
 * The caller knows what they submitted; if it's rejected, they should see why.
 */

import { AppError } from '../domain/errors.js';
import { MAX_FILENAME_LENGTH, MAX_URL_LENGTH } from '../domain/constants.js';

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/**
 * Validate a URL string submitted by the user.
 *
 * Checks:
 * - Not empty
 * - Within length limit
 * - Parseable as a URL
 * - Protocol is http or https (not javascript:, file:, etc.)
 *
 * Returns the original string (no transformation) if valid.
 * Throws AppError('CONFIG_INVALID') if invalid.
 */
export function validateUrl(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new AppError('CONFIG_INVALID', 'URL must be a non-empty string');
  }

  const trimmed = input.trim();

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new AppError(
      'CONFIG_INVALID',
      `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('CONFIG_INVALID', `Invalid URL format: "${trimmed}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      'CONFIG_INVALID',
      `URL must use http or https protocol, got: "${parsed.protocol}"`,
    );
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// Filesystem path validation
// ---------------------------------------------------------------------------

/**
 * Validate an output directory path.
 *
 * Checks:
 * - Not empty
 * - Does not contain null bytes
 * - Does not contain path traversal sequences (..)
 *
 * Note: Does NOT check if the path exists — that is the FileSystem layer's job.
 * Returns the original string if valid.
 */
export function validateOutputDir(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new AppError('FS_PATH_INVALID', 'Output directory must be a non-empty string');
  }

  const trimmed = input.trim();

  if (trimmed.includes('\0')) {
    throw new AppError('FS_PATH_INVALID', 'Output directory path contains null byte');
  }

  if (trimmed.includes('..')) {
    throw new AppError(
      'FS_PATH_INVALID',
      'Output directory path must not contain path traversal sequences (..)',
    );
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// Filename sanitization
// ---------------------------------------------------------------------------

/** Characters forbidden in filenames across Windows, macOS, and Linux. */
const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Sanitize a media title for use as a filename component.
 *
 * This transforms the value (replaces invalid characters with underscores,
 * truncates to MAX_FILENAME_LENGTH). It is the ONLY place where transformation
 * is acceptable because we are generating a filename, not validating user input.
 *
 * The caller should use this result for display only.
 * The actual downloaded file uses yt-dlp's own %(id)s.%(ext)s template.
 */
export function sanitizeFilename(title: string): string {
  const sanitized = title
    .replace(FORBIDDEN_FILENAME_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

  if (sanitized === '' || /^_+$/.test(sanitized)) {
    return 'untitled';
  }

  return sanitized;
}

// ---------------------------------------------------------------------------
// Format ID validation
// ---------------------------------------------------------------------------

/** yt-dlp format IDs are alphanumeric with some operators (+, /, [, ], etc.) */
const FORMAT_ID_PATTERN = /^[\w+/[\](),.@-]{1,100}$/;

/**
 * Validate a yt-dlp format ID before passing it as a CLI argument.
 *
 * This prevents injection of unexpected characters into the yt-dlp -f argument.
 * The format ID is always passed as a separate argv element (never shell-interpolated),
 * but we validate it anyway as defense-in-depth.
 */
export function validateFormatId(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new AppError('FORMAT_UNAVAILABLE', 'Format ID must be a non-empty string');
  }

  const trimmed = input.trim();

  if (!FORMAT_ID_PATTERN.test(trimmed)) {
    throw new AppError('FORMAT_UNAVAILABLE', `Invalid format ID: "${trimmed}"`);
  }

  return trimmed;
}

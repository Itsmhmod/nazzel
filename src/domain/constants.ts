/**
 * @fileoverview Application-wide constants.
 *
 * All magic numbers live here. Never hardcode retry counts, timeouts,
 * or exit codes in application or infrastructure code.
 *
 * No dependencies on other layers.
 */

// ---------------------------------------------------------------------------
// Process exit codes
// ---------------------------------------------------------------------------

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  BAD_INPUT: 2,
  DEPENDENCY_ERROR: 3,
  NETWORK_FAILURE: 4,
  EXTRACTOR_FAILURE: 5,
  CANCELLED: 6,
  FS_FAILURE: 7,
  POSTPROCESS_FAILURE: 8,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

// ---------------------------------------------------------------------------
// Retry / recovery limits
// ---------------------------------------------------------------------------

/** Absolute maximum number of download attempts (config.maxRetries cannot exceed this). */
export const MAX_RETRY_HARD_LIMIT = 5;

/** Default number of retry attempts. Configurable up to MAX_RETRY_HARD_LIMIT. */
export const DEFAULT_MAX_RETRIES = 3;

/** Initial backoff delay in milliseconds. */
export const DEFAULT_RETRY_BACKOFF_MS = 2_000;

/** Backoff multiplier applied after each failed attempt. */
export const RETRY_BACKOFF_MULTIPLIER = 2.0;

/** Maximum backoff delay in milliseconds (hard cap). */
export const MAX_RETRY_BACKOFF_MS = 30_000;

// ---------------------------------------------------------------------------
// Process timeouts
// ---------------------------------------------------------------------------

/** Timeout for URL analysis (yt-dlp --dump-json). */
export const ANALYSIS_TIMEOUT_MS = 30_000;

/** Timeout for dependency version checks. */
export const DEPENDENCY_CHECK_TIMEOUT_MS = 5_000;

/** Timeout for ffprobe verification. */
export const FFPROBE_TIMEOUT_MS = 15_000;

/** Timeout for dependency installation. */
export const INSTALL_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Stderr buffer limits
// ---------------------------------------------------------------------------

/** Maximum stderr captured from any spawned process. */
export const MAX_STDERR_BUFFER_BYTES = 65_536; // 64 KiB

// ---------------------------------------------------------------------------
// File / path limits
// ---------------------------------------------------------------------------

/** Maximum filename length (excluding extension). */
export const MAX_FILENAME_LENGTH = 200;

/** Maximum URL length accepted as input. */
export const MAX_URL_LENGTH = 2_048;

// ---------------------------------------------------------------------------
// History limits
// ---------------------------------------------------------------------------

/** Warn user when history file exceeds this size. */
export const HISTORY_WARN_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

// ---------------------------------------------------------------------------
// Version requirements
// ---------------------------------------------------------------------------

export const MIN_NODE_VERSION = '20.0.0';
export const MIN_YTDLP_DATE = '20240101'; // YYYYMMDD format used by yt-dlp
export const MIN_FFMPEG_VERSION = '4.0.0';

// ---------------------------------------------------------------------------
// Application identity
// ---------------------------------------------------------------------------

export const APP_NAME = 'nazzel';
export const CONFIG_DIR_NAME = 'nazzel';

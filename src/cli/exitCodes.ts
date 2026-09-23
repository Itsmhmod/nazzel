import { AppError, type AppErrorCode } from '@nazzel/domain/errors.js';

/**
 * Nazzel Exit Codes
 * 0: Success
 * 1: Unknown Exception
 * 2: Invalid CLI arguments
 */
export const EXIT_CODES: Record<AppErrorCode | 'UNKNOWN' | 'CLI_INVALID_ARGS', number> = {
  UNKNOWN: 1,
  CLI_INVALID_ARGS: 2,

  DEPENDENCY_MISSING: 3,
  DEPENDENCY_INSTALL_FAILED: 3,
  DEPENDENCY_OUTDATED: 3,

  NETWORK_FAILURE: 4,
  NETWORK_TIMEOUT: 4,

  EXTRACTOR_FAILURE: 5,
  FORMAT_UNAVAILABLE: 5,
  ANALYSIS_FAILED: 5,

  CANCELLED: 6,

  PROCESS_CRASH: 1,
  PROCESS_TIMEOUT: 1,

  FS_PERMISSION_DENIED: 7,
  FS_DISK_FULL: 7,
  FS_PATH_INVALID: 7,
  FS_WRITE_FAILED: 7,

  POSTPROCESS_FAILURE: 8,
  VERIFY_FAILURE: 8,

  CONFIG_INVALID: 2,
  CONFIG_WRITE_FAILED: 2,
};

/**
 * Evaluates an unknown error and returns the appropriate exit code.
 */
export function getExitCodeForError(error: unknown): number {
  if (AppError.is(error)) {
    return EXIT_CODES[error.code] ?? EXIT_CODES.UNKNOWN;
  }
  return EXIT_CODES.UNKNOWN;
}

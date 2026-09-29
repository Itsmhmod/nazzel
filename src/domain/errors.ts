/**
 * @fileoverview Typed error system for Nazzel.
 *
 * All errors crossing layer boundaries must be AppError instances.
 * The infrastructure layer converts raw process/OS errors into AppError.
 * The application layer converts AppError into recovery plans.
 * The TUI layer renders AppError without interpreting error codes.
 *
 * No dependencies on other layers.
 */

// ---------------------------------------------------------------------------
// Error Code Union
// ---------------------------------------------------------------------------

/**
 * All possible application error codes.
 *
 * Every code maps to a specific recovery strategy in RecoveryManager.
 * Adding a code here requires a corresponding case in the recovery map.
 */
export type AppErrorCode =
  // Dependency errors
  | 'DEPENDENCY_MISSING'
  | 'DEPENDENCY_OUTDATED'
  | 'DEPENDENCY_INSTALL_FAILED'
  // Network errors
  | 'NETWORK_FAILURE'
  | 'NETWORK_TIMEOUT'
  // Extraction errors
  | 'EXTRACTOR_FAILURE'
  | 'FORMAT_UNAVAILABLE'
  | 'ANALYSIS_FAILED'
  // Process errors
  | 'PROCESS_CRASH'
  | 'PROCESS_TIMEOUT'
  // Filesystem errors
  | 'FS_PERMISSION_DENIED'
  | 'FS_DISK_FULL'
  | 'FS_PATH_INVALID'
  | 'FS_WRITE_FAILED'
  // Post-processing errors
  | 'POSTPROCESS_FAILURE'
  // Verification errors
  | 'VERIFY_FAILURE'
  // User-initiated
  | 'CANCELLED'
  // Configuration errors
  | 'CONFIG_INVALID'
  | 'CONFIG_WRITE_FAILED'
  // Lifecycle errors
  | 'UPDATE_FAILED'
  | 'UNINSTALL_FAILED';

// ---------------------------------------------------------------------------
// Recoverability Classification
// ---------------------------------------------------------------------------

/**
 * Maps each error code to whether automatic recovery is possible.
 *
 * This is a compile-time-checked record — every AppErrorCode must have
 * an entry. If you add a code above, TypeScript will error here until
 * you add the corresponding entry.
 */
export const ERROR_RECOVERABILITY: Readonly<Record<AppErrorCode, boolean>> = {
  DEPENDENCY_MISSING: false,
  DEPENDENCY_OUTDATED: true,
  DEPENDENCY_INSTALL_FAILED: false,
  NETWORK_FAILURE: true,
  NETWORK_TIMEOUT: true,
  EXTRACTOR_FAILURE: true, // may resolve with yt-dlp update
  FORMAT_UNAVAILABLE: false,
  ANALYSIS_FAILED: false,
  PROCESS_CRASH: true,
  PROCESS_TIMEOUT: false,
  FS_PERMISSION_DENIED: false,
  FS_DISK_FULL: false,
  FS_PATH_INVALID: false,
  FS_WRITE_FAILED: false,
  POSTPROCESS_FAILURE: false,
  VERIFY_FAILURE: true,
  CANCELLED: false,
  CONFIG_INVALID: false,
  CONFIG_WRITE_FAILED: false,
  UPDATE_FAILED: false,
  UNINSTALL_FAILED: false,
};

// ---------------------------------------------------------------------------
// AppError Class
// ---------------------------------------------------------------------------

/**
 * The single error class used throughout Nazzel.
 *
 * Never throw raw Error objects across layer boundaries.
 * Always wrap in AppError with an explicit code.
 */
export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly recoverable: boolean;
  public readonly context: Readonly<Record<string, unknown>>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.recoverable = ERROR_RECOVERABILITY[code];
    this.context = Object.freeze(options?.context ?? {});

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Create an AppError from an unknown caught value.
   * Use this in catch blocks to ensure typed errors.
   */
  static from(code: AppErrorCode, unknown: unknown, context?: Record<string, unknown>): AppError {
    if (unknown instanceof AppError) {
      return unknown;
    }
    const message = unknown instanceof Error ? unknown.message : String(unknown);
    return new AppError(code, message, {
      cause: unknown,
      ...(context !== undefined ? { context } : {}),
    });
  }

  /**
   * Type guard to check if an unknown value is an AppError.
   */
  static is(value: unknown): value is AppError {
    return value instanceof AppError;
  }

  override toString(): string {
    return `AppError[${this.code}]: ${this.message}`;
  }

  /**
   * Serialize to a plain object for logging or machine output.
   * Excludes stack trace to avoid leaking internal paths.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      context: this.context,
    };
  }
}

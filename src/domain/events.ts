/**
 * @fileoverview Typed application event union.
 *
 * All internal events flow through the AppEventBus as one of these types.
 * The TUI subscribes to these events and renders them without business logic.
 * The application layer emits these events; infrastructure never emits them directly.
 *
 * No dependencies on other layers.
 */

import type { IDownloadProgress, IDownloadResult, IDependencyStatus } from './types.js';
import type { AppError } from './errors.js';

// ---------------------------------------------------------------------------
// Application Events
// ---------------------------------------------------------------------------

export type AppEvent =
  // --- Download lifecycle ---
  | {
      readonly type: 'DOWNLOAD_QUEUED';
      readonly downloadId: string;
      readonly url: string;
    }
  | {
      readonly type: 'DOWNLOAD_STARTED';
      readonly downloadId: string;
      readonly url: string;
      readonly title: string;
    }
  | {
      readonly type: 'PROGRESS_UPDATE';
      readonly progress: IDownloadProgress;
    }
  | {
      readonly type: 'DOWNLOAD_COMPLETED';
      readonly result: IDownloadResult;
    }
  | {
      readonly type: 'DOWNLOAD_FAILED';
      readonly downloadId: string;
      readonly error: AppError;
    }
  | {
      readonly type: 'DOWNLOAD_CANCELLED';
      readonly downloadId: string;
    }
  // --- Recovery lifecycle ---
  | {
      readonly type: 'RECOVERY_STARTED';
      readonly downloadId: string;
      readonly attempt: number;
      readonly maxAttempts: number;
      readonly errorCode: string;
    }
  | {
      readonly type: 'RECOVERY_SUCCEEDED';
      readonly downloadId: string;
    }
  | {
      readonly type: 'RECOVERY_EXHAUSTED';
      readonly downloadId: string;
      readonly totalAttempts: number;
    }
  // --- Dependency events ---
  | {
      readonly type: 'DEPENDENCY_STATUS_CHANGED';
      readonly dep: string;
      readonly status: IDependencyStatus;
    }
  | {
      readonly type: 'DEPENDENCY_INSTALL_STARTED';
      readonly dep: string;
    }
  | {
      readonly type: 'DEPENDENCY_INSTALL_COMPLETED';
      readonly dep: string;
      readonly version: string;
    }
  | {
      readonly type: 'DEPENDENCY_INSTALL_FAILED';
      readonly dep: string;
      readonly error: AppError;
    };

/** Narrows an AppEvent to a specific type. */
export type AppEventOfType<T extends AppEvent['type']> = Extract<AppEvent, { type: T }>;

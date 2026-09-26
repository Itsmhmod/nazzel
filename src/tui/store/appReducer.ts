import type { AppEvent } from '@nazzel/domain/events.js';
import type { IDownloadProgress, IMediaInfo, IDownloadResult, IDependencyReport } from '@nazzel/domain/types.js';
import type { AppError } from '@nazzel/domain/errors.js';

export type AppScreen =
  | 'HOME'
  | 'ANALYZING'
  | 'FORMAT_SELECTION'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'ERROR'
  | 'RECOVERING'
  | 'DIAGNOSTICS'
  | 'HISTORY'
  | 'CHECKING_ENV'
  | 'REPAIRING';

export interface AppState {
  screen: AppScreen;
  previousScreen: AppScreen | null; // For modal-like screens like DIAGNOSTICS
  url: string | null;
  mediaInfo: IMediaInfo | null;
  downloadId: string | null;
  progress: IDownloadProgress | null;
  result: IDownloadResult | null;
  error: AppError | null;
  recovery: { attempt: number; maxAttempts: number } | null;
  dependencyReport: IDependencyReport | null;
  repairProgress: { name: string; downloaded: number; total: number | undefined } | null;
}

export const initialState: AppState = {
  screen: 'HOME',
  previousScreen: null,
  url: null,
  mediaInfo: null,
  downloadId: null,
  progress: null,
  result: null,
  error: null,
  recovery: null,
  dependencyReport: null,
  repairProgress: null,
};

// UI-specific action types that don't come from the domain
export type UIAction =
  | { type: 'UI_SUBMIT_URL'; url: string; downloadId: string }
  | { type: 'UI_SHOW_FORMATS'; info: IMediaInfo }
  | { type: 'UI_FORMAT_SELECTED'; formatId: string } // Doesn't transition immediately, waits for DOWNLOAD_QUEUED/STARTED
  | { type: 'UI_RESTART' }
  | { type: 'UI_TOGGLE_DIAGNOSTICS' }
  | { type: 'UI_TOGGLE_HISTORY' }
  | { type: 'UI_VERIFYING' }
  | { type: 'UI_CHECKING_ENV' }
  | { type: 'UI_REPAIRING'; report: IDependencyReport }
  | { type: 'UI_REPAIR_PROGRESS'; name: string; downloaded: number; total: number | undefined };

export type Action = AppEvent | UIAction;

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // -------------------------------------------------------------------------
    // UI ACTIONS
    // -------------------------------------------------------------------------
    case 'UI_SUBMIT_URL':
      return {
        ...initialState,
        screen: 'ANALYZING',
        url: action.url,
        downloadId: action.downloadId,
      };

    case 'UI_SHOW_FORMATS':
      return {
        ...state,
        screen: 'FORMAT_SELECTION',
        mediaInfo: action.info,
      };

    case 'UI_RESTART':
      return {
        ...initialState,
      };

    case 'UI_TOGGLE_DIAGNOSTICS':
      if (state.screen === 'DIAGNOSTICS') {
        return {
          ...state,
          screen: state.previousScreen || 'HOME',
          previousScreen: null,
        };
      } else {
        return {
          ...state,
          previousScreen: state.screen,
          screen: 'DIAGNOSTICS',
        };
      }

    case 'UI_TOGGLE_HISTORY':
      if (state.screen === 'HISTORY') {
        return {
          ...state,
          screen: state.previousScreen || 'HOME',
          previousScreen: null,
        };
      } else {
        return {
          ...state,
          previousScreen: state.screen,
          screen: 'HISTORY',
        };
      }

    case 'UI_VERIFYING':
      return {
        ...state,
        screen: 'VERIFYING',
      };

    case 'UI_CHECKING_ENV':
      return {
        ...state,
        screen: 'CHECKING_ENV',
      };

    case 'UI_REPAIRING':
      return {
        ...state,
        screen: 'REPAIRING',
        dependencyReport: action.report,
        repairProgress: null,
      };

    case 'UI_REPAIR_PROGRESS':
      return {
        ...state,
        repairProgress: { name: action.name, downloaded: action.downloaded, total: action.total },
      };

    // -------------------------------------------------------------------------
    // DOMAIN EVENTS
    // -------------------------------------------------------------------------
    case 'DOWNLOAD_QUEUED':
      return {
        ...state,
        downloadId: action.downloadId,
      };

    case 'DOWNLOAD_STARTED':
      // If we are recovering, keep showing RECOVERING until PROGRESS_UPDATE
      if (state.screen === 'RECOVERING') {
        return state;
      }
      return {
        ...state,
        downloadId: action.downloadId,
        screen: 'DOWNLOADING',
      };

    case 'PROGRESS_UPDATE':
      return {
        ...state,
        screen: action.progress.phase === 'verifying' ? 'VERIFYING' : 'DOWNLOADING', // Ensures we exit RECOVERING and handle VERIFYING
        progress: action.progress,
        recovery: null,
        error: null,
      };

    case 'DOWNLOAD_COMPLETED':
      return {
        ...state,
        screen: 'COMPLETED',
        result: action.result,
        progress: null,
        recovery: null,
      };

    case 'DOWNLOAD_FAILED':
      return {
        ...state,
        screen: 'ERROR',
        error: action.error,
        progress: null,
        recovery: null,
      };

    case 'DOWNLOAD_CANCELLED':
      return {
        ...initialState,
      };

    case 'RECOVERY_STARTED':
      return {
        ...state,
        screen: 'RECOVERING',
        recovery: { attempt: action.attempt, maxAttempts: action.maxAttempts },
      };

    case 'RECOVERY_SUCCEEDED':
    case 'RECOVERY_EXHAUSTED':
      // Handled inherently by subsequent STARTED or FAILED events
      return state;

    case 'DEPENDENCY_STATUS_CHANGED':
    case 'DEPENDENCY_INSTALL_STARTED':
    case 'DEPENDENCY_INSTALL_COMPLETED':
    case 'DEPENDENCY_INSTALL_FAILED':
      // Handled by DiagnosticsRunner, we don't need to put these into global TUI state
      // unless we want to show a global warning
      return state;

    default:
      return state;
  }
}

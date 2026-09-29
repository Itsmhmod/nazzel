import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../../src/tui/store/appReducer.js';
import type { AppEvent } from '@nazzel/domain/events.js';

describe('TUI AppReducer', () => {
  it('should transition from HOME to ANALYZING on UI_SUBMIT_URL', () => {
    const state = appReducer(initialState, {
      type: 'UI_SUBMIT_URL',
      url: 'http://test',
      downloadId: 'test',
    });
    expect(state.screen).toBe('ANALYZING');
    expect(state.url).toBe('http://test');
  });

  it('should handle DOWNLOAD_STARTED', () => {
    const event: AppEvent = {
      type: 'DOWNLOAD_STARTED',
      downloadId: 'test-id',
      url: 'http://test',
      title: 'Test',
    };
    const state = appReducer(initialState, event);
    expect(state.screen).toBe('DOWNLOADING');
    expect(state.downloadId).toBe('test-id');
  });

  it('should ignore DOWNLOAD_STARTED if currently RECOVERING', () => {
    let state = appReducer(initialState, {
      type: 'RECOVERY_STARTED',
      downloadId: 'test-id',
      attempt: 1,
      maxAttempts: 3,
      errorCode: 'PROCESS_CRASH',
    });

    expect(state.screen).toBe('RECOVERING');

    state = appReducer(state, {
      type: 'DOWNLOAD_STARTED',
      downloadId: 'test-id',
      url: 'http://test',
      title: 'Test',
    });

    expect(state.screen).toBe('RECOVERING');
  });

  it('should transition back to DOWNLOADING on PROGRESS_UPDATE from RECOVERING', () => {
    let state = appReducer(initialState, {
      type: 'RECOVERY_STARTED',
      downloadId: 'test-id',
      attempt: 1,
      maxAttempts: 3,
      errorCode: 'PROCESS_CRASH',
    });

    state = appReducer(state, {
      type: 'PROGRESS_UPDATE',
      progress: {
        downloadId: 'test-id',
        percent: 10,
        speed: null,
        eta: null,
        downloaded: 100,
        total: 1000,
        phase: 'downloading',
      },
    });

    expect(state.screen).toBe('DOWNLOADING');
    expect(state.recovery).toBeNull();
  });
});

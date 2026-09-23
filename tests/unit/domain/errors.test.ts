/**
 * Unit tests for AppError — error classification, recoverability, serialization.
 */

import { describe, it, expect } from 'vitest';
import { AppError, ERROR_RECOVERABILITY } from '@nazzel/domain/errors.js';
import type { AppErrorCode } from '@nazzel/domain/errors.js';

describe('AppError', () => {
  describe('constructor', () => {
    it('sets the code and message', () => {
      const err = new AppError('NETWORK_FAILURE', 'Connection reset');
      expect(err.code).toBe('NETWORK_FAILURE');
      expect(err.message).toBe('Connection reset');
    });

    it('sets name to AppError', () => {
      const err = new AppError('CANCELLED', 'User cancelled');
      expect(err.name).toBe('AppError');
    });

    it('sets recoverable from the recoverability map', () => {
      const recoverable = new AppError('NETWORK_FAILURE', 'net fail');
      expect(recoverable.recoverable).toBe(true);

      const notRecoverable = new AppError('DEPENDENCY_MISSING', 'missing dep');
      expect(notRecoverable.recoverable).toBe(false);
    });

    it('stores context as a frozen object', () => {
      const err = new AppError('FS_PERMISSION_DENIED', 'denied', {
        context: { path: '/some/path', uid: 1000 },
      });
      expect(err.context).toEqual({ path: '/some/path', uid: 1000 });
      expect(Object.isFrozen(err.context)).toBe(true);
    });

    it('stores empty frozen object when no context provided', () => {
      const err = new AppError('CANCELLED', 'cancelled');
      expect(err.context).toEqual({});
      expect(Object.isFrozen(err.context)).toBe(true);
    });

    it('supports instanceof checks', () => {
      const err = new AppError('NETWORK_FAILURE', 'net fail');
      expect(err instanceof AppError).toBe(true);
      expect(err instanceof Error).toBe(true);
    });
  });

  describe('AppError.from()', () => {
    it('returns the same AppError if given an AppError', () => {
      const original = new AppError('NETWORK_FAILURE', 'original');
      const result = AppError.from('PROCESS_CRASH', original);
      expect(result).toBe(original);
    });

    it('wraps a native Error', () => {
      const native = new Error('ENOENT');
      const result = AppError.from('FS_PERMISSION_DENIED', native);
      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe('FS_PERMISSION_DENIED');
      expect(result.message).toBe('ENOENT');
      expect(result.cause).toBe(native);
    });

    it('wraps a string', () => {
      const result = AppError.from('EXTRACTOR_FAILURE', 'something went wrong');
      expect(result.message).toBe('something went wrong');
    });

    it('attaches context', () => {
      const result = AppError.from('NETWORK_FAILURE', new Error('net'), { url: 'https://x.com' });
      expect(result.context).toEqual({ url: 'https://x.com' });
    });
  });

  describe('AppError.is()', () => {
    it('returns true for AppError instances', () => {
      expect(AppError.is(new AppError('CANCELLED', 'x'))).toBe(true);
    });

    it('returns false for plain Error', () => {
      expect(AppError.is(new Error('x'))).toBe(false);
    });

    it('returns false for null, undefined, string', () => {
      expect(AppError.is(null)).toBe(false);
      expect(AppError.is(undefined)).toBe(false);
      expect(AppError.is('error')).toBe(false);
    });
  });

  describe('toString()', () => {
    it('includes the code and message', () => {
      const err = new AppError('NETWORK_FAILURE', 'connection reset');
      expect(err.toString()).toBe('AppError[NETWORK_FAILURE]: connection reset');
    });
  });

  describe('toJSON()', () => {
    it('serializes without stack trace', () => {
      const err = new AppError('NETWORK_FAILURE', 'reset', { context: { attempt: 2 } });
      const json = err.toJSON();
      expect(json).toMatchObject({
        name: 'AppError',
        code: 'NETWORK_FAILURE',
        message: 'reset',
        recoverable: true,
        context: { attempt: 2 },
      });
      expect(json).not.toHaveProperty('stack');
    });
  });

  describe('ERROR_RECOVERABILITY map completeness', () => {
    it('has an entry for every AppErrorCode', () => {
      // This test ensures the map stays in sync with the union type.
      // If a code is added to AppErrorCode without a map entry, tsc will fail.
      // This test verifies the runtime values are booleans.
      const codes: AppErrorCode[] = [
        'DEPENDENCY_MISSING',
        'DEPENDENCY_OUTDATED',
        'DEPENDENCY_INSTALL_FAILED',
        'NETWORK_FAILURE',
        'NETWORK_TIMEOUT',
        'EXTRACTOR_FAILURE',
        'FORMAT_UNAVAILABLE',
        'ANALYSIS_FAILED',
        'PROCESS_CRASH',
        'PROCESS_TIMEOUT',
        'FS_PERMISSION_DENIED',
        'FS_DISK_FULL',
        'FS_PATH_INVALID',
        'FS_WRITE_FAILED',
        'POSTPROCESS_FAILURE',
        'VERIFY_FAILURE',
        'CANCELLED',
        'CONFIG_INVALID',
        'CONFIG_WRITE_FAILED',
      ];
      for (const code of codes) {
        expect(typeof ERROR_RECOVERABILITY[code]).toBe('boolean');
      }
    });

    it('marks CANCELLED as not recoverable', () => {
      expect(ERROR_RECOVERABILITY['CANCELLED']).toBe(false);
    });

    it('marks NETWORK_FAILURE as recoverable', () => {
      expect(ERROR_RECOVERABILITY['NETWORK_FAILURE']).toBe(true);
    });
  });
});

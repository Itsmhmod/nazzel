import { describe, it, expect } from 'vitest';
import { getExitCodeForError } from '../../../src/cli/exitCodes.js';
import { AppError } from '../../../src/domain/errors.js';

describe('exitCodes', () => {
  it('maps DEPENDENCY_MISSING to 3', () => {
    const error = new AppError('DEPENDENCY_MISSING', 'test');
    expect(getExitCodeForError(error)).toBe(3);
  });

  it('maps NETWORK_FAILURE to 4', () => {
    const error = new AppError('NETWORK_FAILURE', 'test');
    expect(getExitCodeForError(error)).toBe(4);
  });

  it('maps PROCESS_CRASH to 1', () => {
    const error = new AppError('PROCESS_CRASH', 'test');
    expect(getExitCodeForError(error)).toBe(1);
  });

  it('maps CANCELLED to 6', () => {
    const error = new AppError('CANCELLED', 'test');
    expect(getExitCodeForError(error)).toBe(6);
  });

  it('maps unknown AppError to 1 if missing in mapping (though TypeScript enforces completeness)', () => {
    // Cast to test runtime fallback
    const error = new AppError('UNKNOWN_CODE' as any, 'test');
    expect(getExitCodeForError(error)).toBe(1);
  });

  it('maps generic Error to 1', () => {
    const error = new Error('Standard error');
    expect(getExitCodeForError(error)).toBe(1);
  });

  it('maps string to 1', () => {
    expect(getExitCodeForError('just a string')).toBe(1);
  });
});

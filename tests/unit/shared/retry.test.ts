/**
 * Unit tests for the retry utility.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createRetryBudget,
  hasRemainingAttempts,
  consumeAttempt,
  withRetry,
  delay,
} from '@nazzel/shared/retry.js';
import { AppError } from '@nazzel/domain/errors.js';
import { MAX_RETRY_HARD_LIMIT, MAX_RETRY_BACKOFF_MS } from '@nazzel/domain/constants.js';

describe('createRetryBudget', () => {
  it('creates a budget with default max attempts', () => {
    const budget = createRetryBudget('dl-1');
    expect(budget.downloadId).toBe('dl-1');
    expect(budget.attempts).toBe(0);
    expect(budget.maxAttempts).toBe(3); // DEFAULT_MAX_RETRIES
  });

  it('clamps maxAttempts to MAX_RETRY_HARD_LIMIT', () => {
    const budget = createRetryBudget('dl-1', 999);
    expect(budget.maxAttempts).toBe(MAX_RETRY_HARD_LIMIT);
  });
});

describe('hasRemainingAttempts', () => {
  it('returns true when attempts < maxAttempts', () => {
    const budget = createRetryBudget('dl-1', 3);
    expect(hasRemainingAttempts(budget)).toBe(true);
  });

  it('returns false when attempts === maxAttempts', () => {
    const budget = createRetryBudget('dl-1', 3);
    budget.attempts = 3;
    expect(hasRemainingAttempts(budget)).toBe(false);
  });
});

describe('consumeAttempt', () => {
  it('increments attempts and returns the current backoff delay', () => {
    const budget = createRetryBudget('dl-1', 3);
    const delay1 = consumeAttempt(budget);
    expect(budget.attempts).toBe(1);
    expect(delay1).toBe(2_000); // DEFAULT_RETRY_BACKOFF_MS

    const delay2 = consumeAttempt(budget);
    expect(budget.attempts).toBe(2);
    expect(delay2).toBe(4_000); // 2000 * 2

    const delay3 = consumeAttempt(budget);
    expect(budget.attempts).toBe(3);
    expect(delay3).toBe(8_000); // 4000 * 2
  });

  it('throws AppError when budget is exhausted', () => {
    const budget = createRetryBudget('dl-1', 1);
    consumeAttempt(budget);
    expect(() => consumeAttempt(budget)).toThrowError(AppError);
  });

  it('caps backoff at MAX_RETRY_BACKOFF_MS', () => {
    const budget = createRetryBudget('dl-1', MAX_RETRY_HARD_LIMIT);
    budget.currentBackoffMs = MAX_RETRY_BACKOFF_MS; // Already at cap
    consumeAttempt(budget);
    expect(budget.currentBackoffMs).toBe(MAX_RETRY_BACKOFF_MS);
  });
});

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(op, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries on recoverable AppError and eventually succeeds', async () => {
    let callCount = 0;
    const op = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new AppError('NETWORK_FAILURE', 'transient');
      }
      return 'success';
    });

    const result = await withRetry(op, {
      maxAttempts: 3,
      initialBackoffMs: 1, // Fast for tests
    });
    expect(result).toBe('success');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-recoverable AppError', async () => {
    const op = vi.fn().mockRejectedValue(new AppError('DEPENDENCY_MISSING', 'no dep'));
    await expect(withRetry(op, { maxAttempts: 3, initialBackoffMs: 1 })).rejects.toThrow(AppError);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-AppError throws', async () => {
    const op = vi.fn().mockRejectedValue(new Error('unexpected'));
    await expect(withRetry(op, { maxAttempts: 3, initialBackoffMs: 1 })).rejects.toThrow(
      'unexpected',
    );
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('exhausts all attempts and throws the last error', async () => {
    const op = vi.fn().mockRejectedValue(new AppError('NETWORK_FAILURE', 'always fails'));
    await expect(withRetry(op, { maxAttempts: 3, initialBackoffMs: 1 })).rejects.toThrow(AppError);
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('calls onRetry with attempt number on each retry', async () => {
    const onRetry = vi.fn();
    const op = vi.fn().mockRejectedValue(new AppError('NETWORK_FAILURE', 'fail'));
    await expect(withRetry(op, { maxAttempts: 3, initialBackoffMs: 1, onRetry })).rejects.toThrow();
    // onRetry is called between attempts 1→2 and 2→3 (not after the last failure)
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(AppError));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(AppError));
  });

  it('clamps maxAttempts to MAX_RETRY_HARD_LIMIT', async () => {
    const op = vi.fn().mockRejectedValue(new AppError('NETWORK_FAILURE', 'fail'));
    await expect(withRetry(op, { maxAttempts: 999, initialBackoffMs: 1 })).rejects.toThrow();
    expect(op).toHaveBeenCalledTimes(MAX_RETRY_HARD_LIMIT);
  });
});

describe('delay', () => {
  it('resolves after the specified duration', async () => {
    const start = Date.now();
    await delay(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(10); // Some tolerance
  });

  it('rejects immediately if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(delay(1000, controller.signal)).rejects.toThrow(AppError);
  });

  it('rejects when signal is aborted during wait', async () => {
    const controller = new AbortController();
    const promise = delay(5000, controller.signal);
    setTimeout(() => controller.abort(), 10);
    await expect(promise).rejects.toThrow(AppError);
  });
});

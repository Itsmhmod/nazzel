/**
 * @fileoverview Retry utility with exponential backoff and bounded retry budgets.
 *
 * This is a pure utility — no side effects, no external dependencies.
 * All retry logic in the application must use this module.
 * Never write ad-hoc retry loops elsewhere.
 */

import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BACKOFF_MS,
  MAX_RETRY_BACKOFF_MS,
  MAX_RETRY_HARD_LIMIT,
  RETRY_BACKOFF_MULTIPLIER,
} from '../domain/constants.js';
import { AppError } from '../domain/errors.js';

// ---------------------------------------------------------------------------
// Retry Budget
// ---------------------------------------------------------------------------

export interface RetryBudget {
  readonly downloadId: string;
  readonly maxAttempts: number;
  attempts: number;
  currentBackoffMs: number;
}

/**
 * Create a new retry budget for a download.
 */
export function createRetryBudget(
  downloadId: string,
  maxAttempts: number = DEFAULT_MAX_RETRIES,
): RetryBudget {
  const clamped = Math.min(maxAttempts, MAX_RETRY_HARD_LIMIT);
  return {
    downloadId,
    maxAttempts: clamped,
    attempts: 0,
    currentBackoffMs: DEFAULT_RETRY_BACKOFF_MS,
  };
}

/**
 * Returns true if the budget has remaining attempts.
 */
export function hasRemainingAttempts(budget: RetryBudget): boolean {
  return budget.attempts < budget.maxAttempts;
}

/**
 * Advance the budget by one attempt, updating the backoff delay.
 * Returns the delay to wait before the next attempt.
 * Throws if the budget is exhausted.
 */
export function consumeAttempt(budget: RetryBudget): number {
  if (!hasRemainingAttempts(budget)) {
    throw new AppError(
      'NETWORK_FAILURE',
      `Retry budget exhausted for download ${budget.downloadId} after ${budget.attempts} attempts`,
    );
  }

  const delay = budget.currentBackoffMs;
  budget.attempts += 1;
  budget.currentBackoffMs = Math.min(
    budget.currentBackoffMs * RETRY_BACKOFF_MULTIPLIER,
    MAX_RETRY_BACKOFF_MS,
  );

  return delay;
}

// ---------------------------------------------------------------------------
// Async retry executor
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Max number of attempts (default: DEFAULT_MAX_RETRIES) */
  maxAttempts?: number;
  /** Initial backoff in ms (default: DEFAULT_RETRY_BACKOFF_MS) */
  initialBackoffMs?: number;
  /** Called before each retry with the attempt number and last error */
  onRetry?: (attempt: number, error: AppError) => void;
  /** AbortSignal to cancel waiting */
  signal?: AbortSignal;
}

/**
 * Execute an async operation with bounded exponential backoff retry.
 *
 * Only retries if the thrown error is an AppError with recoverable=true.
 * Non-recoverable errors and non-AppError throws propagate immediately.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.min(options.maxAttempts ?? DEFAULT_MAX_RETRIES, MAX_RETRY_HARD_LIMIT);
  let backoffMs = options.initialBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      if (!AppError.is(err)) {
        // Unknown error type — do not retry, propagate as-is
        throw err;
      }
      if (!err.recoverable) {
        throw err;
      }

      lastError = err;

      if (attempt < maxAttempts) {
        options.onRetry?.(attempt, err);
        await delay(backoffMs, options.signal);
        backoffMs = Math.min(backoffMs * RETRY_BACKOFF_MULTIPLIER, MAX_RETRY_BACKOFF_MS);
      }
    }
  }

  // All attempts exhausted
  throw lastError ?? new AppError('NETWORK_FAILURE', 'Retry exhausted with no captured error');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Promise-based sleep that respects an AbortSignal.
 */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AppError('CANCELLED', 'Delay cancelled: signal already aborted'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new AppError('CANCELLED', 'Delay cancelled by abort signal'));
      },
      { once: true },
    );
  });
}

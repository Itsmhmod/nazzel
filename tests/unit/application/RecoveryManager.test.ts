import { describe, it, expect, beforeEach } from 'vitest';
import { RecoveryManager } from '../../../src/application/RecoveryManager.js';
import { AppError } from '../../../src/domain/errors.js';

describe('RecoveryManager', () => {
  let manager: RecoveryManager;

  beforeEach(() => {
    manager = new RecoveryManager();
  });

  it('evaluates non-recoverable error as NONE', () => {
    const error = new AppError('FORMAT_UNAVAILABLE', 'Format not found');
    const plan = manager.evaluateError('dl-1', error, 3, 1000);

    expect(plan.action).toBe('NONE');
    expect(plan.attempt).toBe(0);
  });

  it('evaluates NETWORK_FAILURE as WAIT_THEN_RETRY with full budget', () => {
    const error = new AppError('NETWORK_FAILURE', 'Connection lost');
    const plan = manager.evaluateError('dl-2', error, 3, 1000);

    expect(plan.action).toBe('WAIT_THEN_RETRY');
    expect(plan.maxAttempts).toBe(3);
    expect(plan.delayMs).toBe(1000);
  });

  it('exhausts budget after reaching max retries', () => {
    const error = new AppError('NETWORK_FAILURE', 'Connection lost');

    manager.recordAttempt('dl-3', 1000);
    manager.recordAttempt('dl-3', 1000);
    manager.recordAttempt('dl-3', 1000); // 3 attempts made

    const plan = manager.evaluateError('dl-3', error, 3, 1000);
    expect(plan.action).toBe('NONE');
    expect(plan.attempt).toBe(3);
  });

  it('applies exponential backoff on subsequent attempts', () => {
    const error = new AppError('NETWORK_FAILURE', 'Connection lost');

    let plan = manager.evaluateError('dl-4', error, 3, 1000);
    expect(plan.delayMs).toBe(1000);

    manager.recordAttempt('dl-4', 1000);
    plan = manager.evaluateError('dl-4', error, 3, 1000);
    expect(plan.delayMs).toBe(2000);

    manager.recordAttempt('dl-4', 1000);
    plan = manager.evaluateError('dl-4', error, 3, 1000);
    expect(plan.delayMs).toBe(4000);
  });

  it('caps backoff at 30 seconds', () => {
    const error = new AppError('NETWORK_FAILURE', 'Connection lost');
    manager.recordAttempt('dl-5', 20000); // Attempt 1, next backoff 40000

    const plan = manager.evaluateError('dl-5', error, 3, 20000);
    expect(plan.delayMs).toBe(30000); // Capped
  });

  it('evaluates EXTRACTOR_FAILURE as UPDATE_DEP_THEN_RETRY with capped attempts', () => {
    const error = new AppError('EXTRACTOR_FAILURE', 'Extractor failed');

    const plan = manager.evaluateError('dl-6', error, 5, 1000);

    expect(plan.action).toBe('UPDATE_DEP_THEN_RETRY');
    expect(plan.maxAttempts).toBe(1); // Capped at 1 for this specific error

    manager.recordAttempt('dl-6', 1000);

    const exhaustedPlan = manager.evaluateError('dl-6', error, 5, 1000);
    expect(exhaustedPlan.action).toBe('NONE');
  });

  it('resets budget successfully', () => {
    const error = new AppError('NETWORK_FAILURE', 'Connection lost');

    manager.recordAttempt('dl-7', 1000);
    manager.recordAttempt('dl-7', 1000);

    manager.reset('dl-7');

    const plan = manager.evaluateError('dl-7', error, 3, 1000);
    expect(plan.attempt).toBe(1);
    expect(plan.delayMs).toBe(1000);
  });
});

import type { AppError } from '@nazzel/domain/errors.js';

export type RecoveryAction = 'NONE' | 'WAIT_THEN_RETRY' | 'UPDATE_DEP_THEN_RETRY';

export interface RecoveryPlan {
  readonly action: RecoveryAction;
  readonly delayMs: number;
  readonly attempt: number;
  readonly maxAttempts: number;
}

interface RetryBudget {
  attempts: number;
  currentBackoffMs: number;
}

export class RecoveryManager {
  private budgets = new Map<string, RetryBudget>();

  /**
   * Evaluates an error and returns a deterministic RecoveryPlan.
   * Does NOT execute the recovery itself.
   */
  evaluateError(
    downloadId: string,
    error: AppError,
    configMaxRetries: number,
    configBackoffMs: number,
  ): RecoveryPlan {
    const budget = this.getOrCreateBudget(downloadId, configBackoffMs);

    if (!error.recoverable) {
      return this.createNonePlan(budget, configMaxRetries);
    }

    // Determine specific constraints based on error code
    let allowedRetries = configMaxRetries;
    let action: RecoveryAction = 'WAIT_THEN_RETRY';

    switch (error.code) {
      case 'PROCESS_CRASH':
        allowedRetries = Math.min(2, configMaxRetries);
        break;
      case 'EXTRACTOR_FAILURE':
        allowedRetries = Math.min(1, configMaxRetries);
        action = 'UPDATE_DEP_THEN_RETRY';
        break;
      case 'DEPENDENCY_OUTDATED':
        allowedRetries = Math.min(1, configMaxRetries);
        action = 'UPDATE_DEP_THEN_RETRY';
        break;
      case 'VERIFY_FAILURE':
        allowedRetries = Math.min(1, configMaxRetries);
        break;
      case 'NETWORK_FAILURE':
        // Uses the full config budget
        break;
      default:
        // Any unknown recoverable error uses the full config budget
        break;
    }

    if (budget.attempts >= allowedRetries) {
      return this.createNonePlan(budget, allowedRetries);
    }

    const plan: RecoveryPlan = {
      action,
      delayMs: budget.currentBackoffMs,
      attempt: budget.attempts + 1,
      maxAttempts: allowedRetries,
    };

    return plan;
  }

  /**
   * Called by the orchestrator after deciding to proceed with the recovery plan.
   * Increments the attempt counter and scales the backoff.
   */
  recordAttempt(downloadId: string, configBackoffMs: number): void {
    const budget = this.getOrCreateBudget(downloadId, configBackoffMs);
    budget.attempts += 1;
    budget.currentBackoffMs = Math.min(budget.currentBackoffMs * 2, 30_000); // Max backoff 30s
  }

  /**
   * Resets the budget for a given download.
   */
  reset(downloadId: string): void {
    this.budgets.delete(downloadId);
  }

  private getOrCreateBudget(downloadId: string, initialBackoffMs: number): RetryBudget {
    let budget = this.budgets.get(downloadId);
    if (!budget) {
      budget = { attempts: 0, currentBackoffMs: initialBackoffMs };
      this.budgets.set(downloadId, budget);
    }
    return budget;
  }

  private createNonePlan(budget: RetryBudget, maxAttempts: number): RecoveryPlan {
    return {
      action: 'NONE',
      delayMs: 0,
      attempt: budget.attempts,
      maxAttempts,
    };
  }
}

import { isMatching, P } from 'ts-pattern';

import { RETRY_DELAY_MINUTES } from 'domains/run/constants';
import type { RunRecord, RunRetry } from 'domains/run/types';

export const RETRY_TEXT =
  'Your last attempt stopped with an error. Continue the task from where you stopped.';

export interface AttemptEnd {
  outcome: Partial<RunRecord>;
  // false for a stop that would come again, such as a missing cwd, a budget or a usage limit.
  canRetry: boolean;
}

interface RetryPlan {
  attempt: number;
  retries: number;
  error: string;
  continuesSession: boolean;
}

export function checkShouldRetry(end: AttemptEnd, attempt: number, retries: number): boolean {
  return (
    end.canRetry &&
    attempt <= retries &&
    isMatching({ status: P.union('failed', 'timed_out') }, end.outcome)
  );
}

export function planRetry(plan: RetryPlan, now: Date = new Date()): RunRetry {
  return {
    attempt: plan.attempt + 1,
    attempts: plan.retries + 1,
    error: plan.error,
    stoppedAt: now.toISOString(),
    continuesAt: new Date(now.getTime() + RETRY_DELAY_MINUTES * 60_000).toISOString(),
    continuesSession: plan.continuesSession,
  };
}

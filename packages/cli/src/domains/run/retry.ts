import { isMatching, P } from 'ts-pattern';

import { RETRY_DELAY_MINUTES } from 'domains/run/constants';
import type { RunRecord, RunRetry, TokenCounts } from 'domains/run/types';
import { formatTokenLimit, getTokenTotal } from 'domains/run/utils';

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

// Each agent process counts only its own spend, so the next attempt gets what the run has left.
export function getBudgetLeft(maxBudgetUsd: number | null, costUsd: number | null): number | null {
  return maxBudgetUsd === null ? null : maxBudgetUsd - (costUsd ?? 0);
}

export interface TokenBudget {
  total: number;
  left: number;
}

export function getTokenBudget(maxBudgetTokens: number | null): TokenBudget | null {
  return maxBudgetTokens === null ? null : { total: maxBudgetTokens, left: maxBudgetTokens };
}

export function spendTokens(
  budget: TokenBudget | null,
  tokens: TokenCounts | null,
): TokenBudget | null {
  return budget === null
    ? null
    : { ...budget, left: budget.left - (tokens === null ? 0 : getTokenTotal(tokens)) };
}

export function getTokenBudgetError(maxBudgetTokens: number): string {
  return `Reached the budget of ${formatTokenLimit(maxBudgetTokens)} tokens`;
}

export function checkShouldRetry(
  end: AttemptEnd,
  attempt: number,
  retries: number,
  budgetLeft: number | null,
  tokenBudget: TokenBudget | null,
): boolean {
  return (
    end.canRetry &&
    attempt <= retries &&
    (budgetLeft === null || budgetLeft > 0) &&
    (tokenBudget === null || tokenBudget.left > 0) &&
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

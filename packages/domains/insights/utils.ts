import { isMatching, P } from 'ts-pattern';

import type { RoutineName } from '../routine/ids';
import type { RunRecord } from '../run/types';
import {
  formatTokenShare,
  getRunDurationMs,
  getTokenTotal,
  getTokenUsageDates,
  getTokenUsageStart,
  toLocalDate,
} from '../run/utils';
import { INSIGHTS_PERIODS } from './constants';
import { insightsPeriodSchema } from './schemas';
import type { Insights, InsightsPeriod, InsightsRoutine, InsightsTotals } from './types';

const changeFormatter = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

export function checkIsRunFinished(run: Pick<RunRecord, 'status'>): boolean {
  return isMatching({ status: P.union('succeeded', 'failed', 'timed_out', 'aborted') }, run);
}

export function checkIsRunFailed(run: Pick<RunRecord, 'status'>): boolean {
  return isMatching({ status: P.union('failed', 'timed_out', 'aborted') }, run);
}

// Without days the period is the first one. Anything else is not a period.
export function parseInsightsPeriod(params: URLSearchParams): InsightsPeriod | null {
  const days = params.get('days');
  if (days === null) return INSIGHTS_PERIODS[0];
  const parsed = insightsPeriodSchema.safeParse(Number(days));
  return parsed.success ? parsed.data : null;
}

function sumRuns(runs: RunRecord[]): InsightsTotals {
  let finished = 0;
  let failed = 0;
  let tokens = 0;
  let runMs = 0;
  for (const run of runs) {
    if (run.tokens !== null) tokens += getTokenTotal(run.tokens);
    if (!checkIsRunFinished(run)) continue;
    finished += 1;
    runMs += getRunDurationMs(run);
    if (checkIsRunFailed(run)) failed += 1;
  }
  return {
    runs: runs.length,
    finished,
    failed,
    tokens,
    averageRunMs: finished === 0 ? null : Math.round(runMs / finished),
  };
}

function groupByRoutine(runs: RunRecord[]): Map<RoutineName, RunRecord[]> {
  const groups = new Map<RoutineName, RunRecord[]>();
  for (const run of runs) {
    const group = groups.get(run.routine);
    if (group === undefined) groups.set(run.routine, [run]);
    else group.push(run);
  }
  return groups;
}

function compareRoutines(a: InsightsRoutine, b: InsightsRoutine): number {
  return (
    (b.tokens ?? -1) - (a.tokens ?? -1) || b.runs - a.runs || a.routine.localeCompare(b.routine)
  );
}

function listRoutines(runs: RunRecord[], allTokens: number): InsightsRoutine[] {
  return [...groupByRoutine(runs)]
    .map(([routine, group]): InsightsRoutine => {
      const totals = sumRuns(group);
      const hasTokens = group.some(run => run.tokens !== null);
      return {
        ...totals,
        routine,
        tokens: hasTokens ? totals.tokens : null,
        share: allTokens === 0 ? 0 : totals.tokens / allTokens,
      };
    })
    .sort(compareRoutines);
}

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() - days);
  return shifted;
}

// The runs that started today and the days before it, by day in the local time zone. Today has not
// ended yet, so the period before stops at this time of day too, to compare like with like.
export function buildInsights(runs: RunRecord[], days: InsightsPeriod, now: Date): Insights {
  const start = getTokenUsageStart(now, days).getTime();
  const previousStart = getTokenUsageStart(now, days * 2).getTime();
  const previousEnd = shiftDays(now, days).getTime();
  const current: RunRecord[] = [];
  const previous: RunRecord[] = [];
  for (const run of runs) {
    const startedAt = new Date(run.startedAt).getTime();
    if (startedAt >= start) current.push(run);
    else if (startedAt >= previousStart && startedAt < previousEnd) previous.push(run);
  }
  const dates = getTokenUsageDates(now, days);
  const daily = dates.map(date => ({ date, runs: 0, failed: 0, tokens: 0 }));
  const dayIndexes = new Map(dates.map((date, index) => [date, index]));
  for (const run of current) {
    const day = daily[dayIndexes.get(toLocalDate(new Date(run.startedAt))) ?? -1];
    if (day === undefined) continue;
    day.runs += 1;
    if (checkIsRunFailed(run)) day.failed += 1;
    if (run.tokens !== null) day.tokens += getTokenTotal(run.tokens);
  }
  const currentTotals = sumRuns(current);
  return {
    days,
    current: currentTotals,
    previous: sumRuns(previous),
    daily,
    routines: listRoutines(current, currentTotals.tokens),
  };
}

export function formatInsightsChange(
  current: number,
  previous: number | null,
  days: InsightsPeriod,
): string {
  const before = `prior ${days} days`;
  if (previous === null || previous === 0) return `None in ${before}`;
  const change = changeFormatter.format((current - previous) / previous);
  return change === '0%' ? `Same as ${before}` : `${change} vs ${before}`;
}

export function formatFailedShare({ failed, finished }: InsightsTotals): string {
  return finished === 0
    ? 'No finished runs'
    : `${formatTokenShare(failed / finished)} of finished runs`;
}

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from '../run/ids';
import { makeRunRecord } from '../run/mocks';
import type { RunRecord, RunStatus, TokenCounts } from '../run/types';
import {
  buildInsights,
  formatFailedShare,
  formatInsightsChange,
  parseInsightsPeriod,
} from './utils';

const NOW = new Date(2026, 10, 25, 12, 0);
const MINUTE_MS = 60_000;

const tokens = (total: number): TokenCounts => ({
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: total,
});

let runCount = 0;

function run(
  routine: string,
  daysAgo: number,
  status: RunStatus,
  total: number | null,
  minutes = 10,
  hour = 9,
): RunRecord {
  const startedAt = new Date(2026, 10, 25 - daysAgo, hour, 0);
  runCount += 1;
  return makeRunRecord({
    id: runIdSchema.parse(`run-${runCount}`),
    routine: routineNameSchema.parse(routine),
    startedAt: startedAt.toISOString(),
    endedAt: new Date(startedAt.getTime() + minutes * MINUTE_MS).toISOString(),
    status,
    tokens: total === null ? null : tokens(total),
  });
}

test('sums the runs of the period and of the days before it apart', () => {
  const insights = buildInsights(
    [
      run('triage', 0, 'succeeded', 300, 10),
      run('triage', 6, 'failed', 100, 20),
      run('triage', 7, 'succeeded', 50),
      run('triage', 13, 'timed_out', 50),
      run('triage', 14, 'succeeded', 999),
    ],
    7,
    NOW,
  );

  assert.deepEqual(insights.current, {
    runs: 2,
    finished: 2,
    failed: 1,
    tokens: 400,
    averageRunMs: 15 * MINUTE_MS,
  });
  assert.deepEqual(insights.previous, {
    runs: 2,
    finished: 2,
    failed: 1,
    tokens: 100,
    averageRunMs: 10 * MINUTE_MS,
  });
});

test('compares today so far with the same hours of the day it is compared with', () => {
  const insights = buildInsights(
    [run('triage', 7, 'succeeded', 50, 10, 11), run('triage', 7, 'succeeded', 70, 10, 15)],
    7,
    NOW,
  );

  assert.equal(insights.previous.runs, 1);
  assert.equal(insights.previous.tokens, 50);
});

test('counts a run at work in the runs, but not in the failed or the average run', () => {
  const working = { ...run('triage', 0, 'running', null), endedAt: null };
  const insights = buildInsights([working, run('triage', 0, 'aborted', null, 4)], 7, NOW);

  assert.equal(insights.current.runs, 2);
  assert.equal(insights.current.finished, 1);
  assert.equal(insights.current.failed, 1);
  assert.equal(insights.current.averageRunMs, 4 * MINUTE_MS);
});

test('puts each run on the day it started, oldest day first', () => {
  const insights = buildInsights(
    [
      run('triage', 0, 'succeeded', 300),
      run('triage', 0, 'failed', 100),
      run('triage', 29, 'succeeded', 50),
    ],
    30,
    NOW,
  );

  assert.equal(insights.daily.length, 30);
  assert.deepEqual(insights.daily[0], { date: '2026-10-27', runs: 1, failed: 0, tokens: 50 });
  assert.deepEqual(insights.daily.at(-1), { date: '2026-11-25', runs: 2, failed: 1, tokens: 400 });
  assert.equal(
    insights.daily.slice(1, -1).every(day => day.runs === 0),
    true,
  );
});

test('lists routines by tokens, then by runs, with their share of all tokens', () => {
  const insights = buildInsights(
    [
      run('release-notes', 1, 'succeeded', 100),
      run('triage', 1, 'succeeded', 200),
      run('triage', 2, 'failed', 100),
      run('disk-cleanup', 1, 'succeeded', null),
      run('disk-cleanup', 2, 'succeeded', null),
      run('backup', 1, 'succeeded', null),
      run('old-routine', 10, 'succeeded', 5000),
    ],
    7,
    NOW,
  );

  assert.deepEqual(
    insights.routines.map(({ routine, tokens, share, runs, failed }) => ({
      routine,
      tokens,
      share,
      runs,
      failed,
    })),
    [
      { routine: 'triage', tokens: 300, share: 0.75, runs: 2, failed: 1 },
      { routine: 'release-notes', tokens: 100, share: 0.25, runs: 1, failed: 0 },
      { routine: 'disk-cleanup', tokens: null, share: 0, runs: 2, failed: 0 },
      { routine: 'backup', tokens: null, share: 0, runs: 1, failed: 0 },
    ],
  );
});

test('reads the period from days, the first one when it is missing', () => {
  assert.equal(parseInsightsPeriod(new URLSearchParams()), 7);
  assert.equal(parseInsightsPeriod(new URLSearchParams('days=30')), 30);
  assert.equal(parseInsightsPeriod(new URLSearchParams('days=14')), null);
  assert.equal(parseInsightsPeriod(new URLSearchParams('days=abc')), null);
});

test('compares with the days before only when they had any', () => {
  assert.equal(formatInsightsChange(118, 100, 7), '+18% vs prior 7 days');
  assert.equal(formatInsightsChange(50, 100, 30), '-50% vs prior 30 days');
  assert.equal(formatInsightsChange(1001, 1000, 7), 'Same as prior 7 days');
  assert.equal(formatInsightsChange(10, 0, 7), 'None in prior 7 days');
  assert.equal(formatInsightsChange(10, null, 7), 'None in prior 7 days');
});

test('tells the share of finished runs that failed', () => {
  const totals = { runs: 3, finished: 0, failed: 0, tokens: 0, averageRunMs: null };
  assert.equal(formatFailedShare(totals), 'No finished runs');
  assert.equal(formatFailedShare({ ...totals, finished: 4, failed: 1 }), '25% of finished runs');
  assert.equal(formatFailedShare({ ...totals, finished: 400, failed: 1 }), '<1% of finished runs');
});

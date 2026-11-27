import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from './ids';
import { makeRunRecord } from './mocks';
import type { ChainCondition, RunRecord, RunsPage } from './types';
import {
  buildTokenUsages,
  checkHasNothingToReport,
  checkIsRunActive,
  checkIsRunAtWork,
  checkMeetsChainCondition,
  decodeRunsCursor,
  encodeRunsCursor,
  filterRuns,
  findExpiredRuns,
  getBudgetLabel,
  getRunDurationMs,
  getRunStatusTone,
  getTokenUsageDates,
  listBlockedRules,
  mergeBlockedActions,
  getCheckoutCwd,
  getWorktreeBaseStep,
  getWorktreeChangesLabel,
  paginateRuns,
  parseRunsPageQuery,
  parseTokenCount,
} from './utils';

const run = (routine: string, minute: number, id = `run-${minute}`): RunRecord =>
  makeRunRecord({
    id: runIdSchema.parse(id),
    routine: routineNameSchema.parse(routine),
    startedAt: new Date(Date.UTC(2026, 10, 10, 9, minute)).toISOString(),
  });

const toIds = (runs: RunRecord[]) => runs.map(({ routine, id }) => `${routine}/${id}`);

function readNextPage(runs: RunRecord[], page: RunsPage): RunsPage {
  assert.notEqual(page.nextCursor, null);
  return paginateRuns(runs, decodeRunsCursor(page.nextCursor ?? ''), 2);
}

test('pages through runs newest first, with ties in a fixed order', () => {
  const runs = [run('b', 3), run('a', 3, 'run-3x'), run('a', 3), run('a', 2), run('b', 1)];

  const first = paginateRuns(runs, null, 2);
  const second = readNextPage(runs, first);
  const third = readNextPage(runs, second);

  assert.deepEqual(toIds(first.runs), ['b/run-3', 'a/run-3x']);
  assert.deepEqual(toIds(second.runs), ['a/run-3', 'a/run-2']);
  assert.deepEqual(toIds(third.runs), ['b/run-1']);
  assert.equal(third.nextCursor, null);
  assert.equal(first.total, 5);
});

test('new runs do not shift the pages after a cursor', () => {
  const runs = [run('a', 4), run('a', 3), run('a', 2), run('a', 1)];
  const first = paginateRuns(runs, null, 2);

  const second = readNextPage([run('a', 6), run('a', 5), ...runs], first);

  assert.deepEqual(toIds(second.runs), ['a/run-2', 'a/run-1']);
  assert.equal(second.total, 6);
});

test('reads the page query and rejects a cursor it cannot use', () => {
  const cursor = encodeRunsCursor(run('daily-digest', 7));

  assert.deepEqual(parseRunsPageQuery(new URLSearchParams({ routine: 'daily-digest', cursor })), {
    routine: 'daily-digest',
    cursor: { startedAt: '2026-11-10T09:07:00.000Z', routine: 'daily-digest', id: 'run-7' },
    search: null,
  });
  assert.deepEqual(parseRunsPageQuery(new URLSearchParams({ q: '  flaky test ' })), {
    routine: null,
    cursor: null,
    search: 'flaky test',
  });
  assert.deepEqual(parseRunsPageQuery(new URLSearchParams({ q: ' ' })), {
    routine: null,
    cursor: null,
    search: null,
  });
  assert.equal(parseRunsPageQuery(new URLSearchParams({ cursor: 'not-a-cursor' })), null);
  assert.equal(parseRunsPageQuery(new URLSearchParams({ cursor: '{"id":"run-7"}' })), null);
});

test('filters runs by their routine, id, status, trigger, model, result and error', () => {
  const runs = [
    { ...run('daily-digest', 3), resultText: 'Posted the digest to Slack' },
    { ...run('fix-e2e-tests', 2), status: 'failed' as const, error: 'Exit code 1' },
    { ...run('triage-sentry', 1), trigger: 'webhook' as const, model: 'sonnet' },
  ];

  assert.deepEqual(toIds(filterRuns(runs, 'slack')), ['daily-digest/run-3']);
  assert.deepEqual(toIds(filterRuns(runs, 'failed exit')), ['fix-e2e-tests/run-2']);
  assert.deepEqual(toIds(filterRuns(runs, 'WEBHOOK sonnet')), ['triage-sentry/run-1']);
  assert.deepEqual(toIds(filterRuns(runs, 'run-2')), ['fix-e2e-tests/run-2']);
  assert.deepEqual(filterRuns(runs, 'email'), []);
  assert.equal(filterRuns(runs, null), runs);
});

test('a run is active while it runs and while it replies to a message', () => {
  assert.equal(checkIsRunActive(makeRunRecord({ status: 'running' })), true);
  assert.equal(checkIsRunActive(makeRunRecord({ status: 'succeeded', replyPid: 42 })), true);
  assert.equal(checkIsRunActive(makeRunRecord({ status: 'failed' })), false);
});

test('a run that waits for a usage limit or its next attempt is active but not at work', () => {
  assert.equal(checkIsRunActive(makeRunRecord({ status: 'waiting' })), true);
  assert.equal(checkIsRunAtWork(makeRunRecord({ status: 'waiting' })), false);
  assert.equal(checkIsRunActive(makeRunRecord({ status: 'retrying' })), true);
  assert.equal(checkIsRunAtWork(makeRunRecord({ status: 'retrying' })), false);
  assert.equal(checkIsRunAtWork(makeRunRecord({ status: 'succeeded', replyPid: 42 })), true);
});

test('a status has the tone of its outcome, and both kinds of failure share one', () => {
  assert.equal(getRunStatusTone('succeeded'), 'positive');
  assert.equal(getRunStatusTone('failed'), getRunStatusTone('timed_out'));
  assert.equal(getRunStatusTone('waiting'), getRunStatusTone('retrying'));
  assert.equal(getRunStatusTone('aborted'), 'ghost');
});

test('a running run lasts until now, and one that started after now has lasted nothing yet', () => {
  const startedAt = '2026-11-10T09:00:00.000Z';
  const now = Date.parse(startedAt);
  assert.equal(getRunDurationMs({ startedAt, endedAt: null }, now + 90_000), 90_000);
  assert.equal(getRunDurationMs({ startedAt, endedAt: null }, now - 700), 0);
});

test('expires runs older than the retention but keeps active runs and the newest of each routine', () => {
  const now = new Date(Date.UTC(2026, 10, 20, 9));
  const daysAgo = (routine: string, days: number, overrides: Partial<RunRecord> = {}) =>
    makeRunRecord({
      id: runIdSchema.parse(`run-${days}`),
      routine: routineNameSchema.parse(routine),
      startedAt: new Date(now.getTime() - days * 86_400_000).toISOString(),
      status: 'succeeded',
      ...overrides,
    });
  const runs = [
    daysAgo('a', 1),
    daysAgo('a', 8),
    daysAgo('a', 9, { status: 'running' }),
    daysAgo('a', 10, { replyPid: 42 }),
    daysAgo('a', 6),
    daysAgo('b', 20),
    daysAgo('b', 30),
  ];

  assert.deepEqual(toIds(findExpiredRuns(runs, 7, now)), ['a/run-8', 'b/run-30']);
});

const tokens = (cacheRead: number) => ({ input: 1, output: 2, cacheWrite: 3, cacheRead });

const runOn = (day: number, cacheRead: number | null, hour = 12): RunRecord =>
  makeRunRecord({
    startedAt: new Date(2026, 10, day, hour).toISOString(),
    tokens: cacheRead === null ? null : tokens(cacheRead),
  });

test("sums the tokens of the last 7 days by local day, with each routine's share", () => {
  const now = new Date(2026, 10, 20, 15);
  const [night, release, shell] = buildTokenUsages(
    [
      [runOn(20, 94), runOn(20, 194, 0), runOn(14, 44), runOn(13, 9994, 23), runOn(19, null)],
      [runOn(17, 1044)],
      [runOn(18, null)],
    ],
    now,
  );

  const dates = getTokenUsageDates(now);
  assert.deepEqual(dates, [
    '2026-11-14',
    '2026-11-15',
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
  ]);
  assert.deepEqual(night, {
    runs: 3,
    counts: { input: 3, output: 6, cacheWrite: 9, cacheRead: 332 },
    days: [50, 0, 0, 0, 0, 0, 300].map((total, index) => ({ date: dates[index], total })),
    share: 0.25,
  });
  assert.equal(release?.share, 0.75);
  assert.equal(shell, null);
});

test('reads a count of tokens written in full or with k, M or B', () => {
  assert.equal(parseTokenCount('3000000'), 3_000_000);
  assert.equal(parseTokenCount('500k'), 500_000);
  assert.equal(parseTokenCount('2M'), 2_000_000);
  assert.equal(parseTokenCount(' 1.5 m '), 1_500_000);
  assert.equal(parseTokenCount('1b'), 1_000_000_000);
  for (const value of ['', '0', '0k', '-5k', '2 million', '1,000', '1T', 'k']) {
    assert.equal(parseTokenCount(value), null, value);
  }
});

test('a budget says its dollars, its tokens or both, and a token limit never reads rounded', () => {
  assert.equal(getBudgetLabel(null, null), null);
  assert.equal(getBudgetLabel(2, null), '$2.00');
  assert.equal(getBudgetLabel(null, 2_000_000), '2M tokens');
  assert.equal(getBudgetLabel(1.5, 750_000), '$1.50 or 750K tokens');
  assert.equal(getBudgetLabel(null, 1_250_000), '1.25M tokens');
  assert.equal(getBudgetLabel(null, 1_234_567), '1,234,567 tokens');
});

test('merging blocked actions keeps one of each action and one of each rule', () => {
  const push = { tool: 'Bash', preview: 'git push', rules: ['Bash(git push *)'] };
  const forcePush = { tool: 'Bash', preview: 'git push --force', rules: ['Bash(git push *)'] };
  const fetch = {
    tool: 'WebFetch',
    preview: 'https://acme.dev',
    rules: ['WebFetch(domain:acme.dev)'],
  };

  const merged = mergeBlockedActions([push], [push, forcePush, fetch, forcePush]);

  assert.deepEqual(merged, [push, forcePush, fetch]);
  assert.deepEqual(mergeBlockedActions([], [push, push]), [push]);
  assert.deepEqual(listBlockedRules(merged), ['Bash(git push *)', 'WebFetch(domain:acme.dev)']);
});

test('the changes of a worktree say how many files changed and what is not committed', () => {
  const label = (fileCount: number, commits: number, uncommitted: number) =>
    getWorktreeChangesLabel({ files: [], fileCount, added: 0, removed: 0, commits, uncommitted });
  assert.equal(label(0, 0, 0), 'No changes');
  assert.equal(label(0, 2, 0), 'No changes in 2 commits');
  assert.equal(label(1, 1, 0), '1 file changed in 1 commit');
  assert.equal(label(2, 0, 2), '2 files changed, not committed');
  assert.equal(label(3, 2, 1), '3 files changed in 2 commits, 1 not committed');
});

test('the cwd of a worktree run maps back to the same folder in the checkout', () => {
  const worktree = {
    branch: 'kombinat/fixer-20261117T090000Z-wtre',
    path: '/state/worktrees/fixer/20261117T090000Z-wtre',
    checkout: '/code/shop',
    base: 'origin/main',
    baseCommit: '3f2a1bc',
    changes: null,
    state: 'removed' as const,
  };
  assert.equal(
    getCheckoutCwd({ ...worktree, cwd: `${worktree.path}/apps/web` }),
    '/code/shop/apps/web',
  );
  assert.equal(getCheckoutCwd({ ...worktree, cwd: worktree.path }), '/code/shop');
});

test('a change reaches the next worktrees by the step their base needs', () => {
  const worktree = {
    branch: 'kombinat/fixer-20261117T090000Z-wtre',
    path: '/state/worktrees/fixer/20261117T090000Z-wtre',
    cwd: '/state/worktrees/fixer/20261117T090000Z-wtre',
    checkout: '/code/shop',
    baseCommit: '3f2a1bc9d8e7f60512a4b3c2d1e0f9a8b7c6d5e4',
    changes: null,
    state: 'present' as const,
  };
  assert.deepEqual(getWorktreeBaseStep({ ...worktree, base: 'origin/main' }), {
    verb: 'push',
    branch: 'origin/main',
  });
  assert.deepEqual(getWorktreeBaseStep({ ...worktree, base: 'feature/totals' }), {
    verb: 'commit',
    branch: 'feature/totals',
  });
  assert.deepEqual(getWorktreeBaseStep({ ...worktree, base: '3f2a1bc' }), {
    verb: 'commit',
    branch: null,
  });
});

test('a result reports nothing when it starts with the word no or nothing', () => {
  assert.equal(checkHasNothingToReport('Nothing to report.'), true);
  assert.equal(checkHasNothingToReport('**No** pull requests wait for my review.'), true);
  assert.equal(checkHasNothingToReport('Notified #product about 3 signals.'), false);
  assert.equal(checkHasNothingToReport('Fixed #331. No tests failed.'), false);
});

test('the routine after a run starts only when the run ended as its condition asks', () => {
  const ended = (overrides: Partial<RunRecord>) =>
    makeRunRecord({ status: 'succeeded', resultText: 'Opened 2 pull requests.', ...overrides });
  const findings = ended({});
  const quiet = ended({ resultText: 'Nothing to review.' });
  const blocked = ended({ blockedActions: [{ tool: 'Bash', preview: 'git push', rules: [] }] });
  const failed = ended({ status: 'failed', resultText: null });
  const timedOut = ended({ status: 'timed_out' });
  const waiting = ended({ status: 'waiting' });
  const meeting = (condition: ChainCondition) =>
    [findings, quiet, blocked, failed, timedOut, waiting].map(candidate =>
      checkMeetsChainCondition(candidate, condition),
    );

  assert.deepEqual(meeting('finishes'), [true, true, true, true, true, false]);
  assert.deepEqual(meeting('succeeds'), [true, true, true, false, false, false]);
  assert.deepEqual(meeting('fails'), [false, false, false, true, true, false]);
  assert.deepEqual(meeting('has-findings'), [true, false, false, false, false, false]);
});

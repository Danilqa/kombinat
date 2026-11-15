import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from './ids';
import { makeRunRecord } from './mocks';
import type { RunRecord, RunsPage } from './types';
import {
  decodeRunsCursor,
  encodeRunsCursor,
  filterRuns,
  paginateRuns,
  parseRunsPageQuery,
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

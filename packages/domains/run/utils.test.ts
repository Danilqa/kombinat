import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema, runIdSchema } from '../id/schemas';
import { makeRunRecord } from './mocks';
import type { RunRecord, RunsPage } from './types';
import { decodeRunsCursor, encodeRunsCursor, paginateRuns, parseRunsPageQuery } from './utils';

const run = (routine: string, minute: number, id = `run-${minute}`): RunRecord =>
  makeRunRecord({
    id: runIdSchema.parse(id),
    routine: routineNameSchema.parse(routine),
    startedAt: new Date(Date.UTC(2026, 10, 10, 9, minute)).toISOString(),
  });

const toIds = (runs: RunRecord[]) => runs.map(({ routine, id }) => `${routine}/${id}`);

function readNextPage(runs: RunRecord[], page: RunsPage): RunsPage {
  assert.notEqual(page.nextCursor, null);
  return paginateRuns(runs, {
    routine: null,
    cursor: decodeRunsCursor(page.nextCursor ?? ''),
    limit: 2,
  });
}

test('pages through runs newest first, with ties in a fixed order', () => {
  const runs = [run('b', 1), run('a', 3), run('b', 3), run('a', 2), run('a', 3, 'run-3x')];

  const first = paginateRuns(runs, { routine: null, cursor: null, limit: 2 });
  const second = readNextPage(runs, first);
  const third = readNextPage(runs, second);

  assert.deepEqual(toIds(first.runs), ['b/run-3', 'a/run-3x']);
  assert.deepEqual(toIds(second.runs), ['a/run-3', 'a/run-2']);
  assert.deepEqual(toIds(third.runs), ['b/run-1']);
  assert.equal(third.nextCursor, null);
  assert.equal(first.total, 5);
});

test('new runs do not shift the pages after a cursor', () => {
  const runs = [run('a', 1), run('a', 2), run('a', 3), run('a', 4)];
  const first = paginateRuns(runs, { routine: null, cursor: null, limit: 2 });

  const second = readNextPage([...runs, run('a', 5), run('a', 6)], first);

  assert.deepEqual(toIds(second.runs), ['a/run-2', 'a/run-1']);
  assert.equal(second.total, 6);
});

test('reads the page query and rejects a limit or cursor it cannot use', () => {
  const cursor = encodeRunsCursor(run('daily-digest', 7));

  assert.deepEqual(
    parseRunsPageQuery(new URLSearchParams({ routine: 'daily-digest', cursor, limit: '20' })),
    {
      routine: 'daily-digest',
      cursor: { startedAt: '2026-11-10T09:07:00.000Z', routine: 'daily-digest', id: 'run-7' },
      limit: 20,
    },
  );
  assert.deepEqual(parseRunsPageQuery(new URLSearchParams()), {
    routine: null,
    cursor: null,
    limit: 50,
  });
  assert.equal(parseRunsPageQuery(new URLSearchParams({ limit: '0' })), null);
  assert.equal(parseRunsPageQuery(new URLSearchParams({ limit: '201' })), null);
  assert.equal(parseRunsPageQuery(new URLSearchParams({ limit: 'ten' })), null);
  assert.equal(parseRunsPageQuery(new URLSearchParams({ cursor: 'not-a-cursor' })), null);
});

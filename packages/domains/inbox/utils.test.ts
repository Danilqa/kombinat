import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from '../run/ids';
import { makeRunRecord } from '../run/mocks';
import type { RunRecord } from '../run/types';
import type { InboxState } from './types';
import { addReadRuns, checkHasNothingToReport, groupInboxRuns, listUnreadRuns } from './utils';

const at = (minute: number) => new Date(Date.UTC(2026, 10, 10, 9, minute)).toISOString();

const run = (id: string, endMinute: number, overrides: Partial<RunRecord> = {}): RunRecord =>
  makeRunRecord({
    id: runIdSchema.parse(id),
    routine: routineNameSchema.parse('triage'),
    startedAt: at(endMinute - 5),
    endedAt: at(endMinute),
    status: 'succeeded',
    resultText: 'Opened #12.',
    ...overrides,
  });

const toIds = (runs: RunRecord[]) => runs.map(({ id }) => id);

const state = (sinceMinute: number, readRuns: RunRecord[] = []): InboxState => ({
  since: at(sinceMinute),
  readRuns: readRuns.map(({ routine, id }) => ({ routine, id })),
});

test('lists the runs that ended since the first look and were not read, last ended first', () => {
  const read = run('read', 40);
  const runs = [
    run('before', 10),
    run('older', 30),
    read,
    run('newer', 50),
    run('running', 45, { status: 'running', endedAt: null }),
  ];

  assert.deepEqual(toIds(listUnreadRuns(runs, state(20, [read]))), ['newer', 'older']);
});

test('a run that is replying to a message waits until the reply ends', () => {
  const replying = run('replying', 30, { replyPid: 4242 });

  assert.deepEqual(listUnreadRuns([replying], state(20)), []);
});

test('marking runs read drops the keys of runs that are gone or older than the first look', () => {
  const kept = run('kept', 30);
  const marked = run('marked', 40);
  const before = run('before', 10);
  const gone = run('gone', 35);

  const next = addReadRuns(state(20, [kept, gone]), [marked, before], [kept, marked, before]);

  assert.deepEqual(next, state(20, [kept, marked]));
});

test('groups failures first, then findings, then runs that report nothing', () => {
  const runs = [
    run('quiet', 50, { resultText: 'No open incidents. The 5xx rate is 0.02%.' }),
    run('found', 40),
    run('timed-out', 30, { status: 'timed_out', resultText: null }),
    run('empty', 20, { resultText: null }),
    run('aborted', 10, { status: 'aborted' }),
  ];

  assert.deepEqual(
    groupInboxRuns(runs).map(({ group, runs: grouped }) => [group, toIds(grouped)]),
    [
      ['needs_look', ['timed-out', 'aborted']],
      ['findings', ['found']],
      ['quiet', ['quiet', 'empty']],
    ],
  );
});

test('a result reports nothing when it starts with the word no or nothing', () => {
  assert.equal(checkHasNothingToReport('Nothing to report.'), true);
  assert.equal(checkHasNothingToReport('**No** pull requests wait for my review.'), true);
  assert.equal(checkHasNothingToReport('Notified #product about 3 signals.'), false);
  assert.equal(checkHasNothingToReport('Fixed #331. No tests failed.'), false);
});

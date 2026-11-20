import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from '../run/ids';
import { makeRunRecord } from '../run/mocks';
import type { RunRecord } from '../run/types';
import type { InboxState, NotifyLevels } from './types';
import {
  addReadRuns,
  buildRunNotifications,
  changeNotifyLevel,
  checkHasNothingToReport,
  groupInboxRuns,
  listRunsToNotify,
  listUnreadRuns,
} from './utils';

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

test('notifies of the runs that came into the inbox since the last look, as each routine asks', () => {
  const seen = run('seen', 10, { status: 'failed' });
  const failed = run('failed', 20, {
    status: 'failed',
    routine: routineNameSchema.parse('deploy'),
  });
  const found = run('found', 30, { routine: routineNameSchema.parse('deploy') });
  const quiet = run('quiet', 40, {
    resultText: 'Nothing to report.',
    routine: routineNameSchema.parse('deploy'),
  });
  const everyRun = run('every-run', 50, { resultText: 'No new issues.' });
  const unasked = run('unasked', 60, { routine: routineNameSchema.parse('cleanup') });
  const notify: NotifyLevels = {
    [routineNameSchema.parse('deploy')]: 'failures_and_findings',
    [routineNameSchema.parse('triage')]: 'every_run',
    [routineNameSchema.parse('cleanup')]: 'never',
  };

  const runs = listRunsToNotify([seen], {
    runs: [unasked, everyRun, quiet, found, failed, seen],
    notify,
  });

  assert.deepEqual(toIds(runs), ['every-run', 'found', 'failed']);
});

test('a routine that notifies of failures only stays quiet about its findings', () => {
  const notify: NotifyLevels = { [routineNameSchema.parse('triage')]: 'failures' };
  const runs = [run('found', 20), run('timed-out', 30, { status: 'timed_out' })];

  assert.deepEqual(toIds(listRunsToNotify([], { runs, notify })), ['timed-out']);
});

test('a notification names the routine and its group, with the status of a failure', () => {
  const notifications = buildRunNotifications([
    run('failed', 20, { status: 'failed', error: 'claude exited with code 1\nat line 2' }),
    run('found', 30, { resultText: '## Opened #12\n\nDetails follow.' }),
    run('quiet', 40, { resultText: null }),
  ]);

  assert.deepEqual(
    notifications.map(({ title, body, run: notified }) => [title, body, notified?.id]),
    [
      ['triage needs a look', 'Failed: claude exited with code 1', 'failed'],
      ['triage has findings', 'Opened #12', 'found'],
      ['triage has nothing to report', 'Succeeded', 'quiet'],
    ],
  );
});

test('more than 3 runs at once make one notification that counts them by group', () => {
  const runs = [
    run('found', 10),
    run('failed', 20, { status: 'failed' }),
    run('aborted', 30, { status: 'aborted' }),
    run('quiet', 40, { resultText: 'No issues.' }),
  ];

  assert.deepEqual(buildRunNotifications(runs), [
    {
      title: '4 runs finished',
      body: '2 need a look, 1 has findings, 1 has nothing to report.',
      run: null,
    },
  ]);
});

test('changing a routine to never notify drops it, so only the routines that notify are kept', () => {
  const triage = routineNameSchema.parse('triage');
  const deploy = routineNameSchema.parse('deploy');
  const levels = changeNotifyLevel({ [deploy]: 'failures' }, triage, 'every_run');

  assert.deepEqual(changeNotifyLevel(levels, triage, 'failures'), {
    [deploy]: 'failures',
    [triage]: 'failures',
  });
  assert.deepEqual(changeNotifyLevel(levels, deploy, 'never'), { [triage]: 'every_run' });
});

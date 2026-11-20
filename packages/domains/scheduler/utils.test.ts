import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema } from '../routine/ids';
import { ONE_TIME_RUNS_LIMIT } from './constants';
import type { OneTimeRun } from './types';
import { addOneTimeRun, getNextRunAt, getOneTimeRunError, getRunLaterPresets } from './utils';

const triage = routineNameSchema.parse('triage');
const oneTimeRun = (local: string, routine = triage): OneTimeRun => ({
  routine,
  at: new Date(local).toISOString(),
});

function getPresetTimes(now: string): Record<string, string> {
  return Object.fromEntries(
    getRunLaterPresets(new Date(now)).map(({ label, at }) => [label, at.toISOString()]),
  );
}

test('run later presets count from now in local time', () => {
  assert.deepEqual(getPresetTimes('2026-11-18T15:20:42'), {
    'In 1 hour': new Date('2026-11-18T16:21:00').toISOString(),
    'Tonight at 02:00': new Date('2026-11-19T02:00:00').toISOString(),
    'Tomorrow at 09:00': new Date('2026-11-19T09:00:00').toISOString(),
    'Next Monday at 09:00': new Date('2026-11-23T09:00:00').toISOString(),
    'In 1 week': new Date('2026-11-25T15:21:00').toISOString(),
  });
});

test('after midnight, tonight is the same night, and on a Monday next Monday is a week away', () => {
  const times = getPresetTimes('2026-11-23T01:10:00');
  assert.equal(times['Tonight at 02:00'], new Date('2026-11-23T02:00:00').toISOString());
  assert.equal(times['Next Monday at 09:00'], new Date('2026-11-30T09:00:00').toISOString());
});

test('a one-time run must be in the future, within a year and under the limit', () => {
  const now = new Date('2026-11-18T15:00:00');
  assert.equal(
    getOneTimeRunError([], oneTimeRun('2026-11-18T14:59:00'), now),
    'Choose a time in the future',
  );
  assert.equal(
    getOneTimeRunError([], oneTimeRun('2027-12-01T09:00:00'), now),
    'Choose a time within a year',
  );
  assert.equal(
    getOneTimeRunError([], { routine: triage, at: 'tonight' }, now),
    'The time must be an ISO date',
  );
  assert.equal(getOneTimeRunError([], oneTimeRun('2026-11-19T02:00:00'), now), null);

  const full = Array.from({ length: ONE_TIME_RUNS_LIMIT }, (_, day) =>
    oneTimeRun(`2026-12-${String(day + 1).padStart(2, '0')}T09:00:00`),
  );
  assert.match(
    getOneTimeRunError(full, oneTimeRun('2026-11-19T02:00:00'), now) ?? '',
    /cancel one/,
  );
  assert.equal(getOneTimeRunError(full, oneTimeRun('2026-12-01T09:00:00'), now), null);
  const other = oneTimeRun('2026-11-19T02:00:00', routineNameSchema.parse('other'));
  assert.equal(getOneTimeRunError(full, other, now), null);
});

test('one-time runs stay sorted by time and the same time is kept once', () => {
  const night = oneTimeRun('2026-11-19T02:00:00');
  const morning = oneTimeRun('2026-11-19T09:00:00');
  const runs = addOneTimeRun(addOneTimeRun([morning], night), { ...night });
  assert.deepEqual(runs, [night, morning]);
});

test('the next run is the earliest of the schedule and the one-time runs', () => {
  const night = oneTimeRun('2026-11-19T02:00:00');
  const cron = new Date('2026-11-19T08:00:00').toISOString();
  assert.equal(getNextRunAt(cron, [night]), night.at);
  assert.equal(getNextRunAt(cron, []), cron);
  assert.equal(getNextRunAt(null, [oneTimeRun('2026-11-20T09:00:00'), night]), night.at);
  assert.equal(getNextRunAt(null, []), null);
});

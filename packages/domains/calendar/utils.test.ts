import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isMatching } from 'ts-pattern';

import { calendarEntryIdSchema, routineIdSchema, runIdSchema } from '../id/schemas';
import { makeRunRecord } from '../run/mocks';
import type { RunRecord, RunStatus } from '../run/types';
import type { ScheduledRoutine } from './types';
import { buildCalendar, countOverlapPairs, estimatePlannedMinutes } from './utils';

const routine = (name: string, schedule: string, timeoutMinutes = 55): ScheduledRoutine => ({
  name: routineIdSchema.parse(name),
  schedule,
  enabled: true,
  timeoutMinutes,
});

const run = (
  name: string,
  startedAt: string,
  endedAt: string | null,
  status: RunStatus = 'succeeded',
): RunRecord =>
  makeRunRecord({
    id: runIdSchema.parse(startedAt),
    routine: routineIdSchema.parse(name),
    startedAt,
    endedAt,
    status,
  });

const toEntry = (id: string, overlaps: string[]) => ({
  id: calendarEntryIdSchema.parse(id),
  overlaps: overlaps.map(other => calendarEntryIdSchema.parse(other)),
});

test('counts each overlapping pair once', () => {
  const entries = [
    toEntry('a', ['b', 'c']),
    toEntry('b', ['a']),
    toEntry('c', ['a']),
    toEntry('d', []),
  ];
  assert.equal(countOverlapPairs(entries), 2);
});

test('planned length uses the median of past runs, capped by the timeout', () => {
  const r = routine('a', '0 9 * * *', 30);
  const runs = [
    run('a', '2026-09-28T09:00:00Z', '2026-09-28T09:12:00Z'),
    run('a', '2026-09-27T09:00:00Z', '2026-09-27T09:40:00Z'),
    run('a', '2026-09-26T09:00:00Z', '2026-09-26T09:15:00Z'),
  ];
  assert.deepEqual(estimatePlannedMinutes(r, runs), { minutes: 15, estimated: true });
  assert.deepEqual(estimatePlannedMinutes(r, []), { minutes: 20, estimated: false });
});

test('calendar has past runs and future planned occurrences only after now', () => {
  const now = new Date('2026-09-30T12:00:00');
  const from = new Date('2026-09-28T00:00:00');
  const to = new Date('2026-10-05T00:00:00');
  const runs = [run('a', '2026-09-29T09:00:12', '2026-09-29T09:20:00')];
  const entries = buildCalendar([routine('a', '0 9 * * *')], runs, from, to, now);
  assert.equal(entries.filter(isMatching({ kind: 'run' })).length, 1);
  const planned = entries.filter(isMatching({ kind: 'planned' }));
  assert.equal(planned.length, 4);
  const [first] = planned;
  assert.ok(first);
  assert.equal(first.start, new Date('2026-10-01T09:00:00').toISOString());
  assert.equal(first.estimated, true);
});

test('overlaps between different routines are marked both ways', () => {
  const now = new Date('2026-09-30T00:00:00');
  const entries = buildCalendar(
    [routine('hourly', '10 * * * *'), routine('daily', '20 9 * * *')],
    [],
    new Date('2026-09-30T00:00:00'),
    new Date('2026-09-30T23:59:00'),
    now,
  );
  const daily = entries.find(e => e.routine === 'daily');
  const hourly = entries.find(e => e.start === new Date('2026-09-30T09:10:00').toISOString());
  assert.ok(daily && hourly);
  assert.deepEqual(daily.overlaps, [hourly.id]);
  assert.ok(hourly.overlaps.includes(daily.id));
  assert.equal(
    entries.find(e => e.start === new Date('2026-09-30T10:10:00').toISOString())?.overlaps.length,
    0,
  );
});

test('a running run extends to now', () => {
  const now = new Date('2026-09-30T12:30:00Z');
  const entries = buildCalendar(
    [],
    [run('a', '2026-09-30T12:00:00Z', null, 'running')],
    new Date('2026-09-30T00:00:00Z'),
    new Date('2026-10-01T00:00:00Z'),
    now,
  );
  assert.equal(entries[0]?.end, now.toISOString());
});

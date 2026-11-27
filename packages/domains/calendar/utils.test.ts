import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isMatching } from 'ts-pattern';

import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from '../run/ids';
import { makeRunRecord } from '../run/mocks';
import type { RunRecord, RunStatus } from '../run/types';
import { calendarEntryIdSchema } from './ids';
import type { ScheduledRoutine } from './types';
import {
  buildCalendar,
  countOverlapPairs,
  estimatePlannedMinutes,
  parseCalendarRange,
} from './utils';

const routine = (name: string, schedule: string | null, timeoutMinutes = 55): ScheduledRoutine => ({
  name: routineNameSchema.parse(name),
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
    routine: routineNameSchema.parse(name),
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
  const entries = buildCalendar([routine('a', '0 9 * * *')], runs, [], from, to, now);
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
    [],
    new Date('2026-09-30T00:00:00Z'),
    new Date('2026-10-01T00:00:00Z'),
    now,
  );
  assert.equal(entries[0]?.end, now.toISOString());
});

test('one-time runs are planned blocks too, but only ahead of now and for enabled routines', () => {
  const now = new Date('2026-09-30T12:00:00');
  const oneTimeRun = (name: string, local: string) => ({
    routine: routineNameSchema.parse(name),
    at: new Date(local).toISOString(),
  });
  const entries = buildCalendar(
    [routine('manual', null, 15), { ...routine('paused', null), enabled: false }],
    [],
    [
      oneTimeRun('manual', '2026-09-30T11:00:00'),
      oneTimeRun('manual', '2026-10-01T02:00:00'),
      oneTimeRun('paused', '2026-10-01T03:00:00'),
    ],
    new Date('2026-09-28T00:00:00'),
    new Date('2026-10-05T00:00:00'),
    now,
  );
  assert.deepEqual(
    entries.map(({ id, kind, start, end }) => ({ id, kind, start, end })),
    [
      {
        id: calendarEntryIdSchema.parse(
          `once:manual:${new Date('2026-10-01T02:00:00').toISOString()}`,
        ),
        kind: 'planned',
        start: new Date('2026-10-01T02:00:00').toISOString(),
        end: new Date('2026-10-01T02:15:00').toISOString(),
      },
    ],
  );
});

test('a calendar range needs two ISO dates in order, at most 32 days apart', () => {
  const parse = (query: string) => parseCalendarRange(new URLSearchParams(query));
  assert.deepEqual(parse('from=2026-11-02T00:00:00Z&to=2026-11-09T00:00:00Z'), {
    from: new Date('2026-11-02T00:00:00Z'),
    to: new Date('2026-11-09T00:00:00Z'),
  });
  assert.notEqual(parse('from=2026-11-01T00:00:00Z&to=2026-12-03T00:00:00Z'), null);
  assert.equal(parse('from=2026-11-01T00:00:00Z&to=2026-12-03T00:00:01Z'), null);
  assert.equal(parse('from=2026-11-09T00:00:00Z&to=2026-11-09T00:00:00Z'), null);
  assert.equal(parse('from=2026-11-09T00:00:00Z&to=2026-11-02T00:00:00Z'), null);
  assert.equal(parse('from=monday&to=2026-11-09T00:00:00Z'), null);
  assert.equal(parse('from=2026-11-02T00:00:00Z'), null);
  assert.equal(parse(''), null);
});

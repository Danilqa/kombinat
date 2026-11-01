import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCalendar, estimatePlannedMinutes } from './calendar';
import { buildRoutine } from './routines';
import type { RunRecord } from './state';

const routine = (name: string, schedule: string, timeout = 55) =>
  buildRoutine(
    `/tmp/${name}.md`,
    `---\nname: ${name}\nschedule: "${schedule}"\ncwd: /tmp\ntimeoutMinutes: ${timeout}\n---\nHi`,
  );

const run = (
  name: string,
  startedAt: string,
  endedAt: string | null,
  status: RunRecord['status'] = 'succeeded',
): RunRecord => ({
  id: startedAt,
  routine: name,
  agent: 'claude',
  trigger: 'schedule',
  scheduledFor: null,
  startedAt,
  endedAt,
  status,
  pid: null,
  exitCode: 0,
  sessionId: null,
  resumeCommand: null,
  model: 'x',
  costUsd: null,
  numTurns: null,
  durationMs: null,
  resultText: null,
  error: null,
  logFile: '/tmp/x',
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
  assert.equal(entries.filter(e => e.kind === 'run').length, 1);
  const planned = entries.filter(e => e.kind === 'planned');
  assert.equal(planned.length, 4);
  assert.equal(planned[0]?.start, new Date('2026-10-01T09:00:00').toISOString());
  assert.equal(planned[0]?.estimated, true);
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
  assert.deepEqual(daily?.overlaps, [hourly?.id]);
  assert.ok(daily !== undefined && hourly?.overlaps.includes(daily.id));
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

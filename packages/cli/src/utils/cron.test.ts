import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeCron, checkMatchesCron, nextCronRun, parseCron } from './cron';

const at = (iso: string) => new Date(iso);

test('matches exact minute and hour', () => {
  assert.equal(checkMatchesCron('30 11 * * *', at('2026-09-30T11:30:00')), true);
  assert.equal(checkMatchesCron('30 11 * * *', at('2026-09-30T11:31:00')), false);
});

test('supports ranges, steps and lists', () => {
  assert.equal(checkMatchesCron('10 7-22 * * *', at('2026-09-30T07:10:00')), true);
  assert.equal(checkMatchesCron('10 7-22 * * *', at('2026-09-30T23:10:00')), false);
  assert.equal(checkMatchesCron('*/15 * * * *', at('2026-09-30T09:45:00')), true);
  assert.equal(checkMatchesCron('*/15 * * * *', at('2026-09-30T09:50:00')), false);
  assert.equal(checkMatchesCron('0 23,2 * * *', at('2026-09-30T02:00:00')), true);
});

test('weekday field uses 0 or 7 for Sunday', () => {
  assert.equal(checkMatchesCron('30 5 * * 2', at('2026-09-29T05:30:00')), true);
  assert.equal(checkMatchesCron('30 5 * * 0', at('2026-10-04T05:30:00')), true);
  assert.equal(checkMatchesCron('30 5 * * 7', at('2026-10-04T05:30:00')), true);
});

test('day-of-month or day-of-week matches when both constrained', () => {
  assert.equal(checkMatchesCron('0 9 1 * 3', at('2026-10-01T09:00:00')), true);
  assert.equal(checkMatchesCron('0 9 1 * 3', at('2026-10-07T09:00:00')), true);
  assert.equal(checkMatchesCron('0 9 1 * 3', at('2026-10-02T09:00:00')), false);
});

test('rejects malformed expressions', () => {
  assert.throws(() => parseCron('* * *'));
  assert.throws(() => parseCron('61 * * * *'));
  assert.throws(() => parseCron('a b c d e'));
});

test('finds the next run after a given time', () => {
  assert.equal(
    nextCronRun('30 11 * * *', at('2026-09-30T11:30:00'))?.toISOString(),
    at('2026-10-01T11:30:00').toISOString(),
  );
  assert.equal(
    nextCronRun('30 5 * * 2', at('2026-09-30T00:00:00'))?.toISOString(),
    at('2026-10-06T05:30:00').toISOString(),
  );
});

test('describes common schedules', () => {
  assert.equal(describeCron('30 11 * * *'), 'Daily at 11:30');
  assert.equal(describeCron('10 7-22 * * *'), 'Hourly at :10, 07:00-22:59');
  assert.equal(describeCron('0 0-4,23 * * *'), 'Hourly at :00, 23:00-04:59');
  assert.equal(describeCron('0 9-12,14-17 * * *'), 'Hourly at :00, 09:00-12:59 and 14:00-17:59');
  assert.equal(describeCron('15 6,9-11 * * *'), 'Hourly at :15, 06:15 and 09:00-11:59');
  assert.equal(describeCron('30 5 * * 2'), 'Weekly on Tuesday at 05:30');
  assert.equal(describeCron('0 9 * * 1-5'), 'Weekdays at 09:00');
  assert.equal(describeCron('0 23,2 * * *'), 'Daily at 02:00 and 23:00');
  assert.equal(describeCron('10 7-21/2 * * *'), 'Every 2 hours at :10, 07:10-21:10');
  assert.equal(describeCron('5 */2 * * *'), 'Every 2 hours at :05, from 00:05');
});

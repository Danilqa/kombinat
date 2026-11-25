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

test('describes every schedule in words, never as the expression', () => {
  assert.equal(describeCron('* * * * *'), 'Every minute');
  assert.equal(describeCron('*/30 * * * *'), 'Every 30 minutes');
  assert.equal(describeCron('*/15 9-17 * * 1-5'), 'Every 15 minutes, 09:00-17:59, on weekdays');
  assert.equal(describeCron('0,30 * * * *'), 'At :00 and :30 of every hour');
  assert.equal(describeCron('0-10 * * * 6,0'), 'At minutes 0-10 of every hour on weekends');
  assert.equal(describeCron('0,30 9 * * *'), 'Daily at 09:00 and 09:30');
  assert.equal(describeCron('0 9,17 * * 1-5'), 'Weekdays at 09:00 and 17:00');
  assert.equal(describeCron('0 22 * * 1,3,5'), 'Monday, Wednesday, Friday at 22:00');
  assert.equal(describeCron('0 10 * * 6,7'), 'Weekends at 10:00');
  assert.equal(describeCron('0 * * * 1-5'), 'Hourly at :00 on weekdays');
  assert.equal(describeCron('15 9-17/2 * * 1-5'), 'Every 2 hours at :15, 09:15-17:15, on weekdays');
  assert.equal(describeCron('0 13,17,23,0,1,2 * * *'), 'At :00 on hours 0, 1, 2, 13, 17, 23');
  assert.equal(describeCron('0 9 1 * *'), 'Monthly on the 1st at 09:00');
  assert.equal(describeCron('0 9 1,15 * *'), 'At 09:00 on the 1st and 15th of the month');
  assert.equal(describeCron('0 9 1-7 * *'), 'At 09:00 on days 1-7 of the month');
  assert.equal(describeCron('0 9 1 * 3'), 'At 09:00 on the 1st of the month or on Wednesday');
  assert.equal(
    describeCron('0 9 22 1,7 *'),
    'At 09:00 on the 22nd of the month in January and July',
  );
  assert.equal(describeCron('30 6 * 6-8 *'), 'At 06:30 in June, July and August');
  assert.equal(describeCron('0 8 * 1-6 1'), 'At 08:00 on Monday in January-June');
  assert.equal(describeCron('0 9 1 * 0-6'), 'Daily at 09:00');
  assert.equal(describeCron('0 9 */1 * 1'), 'Daily at 09:00');
  assert.equal(describeCron('0 9 * * 0-6'), 'Daily at 09:00');
  assert.equal(describeCron('0 12 */2 * *'), 'At 12:00 on every 2 days of the month');
  assert.equal(describeCron('0 12 1 */3 *'), 'At 12:00 on the 1st of the month every 3 months');
  assert.equal(describeCron('5/20 */3 * * *'), 'At :05, :25 and :45, every 3 hours');
});

test('describes any valid expression in words', () => {
  const minutes = ['*', '0', '*/7', '5/20', '0,15,30,45', '10-50', '1-9,30'];
  const hours = ['*', '4', '*/3', '8-18', '8-18/5', '1,2,3,4,5', '22-23,0-3'];
  const days = ['* * *', '13 * *', '* 2 *', '* * 0', '1-5 */2 1-3', '31 12 7'];
  for (const minute of minutes) {
    for (const hour of hours) {
      for (const day of days) {
        const expression = `${minute} ${hour} ${day}`;
        const text = describeCron(expression);
        assert.match(text, /^[A-Z]/, expression);
        assert.doesNotMatch(text, /cron|\*|undefined|NaN| {2}|, ,|^$/, `${expression}: ${text}`);
      }
    }
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatDuration, formatRelativeCompact, formatSpan } from './date-time';

const now = Date.parse('2026-10-06T12:00:00Z');
const offset = (ms: number) => new Date(now + ms).toISOString();

test('formatSpan is compact and drops minutes for long spans', () => {
  assert.equal(formatSpan(45_000), '45s');
  assert.equal(formatSpan(5 * 60_000 + 20_000), '5m');
  assert.equal(formatSpan(3 * 3_600_000 + 5 * 60_000), '3h 5m');
  assert.equal(formatSpan(13 * 3_600_000 + 5 * 60_000), '13h');
  assert.equal(formatSpan(50 * 3_600_000), '2d');
});

test('formatRelativeCompact says now, in or ago', () => {
  assert.equal(formatRelativeCompact(offset(4_000), now), 'now');
  assert.equal(formatRelativeCompact(offset(9 * 60_000), now), 'in 9m');
  assert.equal(formatRelativeCompact(offset(-50 * 60_000), now), '50m ago');
  assert.equal(formatRelativeCompact(null, now), '-');
});

test('formatDuration matches the dashboard', () => {
  assert.equal(formatDuration(null), '-');
  assert.equal(formatDuration(15_000), '15s');
  assert.equal(formatDuration(83_000), '1m 23s');
  assert.equal(formatDuration(3_900_000), '1h 5m');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProgress, interpolate } from './motion';

test('getProgress is 0 before the start and 1 after the end', () => {
  assert.equal(getProgress(0.5, 1, 2), 0);
  assert.equal(getProgress(3.5, 1, 2), 1);
});

test('getProgress applies the easing between start and end', () => {
  assert.equal(
    getProgress(2, 1, 2, progress => progress),
    0.5,
  );
  assert.equal(getProgress(2, 1, 2), 0.875);
});

test('getProgress jumps at the start when there is no duration', () => {
  assert.equal(getProgress(0.9, 1, 0), 0);
  assert.equal(getProgress(1, 1, 0), 1);
});

test('interpolate mixes two values', () => {
  assert.equal(interpolate(10, 20, 0.25), 12.5);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CROSSFADE_SECONDS, findScene, listScenes, TIMELINE, toSegmentName } from './timeline';

test('every scene is in the timeline once', () => {
  const names = listScenes().map(segment => segment.scene);
  assert.equal(new Set(names).size, names.length);
});

test('the timeline has one dashboard tour', () => {
  assert.equal(TIMELINE.filter(segment => toSegmentName(segment) === 'tour').length, 1);
});

test('every scene is longer than two crossfades', () => {
  for (const segment of listScenes()) assert.ok(segment.seconds > 2 * CROSSFADE_SECONDS);
});

test('findScene finds a scene by name', () => {
  assert.equal(findScene('webhook')?.scene, 'webhook');
  assert.equal(findScene('missing'), undefined);
});

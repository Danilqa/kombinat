import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DAY_HEIGHT,
  HOUR_HEIGHT,
  MIN_BLOCK_HEIGHT,
  countOverlapPairs,
  getWeekStart,
  layoutDay,
} from './calendar-layout';
import type { TimedEntry } from './calendar-layout';

const dayStart = new Date(2026, 8, 30);

function at(hours: number, minutes = 0, dayOffset = 0): string {
  return new Date(2026, 8, 30 + dayOffset, hours, minutes).toISOString();
}

function makeEntry(id: string, start: string, end: string, overlaps: string[] = []): TimedEntry {
  return { id, start, end, overlaps };
}

interface Box {
  top: number;
  height: number;
  left: number;
  width: number;
}

function getBoxes(entries: TimedEntry[]): (id: string) => Box {
  const boxes = new Map(
    layoutDay(entries, dayStart).map(({ entry, top, height, left, width }) => [
      entry.id,
      { top, height, left, width },
    ]),
  );
  return id => {
    const box = boxes.get(id);
    assert.ok(box, `no box for ${id}`);
    return box;
  };
}

test('positions a single entry by time with full width', () => {
  const boxes = getBoxes([makeEntry('a', at(9), at(10, 30))]);
  assert.deepEqual(boxes('a'), {
    top: 9 * HOUR_HEIGHT,
    height: 1.5 * HOUR_HEIGHT,
    left: 0,
    width: 1,
  });
});

test('puts two intersecting entries side by side', () => {
  const boxes = getBoxes([makeEntry('a', at(9), at(10)), makeEntry('b', at(9, 30), at(11))]);
  assert.equal(boxes('a').left, 0);
  assert.equal(boxes('b').left, 0.5);
  assert.equal(boxes('a').width, 0.5);
  assert.equal(boxes('b').width, 0.5);
});

test('does not treat end-to-start touching entries as overlapping', () => {
  const boxes = getBoxes([makeEntry('a', at(9), at(10)), makeEntry('b', at(10), at(11))]);
  assert.equal(boxes('a').width, 1);
  assert.equal(boxes('b').width, 1);
  assert.equal(boxes('b').left, 0);
});

test('places the longer entry first when two start together', () => {
  const boxes = getBoxes([makeEntry('short', at(9), at(10)), makeEntry('long', at(9), at(12))]);
  assert.equal(boxes('long').left, 0);
  assert.equal(boxes('short').left, 0.5);
});

test('reuses a freed column inside a chained cluster', () => {
  const boxes = getBoxes([
    makeEntry('a', at(9), at(10)),
    makeEntry('b', at(9, 30), at(11)),
    makeEntry('c', at(10), at(11)),
  ]);
  assert.equal(boxes('c').left, 0);
  assert.equal(boxes('b').left, 0.5);
  assert.ok([boxes('a'), boxes('b'), boxes('c')].every(box => box.width === 0.5));
});

test('lays out separate clusters independently', () => {
  const boxes = getBoxes([
    makeEntry('a', at(1), at(2)),
    makeEntry('b', at(1), at(2)),
    makeEntry('c', at(1), at(2)),
    makeEntry('d', at(5), at(6)),
  ]);
  assert.equal(boxes('c').width, 1 / 3);
  assert.equal(boxes('d').width, 1);
});

test('gives very short entries the minimum height and lays them out by that height', () => {
  const boxes = getBoxes([
    makeEntry('a', at(8, 10), at(8, 20)),
    makeEntry('b', at(8, 30), at(8, 50)),
  ]);
  assert.equal(boxes('a').height, MIN_BLOCK_HEIGHT);
  assert.equal(boxes('b').left, 0.5);
});

test('clips entries to the day and drops entries outside it', () => {
  const layout = layoutDay(
    [
      makeEntry('overnight', at(23, 0, -1), at(1)),
      makeEntry('late', at(23), at(1, 0, 1)),
      makeEntry('tomorrow', at(9, 0, 1), at(10, 0, 1)),
    ],
    dayStart,
  );
  const boxes = new Map(layout.map(({ entry, top, height }) => [entry.id, { top, height }]));
  assert.deepEqual(boxes.get('overnight'), { top: 0, height: HOUR_HEIGHT });
  assert.deepEqual(boxes.get('late'), { top: 23 * HOUR_HEIGHT, height: HOUR_HEIGHT });
  assert.equal(boxes.get('tomorrow'), undefined);
});

test('keeps a minimum-height block at the end of the day inside the grid', () => {
  const boxes = getBoxes([makeEntry('a', at(23, 55), at(0, 0, 1))]);
  assert.equal(boxes('a').top + boxes('a').height, DAY_HEIGHT);
});

test('counts each overlapping pair once', () => {
  const entries = [
    makeEntry('a', at(9), at(10), ['b', 'c']),
    makeEntry('b', at(9), at(10), ['a']),
    makeEntry('c', at(9), at(10), ['a']),
    makeEntry('d', at(12), at(13)),
  ];
  assert.equal(countOverlapPairs(entries), 2);
});

test('starts the week on Monday', () => {
  assert.deepEqual(getWeekStart(new Date(2026, 8, 30, 18)), new Date(2026, 8, 28));
  assert.deepEqual(getWeekStart(new Date(2026, 9, 4, 23)), new Date(2026, 8, 28));
  assert.deepEqual(getWeekStart(new Date(2026, 9, 5, 0, 5)), new Date(2026, 9, 5));
});

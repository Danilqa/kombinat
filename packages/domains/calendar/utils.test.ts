import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countOverlapPairs } from './utils';

test('counts each overlapping pair once', () => {
  const entries = [
    { id: 'a', overlaps: ['b', 'c'] },
    { id: 'b', overlaps: ['a'] },
    { id: 'c', overlaps: ['a'] },
    { id: 'd', overlaps: [] },
  ];
  assert.equal(countOverlapPairs(entries), 2);
});

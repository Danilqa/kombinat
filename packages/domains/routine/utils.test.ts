import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routineNameSchema, type RoutineName } from './ids';
import type { ChainedRoutine } from './types';
import { listChain, listChainLoops } from './utils';

const name = (value: string): RoutineName => routineNameSchema.parse(value);

const routine = (value: string, startsAfter: string | null = null): ChainedRoutine => ({
  name: name(value),
  startsAfter: startsAfter === null ? null : name(startsAfter),
});

const names = (routines: ChainedRoutine[]) => routines.map(candidate => candidate.name);

test('a chain lists its routines from the first, each before the ones that start after it', () => {
  const routines = [
    routine('notes', 'review'),
    routine('review', 'night'),
    routine('night'),
    routine('cleanup', 'night'),
    routine('alone'),
  ];

  assert.deepEqual(names(listChain(routines, name('review'))), [
    'night',
    'review',
    'notes',
    'cleanup',
  ]);
  assert.deepEqual(
    names(listChain(routines, name('night'))),
    names(listChain(routines, name('notes'))),
  );
  assert.deepEqual(listChain(routines, name('alone')), []);
});

test('a routine that starts after a missing routine has a chain only with the ones after it', () => {
  const routines = [routine('review', 'gone'), routine('notes', 'review')];

  assert.deepEqual(names(listChain(routines, name('notes'))), ['review', 'notes']);
  assert.deepEqual(listChain([routine('review', 'gone')], name('review')), []);
});

test('loops are found once each, and a chain in a loop still lists each routine once', () => {
  const routines = [
    routine('a', 'b'),
    routine('b', 'a'),
    routine('c', 'a'),
    routine('self', 'self'),
    routine('d', 'e'),
    routine('e'),
  ];

  assert.deepEqual(listChainLoops(routines), [[name('b'), name('a')], [name('self')]]);
  assert.deepEqual(names(listChain(routines, name('c'))), ['b', 'a', 'c']);
});

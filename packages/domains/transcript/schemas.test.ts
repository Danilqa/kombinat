import assert from 'node:assert/strict';
import { test } from 'node:test';

import { match } from 'ts-pattern';

import { transcriptSchema } from './schemas';

test('a hook item without a phase, from an older daemon, is a before hook', () => {
  const hook = { kind: 'hook', key: 'hook-0', command: 'git pull', exitCode: 0, output: '' };
  const { items } = transcriptSchema.parse({
    eventCount: 2,
    items: [hook, { ...hook, key: 'hook-1', phase: 'after' }],
  });
  assert.deepEqual(
    items.map(item =>
      match(item)
        .with({ kind: 'hook' }, hook => hook.phase)
        .otherwise(() => null),
    ),
    ['before', 'after'],
  );
});

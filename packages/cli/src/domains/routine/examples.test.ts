import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { EXAMPLE_ROUTINES } from './examples';
import { buildRoutine } from './utils';

const REPO_ROUTINES = path.resolve(import.meta.dirname, '../../../../../routines');

test('there is a hello, a scheduled and a webhook example', () => {
  assert.deepEqual(
    EXAMPLE_ROUTINES.map(example => example.name),
    ['hello-example-routine', 'weather-example-routine', 'weather-webhook-example-routine'],
  );
});

for (const example of EXAMPLE_ROUTINES) {
  test(`${example.name} is the same as its file in routines/`, () => {
    const file = path.join(REPO_ROUTINES, `${example.name}.md`);
    assert.equal(example.source, fs.readFileSync(file, 'utf8'));
  });

  test(`${example.name} is a valid routine`, () => {
    const routine = buildRoutine(`/tmp/routines/${example.name}.md`, example.source);
    assert.equal(routine.name, example.name);
    assert.equal(routine.agent, 'claude');
    assert.equal(routine.timeoutMinutes, 5);
  });
}

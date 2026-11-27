import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { buildRoutine, listRoutineProblems } from '../../domains/routine/utils';
import { EXAMPLE_ROUTINES } from './examples';

const REPO_ROUTINES = path.resolve(import.meta.dirname, '../../../../../example/routines');

test('there is a hello, a scheduled and a webhook example', () => {
  assert.deepEqual(
    EXAMPLE_ROUTINES.map(example => example.name),
    ['hello-example-routine', 'weather-example-routine', 'weather-webhook-example-routine'],
  );
});

for (const example of EXAMPLE_ROUTINES) {
  test(`${example.name} is the same as its file in example/routines/`, () => {
    const file = path.join(REPO_ROUTINES, `${example.name}.md`);
    assert.equal(example.source, fs.readFileSync(file, 'utf8'));
  });

  test(`${example.name} is a valid routine`, () => {
    const file = `/tmp/routines/${example.name}.md`;
    assert.deepEqual(listRoutineProblems(file, example.source), []);
    const routine = buildRoutine(file, example.source);
    assert.equal(routine.name, example.name);
    assert.equal(routine.agent, 'claude');
    assert.equal(routine.timeoutMinutes, 5);
  });
}

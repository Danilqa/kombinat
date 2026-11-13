import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { buildRoutine } from '../../domains/routine/utils';
import { ROUTINE_TEMPLATES } from './templates';

const REPO_ROUTINES = path.resolve(import.meta.dirname, '../../../../../routines');

test('there is a hello, a scheduled and a webhook example', () => {
  assert.deepEqual(
    ROUTINE_TEMPLATES.map(template => template.name),
    ['hello-example-routine', 'weather-example-routine', 'weather-webhook-example-routine'],
  );
});

for (const template of ROUTINE_TEMPLATES) {
  test(`${template.name} is the same as its file in routines/`, () => {
    const file = path.join(REPO_ROUTINES, `${template.name}.md`);
    assert.equal(template.source, fs.readFileSync(file, 'utf8'));
  });

  test(`${template.name} is a valid routine`, () => {
    const routine = buildRoutine(`/tmp/routines/${template.name}.md`, template.source);
    assert.equal(routine.name, template.name);
    assert.equal(routine.agent, 'claude');
    assert.equal(routine.timeoutMinutes, 5);
  });
}

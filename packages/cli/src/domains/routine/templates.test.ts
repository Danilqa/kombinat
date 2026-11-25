import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';
import { ROUTINE_TEMPLATES } from 'domains/routine/templates';

import { addRoutineFromTemplate } from './templates';
import { buildRoutine } from './utils';

const [template] = ROUTINE_TEMPLATES;
if (template === undefined) throw new Error('There are no templates');

function makeDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-templates-'));
  return { routines: path.join(root, 'routines'), cwd: root };
}

for (const each of ROUTINE_TEMPLATES) {
  test(`${each.id} adds a routine with its settings`, () => {
    const { routines, cwd } = makeDirs();
    const name = routineNameSchema.parse(each.id);
    const schedule = each.schedule ?? 'manual';
    const added = addRoutineFromTemplate(each, { name, cwd, schedule }, routines);
    assert.equal(added.outcome, 'added');
    const file = path.join(routines, `${name}.md`);
    const routine = buildRoutine(file, fs.readFileSync(file, 'utf8'));
    assert.equal(routine.schedule, each.schedule);
    assert.equal(routine.cwd, cwd);
    assert.equal(routine.model, each.model);
    assert.equal(routine.retries, each.retries);
    assert.equal(routine.worktree, each.worktree);
    assert.equal(routine.memory, each.memory);
    assert.equal(routine.check, each.check);
    assert.equal(routine.prompt, each.prompt);
  });
}

test('never replaces a routine file that exists', () => {
  const { routines, cwd } = makeDirs();
  const name = routineNameSchema.parse('mine');
  fs.mkdirSync(routines);
  fs.writeFileSync(path.join(routines, 'mine.md'), 'my own routine');
  const added = addRoutineFromTemplate(template, { name, cwd, schedule: 'manual' }, routines);
  assert.equal(added.outcome, 'exists');
  assert.equal(fs.readFileSync(path.join(routines, 'mine.md'), 'utf8'), 'my own routine');
});

test('a manual routine drops the check, which runs only at scheduled times', () => {
  const { routines, cwd } = makeDirs();
  const withCheck = ROUTINE_TEMPLATES.find(each => each.check !== null);
  assert.ok(withCheck);
  const name = routineNameSchema.parse('on-demand');
  const added = addRoutineFromTemplate(withCheck, { name, cwd, schedule: 'manual' }, routines);
  assert.equal(added.outcome, 'added');
  const file = path.join(routines, 'on-demand.md');
  const routine = buildRoutine(file, fs.readFileSync(file, 'utf8'));
  assert.equal(routine.schedule, null);
  assert.equal(routine.check, null);
});

test('keeps the home folder written as ~', () => {
  const { routines } = makeDirs();
  const name = routineNameSchema.parse('at-home');
  const added = addRoutineFromTemplate(template, { name, cwd: '~', schedule: 'manual' }, routines);
  assert.equal(added.outcome, 'added');
  const file = path.join(routines, 'at-home.md');
  assert.equal(buildRoutine(file, fs.readFileSync(file, 'utf8')).cwd, os.homedir());
});

test('rejects a folder that does not exist and a schedule that is not a cron', () => {
  const { routines, cwd } = makeDirs();
  const name = routineNameSchema.parse('broken');
  const missing = path.join(cwd, 'missing');
  assert.deepEqual(
    addRoutineFromTemplate(template, { name, cwd: missing, schedule: 'manual' }, routines),
    {
      outcome: 'invalid',
      error: `There is no folder at ${missing}. Check the path, or create the folder first.`,
    },
  );
  assert.deepEqual(
    addRoutineFromTemplate(template, { name, cwd, schedule: 'every day' }, routines),
    {
      outcome: 'invalid',
      error: 'every day is not a cron schedule or manual',
    },
  );
  assert.equal(fs.existsSync(path.join(routines, 'broken.md')), false);
});

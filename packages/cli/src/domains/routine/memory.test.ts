import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { MEMORY_MAX_LENGTH } from 'domains/routine/constants';
import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-memory-'));
process.env['KOMBINAT_STATE_DIR'] = tmp;

const {
  appendMemory,
  getMemoryFile,
  keepMemoryUpdate,
  readMemory,
  readRoutineMemory,
  splitMemoryBlock,
  writeMemory,
} = await import('./memory');

const runId = runIdSchema.parse('20261121T030000Z-k3x9');
let routineCount = 0;
const newRoutine = () => routineNameSchema.parse(`routine-${(routineCount += 1)}`);

test('the notes come out of the end of the message', () => {
  assert.deepEqual(
    splitMemoryBlock('Filed #512.\n\n<routine-memory>\n- #512 filed\n</routine-memory>\n'),
    { text: 'Filed #512.', memory: '- #512 filed' },
  );
});

test('notes in a code fence lose the fence', () => {
  assert.equal(
    splitMemoryBlock('Done\n<routine-memory>\n```markdown\n# Filed\n- #512\n```\n</routine-memory>')
      .memory,
    '# Filed\n- #512',
  );
});

test('a message without a whole block keeps its text and changes no notes', () => {
  assert.deepEqual(splitMemoryBlock('Nothing to report.'), {
    text: 'Nothing to report.',
    memory: null,
  });
  const cut = 'Done\n<routine-memory>\n- half';
  assert.deepEqual(splitMemoryBlock(cut), { text: cut, memory: null });
  assert.deepEqual(splitMemoryBlock('Done\n<routine-memory>\n</routine-memory>'), {
    text: 'Done',
    memory: null,
  });
});

test('the prompt carries the notes, or says there are none', () => {
  assert.match(
    appendMemory('Find bugs.', '- Sign in as qa'),
    /^Find bugs\.\n[\s\S]*<routine-memory>\n- Sign in as qa\n<\/routine-memory>/,
  );
  assert.match(appendMemory('Find bugs.', ''), /There are no notes yet\./);
});

test('a change records who made it and the lines it added and removed', () => {
  const routine = newRoutine();
  writeMemory(routine, '- a\n- b\n- c', { by: 'user' }, new Date());
  writeMemory(routine, '- a\n- c\n- d\n- e\n', { by: 'run', runId });
  const memory = readRoutineMemory(routine);
  assert.equal(memory.text, '- a\n- c\n- d\n- e');
  assert.equal(memory.file, path.join(tmp, 'memory', `${routine}.md`));
  assert.deepEqual(
    { ...memory.change, at: undefined },
    { at: undefined, by: 'run', runId, added: 2, removed: 1 },
  );
});

test('clearing deletes the file and counts the removed lines', () => {
  const routine = newRoutine();
  writeMemory(routine, '- a\n- b', { by: 'run', runId });
  writeMemory(routine, '  \n', { by: 'user' });
  assert.equal(fs.existsSync(getMemoryFile(routine)), false);
  const { text, change } = readRoutineMemory(routine);
  assert.equal(text, '');
  assert.equal(change?.by, 'user');
  assert.equal(change.removed, 2);
});

test('a file changed in an editor counts as changed by the user', () => {
  const routine = newRoutine();
  writeMemory(routine, '- a', { by: 'run', runId }, new Date(Date.now() - 60_000));
  fs.writeFileSync(getMemoryFile(routine), '- a\n- b\n');
  const { change } = readRoutineMemory(routine);
  assert.equal(change?.by, 'user');
  assert.equal(change.runId, null);
  assert.equal(change.added, null);
});

test('notes over the limit keep their first whole lines', () => {
  const routine = newRoutine();
  const line = `- ${'x'.repeat(98)}`;
  writeMemory(routine, Array.from({ length: 300 }, () => line).join('\n'), { by: 'user' });
  const text = readMemory(routine);
  assert.ok(text.length <= MEMORY_MAX_LENGTH);
  assert.ok(text.split('\n').every(saved => saved === line));
});

test('a run saves its notes and returns its message without them', () => {
  const routine = newRoutine();
  const result = keepMemoryUpdate(
    routine,
    runId,
    'Filed #512.\n<routine-memory>\n- #512 filed\n</routine-memory>',
    '',
  );
  assert.equal(result, 'Filed #512.');
  assert.equal(readMemory(routine), '- #512 filed');
});

test('notes the user saved during the run win over the notes of the run', () => {
  const routine = newRoutine();
  writeMemory(routine, '- old', { by: 'run', runId });
  writeMemory(routine, "- don't report the beta banner", { by: 'user' });
  const result = keepMemoryUpdate(
    routine,
    runId,
    'Done\n<routine-memory>\n- old\n- new\n</routine-memory>',
    '- old',
  );
  assert.equal(result, 'Done');
  assert.equal(readMemory(routine), "- don't report the beta banner");
});

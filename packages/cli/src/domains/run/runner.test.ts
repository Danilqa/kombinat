import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');

const { buildRoutine } = await import('../routine/utils');
const { writePayload } = await import('./payload');
const { runRoutine } = await import('./runner');

test('a command that ignores the prompt still finishes its run', async () => {
  // Larger than a pipe buffer, so the command exits before the whole prompt is written.
  const prompt = 'Say hello.\n'.repeat(30_000);
  const routine = buildRoutine(
    path.join(tmp, 'say-hello.md'),
    `---\ncwd: ${tmp}\nagent: command\ncommand: echo Hello\n---\n${prompt}`,
  );
  const record = await runRoutine(routine, { trigger: 'manual' });
  assert.equal(record.status, 'succeeded');
  assert.equal(record.resultText, 'Hello');
});

test('a webhook run gets its payload in the prompt and as a file', async () => {
  const routine = buildRoutine(
    path.join(tmp, 'echo-payload.md'),
    `---\ncwd: ${tmp}\nagent: command\ncommand: cat && cat "$KOMBINAT_PAYLOAD_FILE"\n---\nTriage.`,
  );
  writePayload('echo-payload', '20261109T120000Z-abcd', '{"number":42}');
  const record = await runRoutine(routine, {
    trigger: 'webhook',
    runId: '20261109T120000Z-abcd',
  });
  assert.equal(record.id, '20261109T120000Z-abcd');
  assert.equal(record.status, 'succeeded');
  assert.equal(
    record.resultText,
    'Triage.\n\nThis run was started by a webhook. Its request body:\n\n```\n{"number":42}\n```\n\n{"number":42}',
  );
});

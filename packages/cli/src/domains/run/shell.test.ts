import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { runShell } from './shell';

const run = (command: string, cwd = os.tmpdir(), timeoutMs = 5_000) =>
  runShell({ command, cwd, env: process.env, input: 'hello', timeoutMs });

test('gives the exit code, the output and the input it read', async () => {
  assert.deepEqual(await run('cat; echo oops >&2; exit 3'), {
    exitCode: 3,
    stdout: 'hello',
    stderr: 'oops\n',
    isTimedOut: false,
    startError: null,
  });
});

test('resolves with the reason when the command cannot start', async () => {
  const result = await run('true', path.join(os.tmpdir(), 'kombinat-missing-folder'));
  assert.equal(result.exitCode, null);
  assert.match(result.startError ?? '', /ENOENT/);
});

test('stops a command at its limit without waiting for what it left behind', async () => {
  const startedAt = Date.now();
  const result = await run('echo started; sleep 5 & sleep 5', os.tmpdir(), 200);
  assert.ok(Date.now() - startedAt < 2_000);
  assert.equal(result.isTimedOut, true);
  assert.equal(result.stdout, 'started\n');
});

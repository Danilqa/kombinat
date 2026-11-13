import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
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

const STOP_EVENTS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit'] as const;
const countListeners = () => STOP_EVENTS.map(event => process.listenerCount(event));

test('leaves no listener on the process once its commands end', async () => {
  const before = countListeners();
  const running = Promise.all([run('sleep 0.2'), run('sleep 0.1')]);
  assert.deepEqual(
    countListeners(),
    before.map(count => count + 1),
  );
  await running;
  assert.deepEqual(countListeners(), before);
  await run('sleep 5', os.tmpdir(), 100);
  assert.deepEqual(countListeners(), before);
});

async function waitFor<T>(read: () => T | null): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = read();
    if (value !== null) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('timed out waiting');
}

const checkIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test('a stop signal to the process kills the running commands and still ends the process', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-shell-'));
  const pidFile = path.join(dir, 'child.pid');
  const script = path.join(dir, 'runner.mts');
  fs.writeFileSync(
    script,
    `const { runShell } = await import(${JSON.stringify(path.join(import.meta.dirname, 'shell.ts'))});
await runShell({
  command: 'sleep 30 & echo $! > ${pidFile}; wait',
  cwd: ${JSON.stringify(dir)},
  env: process.env,
  input: '',
  timeoutMs: 60_000,
});
`,
  );
  const runner = spawn(process.execPath, ['--import', 'tsx', script], {
    cwd: import.meta.dirname,
    stdio: 'ignore',
  });
  const childPid = await waitFor(() => {
    const text = fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8').trim() : '';
    return text === '' ? null : Number(text);
  });
  assert.equal(checkIsAlive(childPid), true);
  const exited = once(runner, 'exit');
  runner.kill('SIGINT');
  await exited;
  assert.deepEqual([runner.exitCode, runner.signalCode], [null, 'SIGINT']);
  assert.equal(await waitFor(() => (checkIsAlive(childPid) ? null : true)), true);
});

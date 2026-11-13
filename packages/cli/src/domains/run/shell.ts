import { spawn } from 'node:child_process';

import { getErrorMessage } from 'utils/error';

export interface ShellCommand {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  input: string | Buffer;
  timeoutMs: number;
}

export interface ShellResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  isTimedOut: boolean;
  startError: string | null;
}

function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // The group is gone already.
  }
}

// Runs in its own process group, so the limit also stops what the command started.
export function runShell({
  command,
  cwd,
  env,
  input,
  timeoutMs,
}: ShellCommand): Promise<ShellResult> {
  return new Promise(resolve => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let isDone = false;
    let timer: NodeJS.Timeout | undefined;
    const done = (exitCode: number | null, isTimedOut: boolean, startError: string | null) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        isTimedOut,
        startError,
      });
    };
    try {
      const child = spawn('/bin/sh', ['-c', command], {
        cwd,
        env,
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
      // Ends without waiting for close: a killed process can leave its output open.
      timer = setTimeout(() => {
        killGroup(child.pid);
        for (const stream of [child.stdin, child.stdout, child.stderr]) stream.destroy();
        done(child.exitCode, true, null);
      }, timeoutMs);
      child.on('error', error => done(null, false, error.message));
      child.on('close', exitCode => done(exitCode, false, null));
      // The command may exit before it reads its input.
      child.stdin.on('error', () => undefined);
      child.stdin.end(input);
    } catch (error) {
      done(null, false, getErrorMessage(error));
    }
  });
}

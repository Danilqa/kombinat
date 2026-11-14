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

const STOP_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const runningGroups = new Set<number>();

function killRunningGroups(): void {
  for (const pid of runningGroups) killGroup(pid);
  runningGroups.clear();
}

// A group of its own does not get the terminal's Ctrl-C, so a stop signal is passed on to it.
function stopOnSignal(signal: NodeJS.Signals): void {
  killRunningGroups();
  removeStopListeners();
  // With no other listener the signal did nothing yet, so it is sent again to end the process.
  if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
}

function addStopListeners(): void {
  for (const signal of STOP_SIGNALS) process.on(signal, stopOnSignal);
  process.on('exit', killRunningGroups);
}

function removeStopListeners(): void {
  for (const signal of STOP_SIGNALS) process.off(signal, stopOnSignal);
  process.off('exit', killRunningGroups);
}

function trackGroup(pid: number): void {
  if (runningGroups.size === 0) addStopListeners();
  runningGroups.add(pid);
}

function untrackGroup(pid: number | undefined): void {
  if (pid === undefined || !runningGroups.delete(pid)) return;
  if (runningGroups.size === 0) removeStopListeners();
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
    let groupId: number | undefined;
    const done = (exitCode: number | null, isTimedOut: boolean, startError: string | null) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      untrackGroup(groupId);
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
      groupId = child.pid;
      if (groupId !== undefined) trackGroup(groupId);
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

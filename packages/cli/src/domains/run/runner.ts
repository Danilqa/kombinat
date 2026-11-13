import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { isMatching, match } from 'ts-pattern';

import type { RoutineName, RunId } from 'domains/id/types';
import type { RunRecord, RunTrigger } from 'domains/run/types';
import { createRunId } from 'domains/run/utils';

import { config, getCliArgs } from '../../config';
import { parseJson } from '../../utils/json';
import { getAgent } from '../agent/registry';
import type { Agent, OutputEvent } from '../agent/types';
import type { Routine } from '../routine/types';
import type { HookEvent } from './event-log';
import { withHookEnv } from './hook-env';
import { appendPayload, takePayload } from './payload';
import { getRunsDir, listRuns, readRunRecord, writeRunRecord } from './storage';

export interface RunOptions {
  trigger: RunTrigger;
  scheduledFor?: string | null;
  runId?: RunId | null;
}

const HOOK_TIMEOUT_MS = 3 * 60_000;
const PENDING_START_MS = HOOK_TIMEOUT_MS + 60_000;
const KILL_GRACE_MS = 60_000;
const STDERR_CHUNKS = 200;

function checkIsBinaryFound(command: string): boolean {
  if (command.includes('/')) return fs.existsSync(command);
  return (process.env['PATH'] ?? '')
    .split(':')
    .some(dir => dir !== '' && fs.existsSync(path.join(dir, command)));
}

function finishRecord(record: RunRecord, patch: Partial<RunRecord>): RunRecord {
  const finished: RunRecord = { ...record, ...patch, endedAt: new Date().toISOString() };
  writeRunRecord(finished);
  return finished;
}

interface BeforeHook {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  logFile: string;
}

function runBeforeHook({ command, cwd, env, logFile }: BeforeHook): string | null {
  const result = spawnSync('/bin/sh', ['-c', command], {
    cwd,
    env: withHookEnv(env),
    timeout: HOOK_TIMEOUT_MS,
    encoding: 'utf8',
  });
  const output = `${result.stdout}${result.stderr}`.trim();
  const event: HookEvent = { type: 'before_hook', command, exitCode: result.status, output };
  fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`);
  if (result.error) return `before hook failed to start: ${result.error.message}`;
  if (result.status !== 0) {
    return `before hook exited with ${result.status}: ${output.slice(-1500)}`;
  }
  return null;
}

interface AfterHook {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  input: string;
  timeoutMs: number;
}

function runAfterHook({ command, cwd, env, input, timeoutMs }: AfterHook): Promise<HookEvent> {
  return new Promise(resolve => {
    const child = spawn('/bin/sh', ['-c', command], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    let isDone = false;
    const done = (exitCode: number | null, note: string | null) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      const printed = Buffer.concat([...stdout, ...stderr])
        .toString('utf8')
        .trim();
      const output = [printed, note].filter(Boolean).join('\n');
      resolve({ type: 'after_hook', command, exitCode, output });
    };
    // Ends without waiting for close: a process the hook left behind can keep its output open.
    const timer = setTimeout(() => {
      const isRunning = child.exitCode === null && child.signalCode === null;
      child.kill('SIGKILL');
      for (const stream of [child.stdin, child.stdout, child.stderr]) stream.destroy();
      done(child.exitCode, isRunning ? `Killed after ${timeoutMs / 60_000} minutes` : null);
    }, timeoutMs);
    child.on('error', error => done(null, `after hook failed to start: ${error.message}`));
    child.on('close', exitCode => done(exitCode, null));
    // The hook may exit before it reads the record.
    child.stdin.on('error', () => undefined);
    child.stdin.end(input);
  });
}

interface AfterHookRun {
  command: string;
  routine: Routine;
  env: NodeJS.ProcessEnv;
  logEnded: Promise<void>;
  timeoutMs: number;
}

async function finishWithAfterHook(
  record: RunRecord,
  patch: Partial<RunRecord>,
  { command, routine, env, logEnded, timeoutMs }: AfterHookRun,
): Promise<RunRecord> {
  const finished: RunRecord = { ...record, ...patch, endedAt: new Date().toISOString() };
  // The agent has exited, so the runner's own pid keeps the run from being reconciled as aborted.
  writeRunRecord({ ...record, status: 'running', pid: process.pid });
  await logEnded;
  const event = await runAfterHook({
    command,
    cwd: fs.existsSync(routine.cwd) ? routine.cwd : config.projectRoot,
    env: withHookEnv({
      ...env,
      KOMBINAT_ROUTINE: finished.routine,
      KOMBINAT_RUN_ID: finished.id,
      KOMBINAT_TRIGGER: finished.trigger,
      KOMBINAT_RUN_STATUS: finished.status,
    }),
    input: `${JSON.stringify(finished)}\n`,
    timeoutMs,
  });
  fs.appendFileSync(finished.logFile, `${JSON.stringify(event)}\n`);
  writeRunRecord(finished);
  return finished;
}

interface KillTimer {
  clear: () => void;
  checkHasFired: () => boolean;
}

// Ctrl-C first so the agent can wrap up, SIGTERM if it is still around a minute later.
function killAfter(child: ChildProcess, minutes: number): KillTimer {
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    child.kill('SIGINT');
    setTimeout(() => child.kill('SIGTERM'), KILL_GRACE_MS).unref();
  }, minutes * 60_000);
  return { clear: () => clearTimeout(timer), checkHasFired: () => fired };
}

function toEvent(agent: Agent, line: string): unknown {
  return match(agent.output)
    .with('jsonl', () => parseJson(line))
    .with('text', (): OutputEvent => ({ type: 'output', text: line }))
    .exhaustive();
}

function toLogLine(agent: Agent, line: string, event: unknown): string {
  return match(agent.output)
    .with('jsonl', () => line)
    .with('text', () => JSON.stringify(event))
    .exhaustive();
}

export async function runRoutine(
  routine: Routine,
  options: RunOptions,
  afterHookTimeoutMs = HOOK_TIMEOUT_MS,
): Promise<RunRecord> {
  const agent = getAgent(routine.agent);
  const id = options.runId ?? createRunId();
  const runsDir = getRunsDir(routine.name);
  const logFile = path.join(runsDir, `${id}.jsonl`);
  fs.mkdirSync(runsDir, { recursive: true });
  const record: RunRecord = {
    id,
    routine: routine.name,
    agent: routine.agent,
    trigger: options.trigger,
    scheduledFor: options.scheduledFor ?? null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'running',
    pid: null,
    exitCode: null,
    sessionId: null,
    resumeCommand: null,
    model: routine.model,
    costUsd: null,
    numTurns: null,
    durationMs: null,
    resultText: null,
    error: null,
    logFile,
  };

  const payload = takePayload(routine.name, id);
  const task =
    payload === null ? routine : { ...routine, prompt: appendPayload(routine.prompt, payload) };
  const invocation = agent.buildInvocation({ routine: task, runId: id, trigger: options.trigger });
  const finish = async (
    patch: Partial<RunRecord>,
    logEnded = Promise.resolve(),
  ): Promise<RunRecord> =>
    routine.after === null
      ? finishRecord(record, patch)
      : finishWithAfterHook(record, patch, {
          command: routine.after,
          routine,
          env: invocation.env,
          logEnded,
          timeoutMs: afterHookTimeoutMs,
        });
  if (!fs.existsSync(routine.cwd)) {
    return finish({ status: 'failed', error: `cwd does not exist: ${routine.cwd}` });
  }
  if (!checkIsBinaryFound(invocation.command)) {
    const hint = agent.binaryEnv === null ? '' : ` (set ${agent.binaryEnv})`;
    return finish({
      status: 'failed',
      error: `${agent.name} binary not found at ${invocation.command}${hint}`,
    });
  }
  if (routine.before !== null) {
    const beforeError = runBeforeHook({
      command: routine.before,
      cwd: routine.cwd,
      env: invocation.env,
      logFile,
    });
    if (beforeError !== null) return finish({ status: 'failed', error: beforeError });
  }

  const child = spawn(invocation.command, invocation.args, {
    cwd: routine.cwd,
    env: invocation.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  record.pid = child.pid ?? null;
  writeRunRecord(record);

  const log = fs.createWriteStream(logFile, { flags: 'a' });
  const stderrChunks: string[] = [];
  child.stderr.on('data', (chunk: Buffer) => {
    stderrChunks.push(String(chunk));
    if (stderrChunks.length > STDERR_CHUNKS) stderrChunks.shift();
  });

  readline.createInterface({ input: child.stdout }).on('line', line => {
    const event = toEvent(agent, line);
    log.write(`${toLogLine(agent, line, event)}\n`);
    if (event === undefined) return;
    const update = agent.readEvent(event, record);
    Object.assign(record, update);
    if (update.sessionId !== undefined && update.sessionId !== null) {
      record.resumeCommand = agent.getResumeCommand(update.sessionId);
      writeRunRecord(record);
    }
  });

  const killTimer = killAfter(child, routine.timeoutMinutes);

  // A command that ignores the prompt can exit before it is written. Its exit code decides the run.
  child.stdin.on('error', () => undefined);
  child.stdin.end(invocation.input);

  const exitCode = await new Promise<number | null>(resolve => {
    child.on('close', code => resolve(code));
    child.on('error', error => {
      record.error = error.message;
      resolve(-1);
    });
  });
  killTimer.clear();
  const logEnded = new Promise<void>(resolve => log.end(resolve));

  if (killTimer.checkHasFired()) {
    return finish(
      {
        status: 'timed_out',
        exitCode,
        error: `Killed after ${routine.timeoutMinutes} minutes`,
      },
      logEnded,
    );
  }
  if (exitCode !== 0) {
    const stderr = stderrChunks.join('').trim().slice(-2000);
    return finish(
      {
        status: 'failed',
        exitCode,
        error: record.error ?? (stderr || `exit code ${exitCode}`),
      },
      logEnded,
    );
  }
  return finish({ status: record.error === null ? 'succeeded' : 'failed', exitCode }, logEnded);
}

interface PendingStart {
  runId: RunId;
  startedAt: number;
}

// Until a run writes its record, only this process knows it started.
const pendingStarts = new Map<RoutineName, PendingStart>();

export function checkIsStarting(routineName: RoutineName, now = Date.now()): boolean {
  const pending = pendingStarts.get(routineName);
  if (pending === undefined) return false;
  const isWaiting =
    now - pending.startedAt < PENDING_START_MS &&
    readRunRecord(routineName, pending.runId) === null;
  if (!isWaiting) pendingStarts.delete(routineName);
  return isWaiting;
}

export function checkIsRunning(routineName: RoutineName): boolean {
  return (
    checkIsStarting(routineName) || listRuns(routineName).some(isMatching({ status: 'running' }))
  );
}

export function startDetachedRun(routineName: RoutineName, options: RunOptions): void {
  const runId = options.runId ?? createRunId();
  const args = getCliArgs('run', routineName, '--trigger', options.trigger, '--run-id', runId);
  if (options.scheduledFor) args.push('--scheduled-for', options.scheduledFor);
  pendingStarts.set(routineName, { runId, startedAt: Date.now() });
  spawn(process.execPath, args, {
    cwd: config.projectRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

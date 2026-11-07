import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { match } from 'ts-pattern';

import type { RunRecord, RunTrigger } from 'domains/run/types';
import { createRunId } from 'domains/run/utils';

import { config, getCliArgs } from '../../config';
import { parseJson } from '../../utils/json';
import { getAgent } from '../agent/registry';
import type { Agent } from '../agent/types';
import type { Routine } from '../routine/utils';
import type { BeforeHookEvent, OutputEvent } from './event-log';
import { getRunsDir, writeRunRecord } from './storage';

export interface RunOptions {
  trigger: RunTrigger;
  scheduledFor?: string | null;
}

const BEFORE_HOOK_TIMEOUT_MS = 3 * 60_000;
const KILL_GRACE_MS = 60_000;
const STDERR_CHUNKS = 200;

function findBinary(command: string): boolean {
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
    env: {
      ...env,
      KOMBINAT_REPO: config.projectRoot,
      PATH: `${path.join(config.projectRoot, 'scripts')}:${env['PATH'] ?? ''}`,
    },
    timeout: BEFORE_HOOK_TIMEOUT_MS,
    encoding: 'utf8',
  });
  const output = `${result.stdout}${result.stderr}`.trim();
  const event: BeforeHookEvent = { type: 'before_hook', command, exitCode: result.status, output };
  fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`);
  if (result.error) return `before hook failed to start: ${result.error.message}`;
  if (result.status !== 0) {
    return `before hook exited with ${result.status}: ${output.slice(-1500)}`;
  }
  return null;
}

interface KillTimer {
  clear: () => void;
  hasFired: () => boolean;
}

// Ctrl-C first so the agent can wrap up, SIGTERM if it is still around a minute later.
function killAfter(child: ChildProcess, minutes: number): KillTimer {
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    child.kill('SIGINT');
    setTimeout(() => child.kill('SIGTERM'), KILL_GRACE_MS).unref();
  }, minutes * 60_000);
  return { clear: () => clearTimeout(timer), hasFired: () => fired };
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

export async function runRoutine(routine: Routine, options: RunOptions): Promise<RunRecord> {
  const agent = getAgent(routine.agent);
  const id = createRunId();
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

  const invocation = agent.buildInvocation({ routine, runId: id, trigger: options.trigger });
  if (!fs.existsSync(routine.cwd)) {
    return finishRecord(record, { status: 'failed', error: `cwd does not exist: ${routine.cwd}` });
  }
  if (!findBinary(invocation.command)) {
    const hint = agent.binaryEnv === null ? '' : ` (set ${agent.binaryEnv})`;
    return finishRecord(record, {
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
    if (beforeError !== null) return finishRecord(record, { status: 'failed', error: beforeError });
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
  log.end();

  if (killTimer.hasFired()) {
    return finishRecord(record, {
      status: 'timed_out',
      exitCode,
      error: `Killed after ${routine.timeoutMinutes} minutes`,
    });
  }
  if (exitCode !== 0) {
    const stderr = stderrChunks.join('').trim().slice(-2000);
    return finishRecord(record, {
      status: 'failed',
      exitCode,
      error: record.error ?? (stderr || `exit code ${exitCode}`),
    });
  }
  return finishRecord(record, { status: record.error === null ? 'succeeded' : 'failed', exitCode });
}

export function startDetachedRun(routineName: string, options: RunOptions): void {
  const args = getCliArgs('run', routineName, '--trigger', options.trigger);
  if (options.scheduledFor) args.push('--scheduled-for', options.scheduledFor);
  spawn(process.execPath, args, {
    cwd: config.projectRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

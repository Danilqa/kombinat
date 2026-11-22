import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { isMatching, match } from 'ts-pattern';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { RunRecord, RunTrigger, RunWorktree } from 'domains/run/types';
import {
  addTokenCounts,
  checkIsRunActive,
  createRunId,
  mergeBlockedActions,
} from 'domains/run/utils';
import type { RetryOutcome, UsageLimitOutcome } from 'domains/transcript/types';
import { getUsageLimitLabel } from 'domains/transcript/utils';
import { getErrorMessage } from 'utils/error';

import { config, getCliArgs } from '../../config';
import { parseJson } from '../../utils/json';
import { getAgent } from '../agent/registry';
import { writePlanUsage } from '../agent/storage';
import type { Agent, Invocation, OutputEvent, RunContext, UsageLimitStop } from '../agent/types';
import {
  appendMemory,
  appendMemoryReminder,
  checkHasMemoryChangedSince,
  keepMemoryUpdate,
  readMemory,
} from '../routine/memory';
import type { Routine } from '../routine/types';
import type { ChatMessage } from './event-log';
import { appendLogEvent, readLastMessage, readRunEvents } from './event-log';
import { getBeforeHookError, HOOK_TIMEOUT_MS, runHook } from './hooks';
import { appendPayload, takePayload, takePrompt } from './payload';
import { getRunsDir, listRuns, readRunRecord, writeRunRecord } from './storage';
import { checkShouldRetry, getBudgetLeft, planRetry, RETRY_TEXT } from './retry';
import type { AttemptEnd } from './retry';
import { planUsageLimitWait, waitForAction } from './usage-limit';
import { createWorktree, refreshWorktree, restoreWorktree, settleWorktree } from './worktree';

export interface RunOptions {
  trigger: RunTrigger;
  scheduledFor?: string | null;
  runId?: RunId | null;
  conversation?: string | null;
}

const PENDING_START_MS = HOOK_TIMEOUT_MS + 60_000;
const KILL_GRACE_MS = 60_000;
const STDERR_CHUNKS = 200;
const CONTINUE_TEXT = 'The usage limit has reset. Continue the task from where you stopped.';

function checkIsBinaryFound(command: string): boolean {
  if (command.includes('/')) return fs.existsSync(command);
  return (process.env['PATH'] ?? '')
    .split(':')
    .some(dir => dir !== '' && fs.existsSync(path.join(dir, command)));
}

interface KillTimer {
  clear: () => void;
  checkHasFired: () => boolean;
}

// Ctrl-C first so the agent can wrap up, SIGTERM if it is still around a minute later.
function killAfter(child: ChildProcess, ms: number): KillTimer {
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    child.kill('SIGINT');
    setTimeout(() => child.kill('SIGTERM'), KILL_GRACE_MS).unref();
  }, ms);
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

interface AgentRun {
  routine: Routine;
  agent: Agent;
  invocation: Invocation;
  record: RunRecord;
  hookTimeoutMs: number;
  timeoutMs: number;
  persist: (record: RunRecord) => void;
}

interface AgentExit extends AttemptEnd {
  usageLimitStop: UsageLimitStop | null;
  workedMs: number;
}

const exitWith = (outcome: Partial<RunRecord>, workedMs = 0): AgentExit => ({
  outcome,
  canRetry: true,
  usageLimitStop: null,
  workedMs,
});

// A missing folder or binary stays missing, so another attempt would fail the same way.
const failSetup = (error: string): AgentExit => ({
  ...exitWith({ status: 'failed', error }),
  canRetry: false,
});

// Runs the preflight, the before hook and the agent, and returns how the run ended.
async function runAgent({
  routine,
  agent,
  invocation,
  record,
  hookTimeoutMs,
  timeoutMs,
  persist,
}: AgentRun): Promise<AgentExit> {
  if (!fs.existsSync(routine.cwd)) {
    return failSetup(`cwd does not exist: ${routine.cwd} (create it or change cwd in the routine)`);
  }
  if (!checkIsBinaryFound(invocation.command)) {
    const hint =
      agent.binaryEnv === null
        ? ''
        : ` (set ${agent.binaryEnv} to its path before kombinat serve or install)`;
    return failSetup(`${agent.name} binary not found at ${invocation.command}${hint}`);
  }
  if (routine.before !== null) {
    const result = await runHook({
      type: 'before_hook',
      command: routine.before,
      cwd: routine.cwd,
      env: invocation.env,
      input: '',
      timeoutMs: hookTimeoutMs,
      logFile: record.logFile,
    });
    const beforeError = getBeforeHookError(result, hookTimeoutMs);
    if (beforeError !== null) return exitWith({ status: 'failed', error: beforeError });
  }

  const logStart = fs.existsSync(record.logFile) ? fs.statSync(record.logFile).size : 0;
  const spawnedAt = Date.now();
  const child = spawn(invocation.command, invocation.args, {
    cwd: routine.cwd,
    env: invocation.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  record.pid = child.pid ?? null;
  persist(record);

  const log = fs.createWriteStream(record.logFile, { flags: 'a' });
  const stderrChunks: string[] = [];
  child.stderr.on('data', (chunk: Buffer) => {
    stderrChunks.push(String(chunk));
    if (stderrChunks.length > STDERR_CHUNKS) stderrChunks.shift();
  });

  readline.createInterface({ input: child.stdout }).on('line', line => {
    const event = toEvent(agent, line);
    log.write(`${toLogLine(agent, line, event)}\n`);
    if (event === undefined) return;
    const limits = agent.readPlanLimits(event);
    if (limits !== null) {
      writePlanUsage(agent.name, { ...limits, updatedAt: new Date().toISOString() });
    }
    const update = agent.readEvent(event, record);
    Object.assign(record, update);
    if (update.sessionId !== undefined && update.sessionId !== null) {
      record.resumeCommand = agent.getResumeCommand(update.sessionId);
      persist(record);
    }
  });

  const killTimer = killAfter(child, timeoutMs);

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
  await new Promise<void>(resolve => log.end(resolve));
  const workedMs = Date.now() - spawnedAt;
  const events = readRunEvents(record, logStart);
  // Each process reports its own: the run's first, each after a usage limit and each reply.
  record.blockedActions = mergeBlockedActions(
    record.blockedActions,
    agent.readBlockedActions(events),
  );

  if (killTimer.checkHasFired()) {
    return exitWith(
      { status: 'timed_out', exitCode, error: `Killed after ${routine.timeoutMinutes} minutes` },
      workedMs,
    );
  }
  const usageLimitStop = agent.findUsageLimitStop(events);
  const canRetry = !agent.checkIsStoppedByBudget(events);
  if (exitCode !== 0) {
    const stderr = stderrChunks.join('').trim().slice(-2000);
    return {
      outcome: {
        status: 'failed',
        exitCode,
        error: record.error ?? (stderr || `exit code ${exitCode}`),
      },
      canRetry,
      usageLimitStop,
      workedMs,
    };
  }
  return {
    outcome: { status: record.error === null ? 'succeeded' : 'failed', exitCode },
    canRetry,
    usageLimitStop,
    workedMs,
  };
}

function addSpend(before: number | null, after: number | null): number | null {
  return before === null && after === null ? null : (before ?? 0) + (after ?? 0);
}

// Each process reports its own spend, so the run's adds up over the processes of its session.
async function addingSpend<T>(record: RunRecord, work: () => Promise<T>): Promise<T> {
  const spent = {
    costUsd: record.costUsd,
    numTurns: record.numTurns,
    durationMs: record.durationMs,
    tokens: record.tokens,
  };
  Object.assign(record, {
    costUsd: null,
    numTurns: null,
    durationMs: null,
    tokens: null,
    resultText: null,
    error: null,
  });
  const result = await work();
  record.costUsd = addSpend(spent.costUsd, record.costUsd);
  record.numTurns = addSpend(spent.numTurns, record.numTurns);
  record.durationMs = addSpend(spent.durationMs, record.durationMs);
  record.tokens = addTokenCounts(spent.tokens, record.tokens);
  return result;
}

interface LimitedRun extends AgentRun {
  context: RunContext;
}

// Each time a usage limit stops the agent, the run waits for the reset and continues the session.
async function runWaitingOutLimits(run: LimitedRun): Promise<AttemptEnd> {
  const { routine, agent, record, context } = run;
  let exit = await runAgent(run);
  let workedMs = exit.workedMs;
  for (;;) {
    const stop = routine.onUsageLimit === 'wait' ? exit.usageLimitStop : null;
    const wait = stop === null ? null : planUsageLimitWait(stop);
    const invocation =
      wait === null || record.sessionId === null
        ? null
        : agent.buildReplyInvocation(context, record.sessionId, {
            text: CONTINUE_TEXT,
            source: 'usage_limit',
          });
    if (wait === null || invocation === null) {
      return { outcome: exit.outcome, canRetry: exit.canRetry && exit.usageLimitStop === null };
    }

    appendLogEvent(record, { type: 'usage_limit_wait', ...wait });
    writeRunRecord({
      ...record,
      status: 'waiting',
      pid: process.pid,
      resultText: null,
      error: null,
      usageLimit: wait,
    });
    const action = await waitForAction(record, wait.continuesAt);
    appendLogEvent(record, {
      type: 'usage_limit_end',
      at: new Date().toISOString(),
      outcome: match(action)
        .with('stop', (): UsageLimitOutcome => 'stopped')
        .with('continue', (): UsageLimitOutcome => 'continued')
        .exhaustive(),
    });
    if (isMatching('stop', action)) {
      return {
        outcome: {
          ...exit.outcome,
          status: 'failed',
          error:
            exit.outcome.error ??
            record.error ??
            `Stopped waiting for the ${getUsageLimitLabel(wait.limit)} to reset`,
        },
        canRetry: false,
      };
    }

    exit = await addingSpend(record, () =>
      runAgent({
        ...run,
        routine: { ...routine, before: null },
        invocation,
        timeoutMs: routine.timeoutMinutes * 60_000 - workedMs,
      }),
    );
    workedMs += exit.workedMs;
  }
}

// An attempt that stops with an error is tried again after a while, up to the routine's retries. The
// next attempt continues the session when there is one, and starts over with the before hook when not.
async function runRetryingErrors(run: LimitedRun): Promise<Partial<RunRecord>> {
  const { routine, agent, record } = run;
  const getRunBudgetLeft = () => getBudgetLeft(routine.maxBudgetUsd, record.costUsd);
  let end = await runWaitingOutLimits(run);
  for (
    let attempt = 1;
    checkShouldRetry(end, attempt, routine.retries, getRunBudgetLeft());
    attempt += 1
  ) {
    const context: RunContext = {
      ...run.context,
      routine: { ...run.context.routine, maxBudgetUsd: getRunBudgetLeft() },
    };
    const sessionInvocation =
      record.sessionId === null
        ? null
        : agent.buildReplyInvocation(context, record.sessionId, {
            text: RETRY_TEXT,
            source: 'retry',
          });
    const retry = planRetry({
      attempt,
      retries: routine.retries,
      error: end.outcome.error ?? record.error ?? 'The run stopped with an error',
      continuesSession: sessionInvocation !== null,
    });
    appendLogEvent(record, { type: 'retry_wait', ...retry });
    writeRunRecord({
      ...record,
      status: 'retrying',
      pid: process.pid,
      resultText: null,
      error: null,
      retry,
    });
    const action = await waitForAction(record, retry.continuesAt);
    appendLogEvent(record, {
      type: 'retry_end',
      at: new Date().toISOString(),
      outcome: match(action)
        .with('stop', (): RetryOutcome => 'stopped')
        .with('continue', (): RetryOutcome => 'retried')
        .exhaustive(),
    });
    if (isMatching('stop', action)) return end.outcome;

    record.retry = retry;
    // The runner's own pid keeps the run from being reconciled as aborted until its agent starts.
    writeRunRecord({ ...record, pid: process.pid });
    end = await addingSpend(record, () =>
      runWaitingOutLimits({
        ...run,
        routine: sessionInvocation === null ? routine : { ...routine, before: null },
        invocation: sessionInvocation ?? agent.buildInvocation(context),
        context,
      }),
    );
  }
  return end.outcome;
}

interface WorkPlace {
  routine: Routine;
  error: string | null;
}

// With worktree: true the run works in a worktree of its own, so everything starts in its cwd.
async function prepareWorkPlace(routine: Routine, record: RunRecord): Promise<WorkPlace> {
  if (!routine.worktree || !fs.existsSync(routine.cwd)) return { routine, error: null };
  try {
    record.worktree = await createWorktree(routine.name, record.id, routine.cwd);
    return { routine: { ...routine, cwd: record.worktree.cwd }, error: null };
  } catch (error) {
    return { routine, error: getErrorMessage(error) };
  }
}

export async function runRoutine(
  routine: Routine,
  options: RunOptions,
  hookTimeoutMs = HOOK_TIMEOUT_MS,
): Promise<RunRecord> {
  const agent = getAgent(routine.agent);
  const id = options.runId ?? createRunId();
  const runsDir = getRunsDir(routine.name);
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
    logFile: path.join(runsDir, `${id}.jsonl`),
    replyPid: null,
    conversation: options.conversation ?? null,
    usageLimit: null,
    retry: null,
    tokens: null,
    blockedActions: [],
    memorySentAt: null,
    worktree: null,
  };

  const workPlace = await prepareWorkPlace(routine, record);
  const workRoutine = workPlace.routine;
  const prompt = takePrompt(routine.name, id) ?? routine.prompt;
  const payload = takePayload(routine.name, id);
  const withPayload = payload === null ? prompt : appendPayload(prompt, payload);
  const memory = routine.memory ? readMemory(routine.name) : null;
  const task = {
    ...workRoutine,
    prompt: memory === null ? withPayload : appendMemory(withPayload, memory),
  };
  const context: RunContext = { routine: task, runId: id, trigger: options.trigger };
  const invocation = agent.buildInvocation(context);
  const outcome: Partial<RunRecord> =
    workPlace.error === null
      ? await runRetryingErrors({
          routine: workRoutine,
          agent,
          invocation,
          record,
          hookTimeoutMs,
          timeoutMs: routine.timeoutMinutes * 60_000,
          persist: writeRunRecord,
          context,
        })
      : { status: 'failed', error: workPlace.error };
  if (memory !== null) {
    record.resultText = keepMemoryUpdate(routine.name, id, record.resultText, memory);
  }
  if (record.worktree !== null) record.worktree = await refreshWorktree(record.worktree);
  const finished: RunRecord = { ...record, ...outcome, endedAt: new Date().toISOString() };
  try {
    if (routine.after !== null) {
      // The agent has exited, so the runner's own pid keeps the run from being reconciled as aborted.
      writeRunRecord({ ...record, status: 'running', pid: process.pid });
      await runHook({
        type: 'after_hook',
        command: routine.after,
        cwd: fs.existsSync(workRoutine.cwd) ? workRoutine.cwd : config.projectRoot,
        env: {
          ...invocation.env,
          KOMBINAT_ROUTINE: finished.routine,
          KOMBINAT_RUN_ID: finished.id,
          KOMBINAT_TRIGGER: finished.trigger,
          KOMBINAT_RUN_STATUS: finished.status,
        },
        input: `${JSON.stringify(finished)}\n`,
        timeoutMs: hookTimeoutMs,
        logFile: record.logFile,
      });
    }
  } finally {
    if (finished.worktree !== null) finished.worktree = await settleWorktree(finished.worktree);
    writeRunRecord(finished);
  }
  return finished;
}

interface ReplyWorktree {
  worktree: RunWorktree | null;
  error: string | null;
}

async function prepareReplyWorktree(run: RunRecord): Promise<ReplyWorktree> {
  if (run.worktree === null) return { worktree: null, error: null };
  try {
    return { worktree: await restoreWorktree(run.worktree), error: null };
  } catch (error) {
    return {
      worktree: run.worktree,
      error: `Could not bring back the worktree: ${getErrorMessage(error)}`,
    };
  }
}

// Resumes the run's session with the last message of its log. The hooks belong to the run, not to replies.
export async function replyToRun(routine: Routine, run: RunRecord): Promise<RunRecord> {
  const agent = getAgent(run.agent);
  const memoryReadAt = new Date().toISOString();
  const memory = routine.memory ? readMemory(routine.name) : null;
  const isMemorySent =
    memory !== null &&
    checkHasMemoryChangedSince(routine.name, run.id, run.memorySentAt ?? run.startedAt);
  const { worktree, error: worktreeError } = await prepareReplyWorktree(run);
  const replying: RunRecord = {
    ...run,
    replyPid: process.pid,
    memorySentAt: isMemorySent ? memoryReadAt : run.memorySentAt,
    worktree,
  };
  writeRunRecord(replying);
  const workRoutine = worktree === null ? routine : { ...routine, cwd: worktree.cwd };
  const message = readLastMessage(run);
  const invocation =
    routine.agent === run.agent && run.sessionId !== null && message !== null
      ? agent.buildReplyInvocation(
          { routine: workRoutine, runId: run.id, trigger: run.trigger },
          run.sessionId,
          memory === null
            ? message
            : {
                ...message,
                text: isMemorySent
                  ? appendMemory(message.text, memory)
                  : appendMemoryReminder(message.text),
              },
        )
      : null;
  // A reply that allows the blocked actions reports what it is still blocked from. Until it succeeds, the run keeps them.
  const isAllowing = message?.allowedTools !== undefined;
  const session: RunRecord = {
    ...replying,
    error: null,
    blockedActions: isAllowing ? [] : run.blockedActions,
  };
  const outcome: Partial<RunRecord> =
    worktreeError !== null
      ? { status: 'failed', error: worktreeError }
      : invocation === null
        ? { status: 'failed', error: `This ${run.agent} run has no session to continue` }
        : (
            await runAgent({
              routine: { ...workRoutine, before: null },
              agent,
              invocation,
              record: session,
              hookTimeoutMs: HOOK_TIMEOUT_MS,
              timeoutMs: routine.timeoutMinutes * 60_000,
              persist: ({ sessionId, resumeCommand }) =>
                writeRunRecord({ ...replying, sessionId, resumeCommand }),
            })
          ).outcome;
  if (memory !== null) keepMemoryUpdate(routine.name, run.id, session.resultText, memory);
  const isSucceeded = isMatching({ status: 'succeeded' }, outcome);
  // An error the agent reported is in its own events already.
  if (!isSucceeded && session.error === null) {
    appendLogEvent(run, { type: 'reply_error', error: outcome.error ?? 'The reply failed' });
  }
  const finished: RunRecord = {
    ...run,
    memorySentAt: isSucceeded ? replying.memorySentAt : run.memorySentAt,
    sessionId: session.sessionId,
    resumeCommand: session.resumeCommand,
    replyPid: null,
    blockedActions: isAllowing && !isSucceeded ? run.blockedActions : session.blockedActions,
    worktree: worktree === null ? null : await settleWorktree(worktree),
  };
  writeRunRecord(finished);
  return finished;
}

interface PendingStart {
  runId: RunId;
  startedAt: number;
  conversation: string | null;
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

export function findStartingConversationRun(
  routineName: RoutineName,
  conversation: string,
): RunId | null {
  const pending = pendingStarts.get(routineName);
  return checkIsStarting(routineName) && pending?.conversation === conversation
    ? pending.runId
    : null;
}

export function checkIsRunning(routineName: RoutineName): boolean {
  return checkIsStarting(routineName) || listRuns(routineName).some(checkIsRunActive);
}

export function startDetachedRun(routineName: RoutineName, options: RunOptions): void {
  const runId = options.runId ?? createRunId();
  const args = getCliArgs('run', routineName, '--trigger', options.trigger, '--run-id', runId);
  if (options.scheduledFor) args.push('--scheduled-for', options.scheduledFor);
  // With =, a key that starts with a dash is still the value.
  if (options.conversation) args.push(`--conversation=${options.conversation}`);
  pendingStarts.set(routineName, {
    runId,
    startedAt: Date.now(),
    conversation: options.conversation ?? null,
  });
  spawn(process.execPath, args, {
    cwd: config.projectRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

export function startDetachedReply(run: RunRecord, message: ChatMessage): void {
  appendLogEvent(run, { type: 'message', ...message });
  const child = spawn(process.execPath, getCliArgs('reply', run.routine, run.id), {
    cwd: config.projectRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  // Written at once, so the run counts as replying before the reply process starts.
  writeRunRecord({ ...run, replyPid: child.pid ?? null });
  child.unref();
}

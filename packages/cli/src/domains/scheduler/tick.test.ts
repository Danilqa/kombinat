import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';
import type { RunRecord } from 'domains/run/types';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
const routinesDir = path.join(tmp, 'routines');
const stateDir = path.join(tmp, 'state');
process.env['KOMBINAT_ROUTINES_DIR'] = routinesDir;
process.env['KOMBINAT_STATE_DIR'] = stateDir;
process.env['KOMBINAT_MAX_CONCURRENT'] = '3';
// Replies that the ticks start fail at once instead of running a real claude.
process.env['CLAUDE_BIN'] = path.join(tmp, 'missing-claude');
fs.mkdirSync(routinesDir);

const everyMinute = routineNameSchema.parse('every-minute');
const triage = routineNameSchema.parse('triage');
const paused = routineNameSchema.parse('paused');
const chat = routineNameSchema.parse('chat');

const { tick } = await import('./tick');
const { readSchedulerState, writeSchedulerState } = await import('./storage');
const { writeRunRecord } = await import('../run/storage');
const { checkIsRunning, startDetachedRun } = await import('../run/runner');
const { countQueuedWebhooks, enqueueWebhook } = await import('../webhook/queue');
const { readOneTimeRuns, writeOneTimeRuns } = await import('./one-time-runs');
const { readQueuedRuns, writeQueuedRuns } = await import('../run/queued-runs');
const { writePlanUsage } = await import('../agent/storage');
const { makeRunRecord } = await import('domains/run/mocks');
const { accountNameSchema, sessionIdSchema } = await import('domains/agent/ids');

const makeWebhook = (runId: string, payload: string, conversation: string | null = null) => ({
  runId: runIdSchema.parse(runId),
  payload,
  conversation,
});

function readLog(file: string): unknown[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));
}

function writeRoutine(name: string, frontmatter: string): void {
  fs.writeFileSync(
    path.join(routinesDir, `${name}.md`),
    `---\nname: ${name}\ncwd: /tmp\n${frontmatter}\n---\nHello`,
  );
}

test('first tick only records the tick time', () => {
  writeRoutine('every-minute', 'schedule: "* * * * *"\nenabled: false');
  const now = new Date('2026-09-30T10:00:30');
  const result = tick(now);
  assert.deepEqual(result, { started: [], continued: [], skipped: [], checks: [] });
  assert.equal(readSchedulerState()?.lastTickAt, now.toISOString());
});

test('disabled routines are skipped with a reason', () => {
  const result = tick(new Date('2026-09-30T10:01:30'));
  assert.deepEqual(result.started, []);
  const skips = readSchedulerState()?.routines[everyMinute]?.skips ?? [];
  assert.equal(skips.at(-1)?.reason, 'disabled');
  assert.equal(skips.at(-1)?.scheduledFor, new Date('2026-09-30T10:01:00').toISOString());
});

test('a routine that is still running is skipped and not started twice', () => {
  writeRoutine('every-minute', 'schedule: "* * * * *"');
  writeRunRecord({
    id: runIdSchema.parse('r1'),
    routine: everyMinute,
    agent: 'claude',
    account: null,
    trigger: 'manual',
    scheduledFor: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'running',
    pid: process.pid,
    exitCode: null,
    sessionId: null,
    resumeCommand: null,
    model: 'x',
    costUsd: null,
    numTurns: null,
    durationMs: null,
    resultText: null,
    error: null,
    logFile: path.join(tmp, 'r1.jsonl'),
    replyPid: null,
    conversation: null,
    usageLimit: null,
    retry: null,
    tokens: null,
    blockedActions: [],
    memorySentAt: null,
    worktree: null,
  });
  const result = tick(new Date('2026-09-30T10:02:30'));
  assert.deepEqual(result.started, []);
  assert.deepEqual(result.skipped, ['every-minute (already running)']);
  assert.equal(
    readSchedulerState()?.routines[everyMinute]?.skips.at(-1)?.reason,
    'already_running',
  );
});

test('runs past their usage limit reset continue, oldest first, only into slots that no run takes', () => {
  const now = new Date('2026-09-30T10:02:40');
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const writeWaitingRun = (name: string, startedAgo: number, continuesAgo: number) => {
    const run = makeRunRecord({
      id: runIdSchema.parse(`${name}-1`),
      routine: routineNameSchema.parse(name),
      status: 'waiting',
      startedAt: minutesAgo(startedAgo),
      endedAt: null,
      pid: process.pid,
      logFile: path.join(tmp, `${name}-1.jsonl`),
      usageLimit: {
        limit: 'session',
        stoppedAt: minutesAgo(60),
        continuesAt: minutesAgo(continuesAgo),
      },
    });
    writeRunRecord(run);
    return run;
  };
  const first = writeWaitingRun('reset-first', 300, 2);
  const second = writeWaitingRun('reset-second', 200, 1);
  const later = writeWaitingRun('reset-later', 400, -5);
  // Its before hook keeps it from writing a record, so only the daemon knows it started.
  writeRoutine('hooked', 'before: sleep 1\nagent: command\ncommand: "true"');
  startDetachedRun(routineNameSchema.parse('hooked'), { trigger: 'manual' });

  assert.deepEqual(tick(now).continued, ['reset-first']);
  const getActionFile = (run: RunRecord) =>
    path.join(stateDir, 'runs', run.routine, `${run.id}.wait`);
  assert.equal(fs.readFileSync(getActionFile(first), 'utf8'), 'continue');
  assert.equal(fs.existsSync(getActionFile(second)), false);
  assert.equal(fs.existsSync(getActionFile(later)), false);
  for (const run of [first, second, later]) {
    writeRunRecord({ ...run, status: 'succeeded', usageLimit: null });
  }
  fs.rmSync(path.join(routinesDir, 'hooked.md'));
});

test('a run whose retry time has come gets its next attempt, and one that waits keeps waiting', () => {
  const now = new Date('2026-09-30T10:02:45');
  const minutesFromNow = (minutes: number) =>
    new Date(now.getTime() + minutes * 60_000).toISOString();
  const writeRetryingRun = (name: string, continuesIn: number) => {
    const run = makeRunRecord({
      id: runIdSchema.parse(`${name}-1`),
      routine: routineNameSchema.parse(name),
      status: 'retrying',
      pid: process.pid,
      logFile: path.join(tmp, `${name}-1.jsonl`),
      retry: {
        attempt: 2,
        attempts: 3,
        error: 'API Error: Stream idle timeout',
        stoppedAt: minutesFromNow(-6),
        continuesAt: minutesFromNow(continuesIn),
        continuesSession: true,
      },
    });
    writeRunRecord(run);
    return run;
  };
  const due = writeRetryingRun('retry-due', -1);
  const waiting = writeRetryingRun('retry-waiting', 3);

  assert.deepEqual(tick(now).continued, ['retry-due']);
  const getActionFile = (run: RunRecord) =>
    path.join(stateDir, 'runs', run.routine, `${run.id}.wait`);
  assert.equal(fs.readFileSync(getActionFile(due), 'utf8'), 'continue');
  assert.equal(fs.existsSync(getActionFile(waiting)), false);
  for (const run of [due, waiting]) writeRunRecord({ ...run, status: 'succeeded' });
});

test('a run that waits for a usage limit keeps its routine busy but takes no slot', () => {
  const waitingNames = ['wait-a', 'wait-b', 'wait-c'];
  for (const name of waitingNames) {
    writeRoutine(name, 'schedule: "* * * * *"');
    writeRunRecord(
      makeRunRecord({
        id: runIdSchema.parse(`${name}-1`),
        routine: routineNameSchema.parse(name),
        status: 'waiting',
        pid: process.pid,
        logFile: path.join(tmp, `${name}-1.jsonl`),
        usageLimit: {
          limit: 'session',
          stoppedAt: '2026-09-30T10:00:00Z',
          continuesAt: '2026-09-30T11:01:00Z',
        },
      }),
    );
  }
  writeRoutine('free', 'schedule: "* * * * *"\nagent: command\ncommand: "true"');

  const result = tick(new Date('2026-09-30T10:03:30'));
  assert.deepEqual(result.started, ['free']);
  for (const name of waitingNames) assert.ok(result.skipped.includes(`${name} (already running)`));
  for (const name of [...waitingNames, 'free']) fs.rmSync(path.join(routinesDir, `${name}.md`));
});

test('catch-up window never reaches back before the last tick', () => {
  const state = readSchedulerState();
  assert.ok(state);
  state.lastTickAt = new Date('2026-09-30T10:02:30').toISOString();
  writeSchedulerState(state);
  fs.rmSync(path.join(stateDir, 'runs'), { recursive: true });
  writeRoutine('every-minute', 'schedule: "0 9 * * *"\nenabled: false');
  tick(new Date('2026-10-02T10:00:00'));
  const skips = readSchedulerState()?.routines[everyMinute]?.skips ?? [];
  assert.equal(skips.at(-1)?.scheduledFor, new Date('2026-10-02T09:00:00').toISOString());
});

test('a due one-time run waits while its routine runs, and one of a disabled or deleted routine is dropped', () => {
  writeRoutine('later', 'agent: command\ncommand: "true"');
  writeRoutine('paused', 'enabled: false');
  const later = routineNameSchema.parse('later');
  const oneTimeRun = (routine: string, local: string) => ({
    routine: routineNameSchema.parse(routine),
    at: new Date(local).toISOString(),
  });
  const overdue = oneTimeRun('later', '2026-10-02T09:50:00');
  const upcoming = oneTimeRun('later', '2026-10-02T10:30:00');
  writeOneTimeRuns([
    overdue,
    oneTimeRun('gone', '2026-10-02T09:55:00'),
    oneTimeRun('paused', '2026-10-02T09:58:00'),
    upcoming,
  ]);
  const running = makeRunRecord({
    id: runIdSchema.parse('l1'),
    routine: later,
    status: 'running',
    pid: process.pid,
  });
  writeRunRecord(running);

  assert.deepEqual(tick(new Date('2026-10-02T10:00:20')).started, []);
  assert.deepEqual(readOneTimeRuns(), [overdue, upcoming]);
  const pausedEntry = readSchedulerState()?.routines[paused];
  assert.deepEqual(pausedEntry?.skips.at(-1), {
    at: new Date('2026-10-02T10:00:20').toISOString(),
    scheduledFor: new Date('2026-10-02T09:58:00').toISOString(),
    reason: 'disabled',
    checkOutput: null,
  });
  assert.equal(pausedEntry.lastScheduledFor, null);

  writeRunRecord({ ...running, status: 'succeeded' });
  assert.deepEqual(tick(new Date('2026-10-02T10:00:40')).started, [later]);
  assert.deepEqual(readOneTimeRuns(), [upcoming]);
  writeOneTimeRuns([]);
  fs.rmSync(path.join(routinesDir, 'later.md'));
});

test('after a sleep, the due one-time runs of a routine run once, within the catch-up window', () => {
  writeRoutine('nightly', 'schedule: "0 2 * * *"\nagent: command\ncommand: "true"');
  writeRoutine('manual', 'agent: command\ncommand: "true"');
  const nightly = routineNameSchema.parse('nightly');
  const manual = routineNameSchema.parse('manual');
  const oneTimeRun = (routine: string, local: string) => ({
    routine: routineNameSchema.parse(routine),
    at: new Date(local).toISOString(),
  });
  const upcoming = oneTimeRun('nightly', '2026-10-03T09:00:00');
  writeOneTimeRuns([
    oneTimeRun('manual', '2026-09-24T09:00:00'),
    oneTimeRun('manual', '2026-09-28T09:00:00'),
    oneTimeRun('nightly', '2026-09-30T02:00:00'),
    oneTimeRun('manual', '2026-10-01T09:00:00'),
    oneTimeRun('nightly', '2026-10-01T09:00:00'),
    upcoming,
  ]);
  const state = readSchedulerState();
  assert.ok(state);
  state.lastTickAt = new Date('2026-09-22T10:00:00').toISOString();
  writeSchedulerState(state);

  assert.deepEqual(tick(new Date('2026-10-02T10:00:50')).started, [nightly, manual]);
  assert.deepEqual(readOneTimeRuns(), [upcoming]);
  writeOneTimeRuns([]);
  for (const name of ['nightly', 'manual']) fs.rmSync(path.join(routinesDir, `${name}.md`));
});

test('queued webhooks start one at a time once their routine is idle', () => {
  writeRoutine('triage', 'webhook: true\nagent: command\ncommand: "true"');
  enqueueWebhook(triage, makeWebhook('20261109T120000Z-aaaa', '{"n":1}'));
  enqueueWebhook(triage, makeWebhook('20261109T120000Z-bbbb', '{"n":2}'));
  const running = makeRunRecord({
    id: runIdSchema.parse('r2'),
    routine: triage,
    status: 'running',
    pid: process.pid,
  });
  writeRunRecord(running);
  assert.deepEqual(tick(new Date('2026-10-02T10:01:00')).started, []);
  assert.equal(countQueuedWebhooks(triage), 2);

  writeRunRecord({ ...running, status: 'succeeded' });
  assert.deepEqual(tick(new Date('2026-10-02T10:02:00')).started, ['triage']);
  assert.equal(countQueuedWebhooks(triage), 1);
  assert.deepEqual(tick(new Date('2026-10-02T10:03:00')).started, []);
  assert.equal(countQueuedWebhooks(triage), 1);
});

test('a disabled routine keeps its queued webhooks', () => {
  writeRoutine('paused', 'webhook: true\nenabled: false\nagent: command\ncommand: "true"');
  enqueueWebhook(paused, makeWebhook('20261109T120000Z-cccc', ''));
  assert.deepEqual(tick(new Date('2026-10-02T10:04:00')).started, []);
  assert.equal(countQueuedWebhooks(paused), 1);
});

test('a queued webhook of a conversation continues the run that has it', () => {
  writeRoutine('chat', 'webhook: true');
  const runsDir = path.join(stateDir, 'runs', 'chat');
  fs.mkdirSync(runsDir, { recursive: true });
  const makeChatRun = (id: string, startedAt: string, conversation: string) =>
    makeRunRecord({
      id: runIdSchema.parse(id),
      routine: chat,
      status: 'succeeded',
      startedAt,
      sessionId: sessionIdSchema.parse(`session-${id}`),
      resumeCommand: `claude --resume session-${id}`,
      logFile: path.join(runsDir, `${id}.jsonl`),
      conversation,
    });
  const older = makeChatRun('c1', '2026-10-02T09:00:00Z', 'issue-1');
  const newer = makeChatRun('c2', '2026-10-02T09:30:00Z', 'issue-1');
  const other = makeChatRun('c3', '2026-10-02T09:45:00Z', 'issue-2');
  for (const run of [older, newer, other]) writeRunRecord(run);
  enqueueWebhook(chat, makeWebhook('20261118T120000Z-aaaa', 'Fix the test too', 'issue-1'));

  assert.ok(tick(new Date('2026-10-02T10:05:00')).started.includes(chat));
  assert.equal(countQueuedWebhooks(chat), 0);
  assert.deepEqual(readLog(newer.logFile)[0], {
    type: 'message',
    text: 'Fix the test too',
    source: 'webhook',
  });
  assert.deepEqual(readLog(older.logFile), []);
  assert.deepEqual(readLog(other.logFile), []);
  assert.equal(fs.existsSync(path.join(runsDir, '20261118T120000Z-aaaa.payload')), false);
});

test('a queued webhook of a conversation whose run cannot continue starts a run of its own', () => {
  writeRoutine('fresh', 'webhook: true');
  const fresh = routineNameSchema.parse('fresh');
  const runsDir = path.join(stateDir, 'runs', 'fresh');
  fs.mkdirSync(runsDir, { recursive: true });
  const failed = makeRunRecord({
    id: runIdSchema.parse('f1'),
    routine: fresh,
    status: 'failed',
    logFile: path.join(runsDir, 'f1.jsonl'),
    conversation: 'issue-1',
  });
  writeRunRecord(failed);
  enqueueWebhook(fresh, makeWebhook('20261118T120000Z-bbbb', 'Fix the test', 'issue-1'));

  assert.ok(tick(new Date('2026-10-02T10:06:00')).started.includes(fresh));
  assert.equal(countQueuedWebhooks(fresh), 0);
  assert.deepEqual(readLog(failed.logFile), []);
  assert.equal(
    fs.readFileSync(path.join(runsDir, '20261118T120000Z-bbbb.payload'), 'utf8'),
    'Fix the test',
  );
});

// The runs of the tests before start real processes, which hold their slots until their records appear.
async function waitUntilIdle(): Promise<void> {
  const names = fs
    .readdirSync(routinesDir)
    .map(file => routineNameSchema.parse(path.basename(file, '.md')));
  for (let i = 0; i < 100 && names.some(name => checkIsRunning(name)); i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

test('a check that finds nothing to do skips the scheduled time with what it printed, and starts no run', async () => {
  writeRoutine(
    'watcher',
    'schedule: "* * * * *"\nagent: command\ncommand: "true"\ncheck: echo "Waiting for review: 0"; exit 78',
  );
  const watcher = routineNameSchema.parse('watcher');
  await waitUntilIdle();
  const result = tick(new Date('2026-10-02T10:07:30'));
  assert.equal(result.started.includes(watcher), false);
  assert.deepEqual(await Promise.all(result.checks), ['skipped watcher (nothing to do)']);
  const entry = readSchedulerState()?.routines[watcher];
  assert.equal(entry?.lastScheduledFor, new Date('2026-10-02T10:07:00').toISOString());
  const skip = entry.skips.at(-1);
  assert.equal(skip?.scheduledFor, new Date('2026-10-02T10:07:00').toISOString());
  assert.equal(skip.reason, 'nothing_to_do');
  assert.equal(skip.checkOutput, 'Waiting for review: 0');
  assert.equal(fs.existsSync(path.join(stateDir, 'runs', 'watcher')), false);
});

test('a check that finds work, or fails, starts the run with the check first in its log', async () => {
  const watcher = routineNameSchema.parse('watcher');
  const readCheckLines = () =>
    fs
      .readdirSync(path.join(stateDir, 'runs', 'watcher'))
      .filter(file => file.endsWith('.jsonl'))
      .map(file => readLog(path.join(stateDir, 'runs', 'watcher', file))[0]);
  const cases = [
    { check: 'echo "Waiting for review: 2"', exitCode: 0, output: 'Waiting for review: 2' },
    { check: 'echo "gh: not logged in" >&2; exit 4', exitCode: 4, output: 'gh: not logged in' },
  ];
  for (const [index, { check }] of cases.entries()) {
    writeRoutine(
      'watcher',
      `schedule: "* * * * *"\nagent: command\ncommand: "true"\ncheck: ${check}`,
    );
    await waitUntilIdle();
    const result = tick(new Date(`2026-10-02T10:0${8 + index}:30`));
    assert.deepEqual(await Promise.all(result.checks), ['started watcher']);
  }
  assert.deepEqual(
    new Set(readCheckLines()),
    new Set(
      cases.map(({ check, exitCode, output }) => ({
        type: 'check',
        command: check,
        exitCode,
        output,
      })),
    ),
  );
  assert.equal(readSchedulerState()?.routines[watcher]?.skips.length, 1);
  fs.rmSync(path.join(routinesDir, 'watcher.md'));
});

const makeQueuedRun = (routine: string, id: string, maxParallel: number) => ({
  routine: routineNameSchema.parse(routine),
  id: runIdSchema.parse(id),
  trigger: 'manual' as const,
  scheduledFor: null,
  maxParallel,
  queuedAt: '2026-10-02T10:10:00Z',
});

test('a scheduled time of a routine with runs starts the runs it allows at once and queues the rest', async () => {
  writeRoutine('queue-batch', 'schedule: "11 10 * * *"\nagent: command\ncommand: "true"\nruns: 3');
  writeRoutine(
    'parallel-batch',
    'schedule: "11 10 * * *"\nagent: command\ncommand: "true"\nruns: 3\nmaxParallel: 2',
  );
  const queueBatch = routineNameSchema.parse('queue-batch');
  const parallelBatch = routineNameSchema.parse('parallel-batch');
  await waitUntilIdle();

  const result = tick(new Date('2026-10-02T10:11:30'));
  assert.deepEqual(result.started.toSorted(), [parallelBatch, parallelBatch, queueBatch]);
  const queued = readQueuedRuns();
  assert.deepEqual(
    queued.map(({ routine, maxParallel, scheduledFor }) => ({
      routine,
      maxParallel,
      scheduledFor,
    })),
    [
      {
        routine: parallelBatch,
        maxParallel: 2,
        scheduledFor: new Date('2026-10-02T10:11:00').toISOString(),
      },
      {
        routine: queueBatch,
        maxParallel: 1,
        scheduledFor: new Date('2026-10-02T10:11:00').toISOString(),
      },
      {
        routine: queueBatch,
        maxParallel: 1,
        scheduledFor: new Date('2026-10-02T10:11:00').toISOString(),
      },
    ].toSorted((a, b) => a.routine.localeCompare(b.routine)),
  );
  assert.equal(checkIsRunning(queueBatch), true);
  writeQueuedRuns([]);
  for (const name of ['queue-batch', 'parallel-batch']) {
    fs.rmSync(path.join(routinesDir, `${name}.md`));
  }
});

test('a queued run starts once its routine has fewer runs at work than its start allows', async () => {
  writeRoutine('drain', 'schedule: "0 12 * * *"\nagent: command\ncommand: "true"');
  const drain = routineNameSchema.parse('drain');
  await waitUntilIdle();
  const working = makeRunRecord({
    id: runIdSchema.parse('d0'),
    routine: drain,
    status: 'running',
    pid: process.pid,
  });
  writeRunRecord(working);
  writeQueuedRuns([
    makeQueuedRun('drain', '20261002T101000Z-dr01', 2),
    makeQueuedRun('drain', '20261002T101000Z-dr02', 2),
  ]);

  assert.deepEqual(tick(new Date('2026-10-02T10:12:30')).started, [drain]);
  assert.deepEqual(
    readQueuedRuns().map(({ id }) => id),
    ['20261002T101000Z-dr02'],
  );
  writeRunRecord({ ...working, status: 'succeeded' });
  writeQueuedRuns([]);
});

test('a scheduled time of a routine with queued runs is skipped, as the routine is still running', async () => {
  writeRoutine('drain', 'schedule: "13 10 * * *"\nagent: command\ncommand: "true"');
  const drain = routineNameSchema.parse('drain');
  await waitUntilIdle();
  writeRunRecord(
    makeRunRecord({
      id: runIdSchema.parse('d1'),
      routine: drain,
      status: 'running',
      pid: process.pid,
    }),
  );
  writeQueuedRuns([makeQueuedRun('drain', '20261002T101000Z-dr03', 1)]);

  const result = tick(new Date('2026-10-02T10:13:30'));
  assert.deepEqual(result.started, []);
  assert.ok(result.skipped.includes('drain (already running)'));
  writeRunRecord(
    makeRunRecord({ id: runIdSchema.parse('d1'), routine: drain, status: 'succeeded' }),
  );
  writeQueuedRuns([]);
  fs.rmSync(path.join(routinesDir, 'drain.md'));
});

test('queued Claude runs wait while the plan is at a usage limit and start after its reset', async () => {
  writeRoutine('limited', 'agent: claude');
  writeRoutine('local', 'agent: command\ncommand: "true"');
  const limited = routineNameSchema.parse('limited');
  const local = routineNameSchema.parse('local');
  await waitUntilIdle();
  writePlanUsage('claude', null, {
    updatedAt: '2026-10-02T10:10:00Z',
    session: { usedRatio: 1, resetsAt: new Date('2026-10-02T11:00:00').toISOString() },
    week: { usedRatio: 0.4, resetsAt: new Date('2026-10-05T11:00:00').toISOString() },
  });
  writeQueuedRuns([
    makeQueuedRun('limited', '20261002T101000Z-li01', 1),
    makeQueuedRun('local', '20261002T101000Z-lo01', 1),
  ]);

  assert.deepEqual(tick(new Date('2026-10-02T10:14:30')).started, [local]);
  assert.deepEqual(
    readQueuedRuns().map(({ routine }) => routine),
    [limited],
  );
  assert.deepEqual(tick(new Date('2026-10-02T11:00:30')).started, [limited]);
  assert.deepEqual(readQueuedRuns(), []);
  for (const name of ['limited', 'local']) fs.rmSync(path.join(routinesDir, `${name}.md`));
});

test('queued Claude runs wait only for the limit of their own account', async () => {
  writeRoutine('home', 'agent: claude');
  writeRoutine('office', 'agent: claude\naccount: work');
  const home = routineNameSchema.parse('home');
  const office = routineNameSchema.parse('office');
  await waitUntilIdle();
  writePlanUsage('claude', accountNameSchema.parse('work'), {
    updatedAt: '2026-10-03T10:10:00Z',
    session: { usedRatio: 1, resetsAt: new Date('2026-10-03T11:00:00').toISOString() },
    week: null,
  });
  writeQueuedRuns([
    makeQueuedRun('office', '20261003T101000Z-of01', 1),
    makeQueuedRun('home', '20261003T101000Z-ho01', 1),
  ]);

  assert.deepEqual(tick(new Date('2026-10-03T10:14:30')).started, [home]);
  assert.deepEqual(
    readQueuedRuns().map(({ routine }) => routine),
    [office],
  );
  assert.deepEqual(tick(new Date('2026-10-03T11:00:30')).started, [office]);
  for (const name of ['home', 'office']) fs.rmSync(path.join(routinesDir, `${name}.md`));
});

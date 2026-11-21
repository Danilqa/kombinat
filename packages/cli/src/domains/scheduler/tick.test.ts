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
const { startDetachedRun } = await import('../run/runner');
const { countQueuedWebhooks, enqueueWebhook } = await import('../webhook/queue');
const { readOneTimeRuns, writeOneTimeRuns } = await import('./one-time-runs');
const { makeRunRecord } = await import('domains/run/mocks');
const { sessionIdSchema } = await import('domains/agent/ids');

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
  assert.deepEqual(result, { started: [], continued: [], skipped: [] });
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
    tokens: null,
    blockedActions: [],
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

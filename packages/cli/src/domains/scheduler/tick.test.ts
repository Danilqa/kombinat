import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineIdSchema, runIdSchema } from 'domains/id/schemas';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
const routinesDir = path.join(tmp, 'routines');
const stateDir = path.join(tmp, 'state');
process.env['KOMBINAT_ROUTINES_DIR'] = routinesDir;
process.env['KOMBINAT_STATE_DIR'] = stateDir;
fs.mkdirSync(routinesDir);

const everyMinute = routineIdSchema.parse('every-minute');
const triage = routineIdSchema.parse('triage');
const paused = routineIdSchema.parse('paused');

const { tick } = await import('./tick');
const { readSchedulerState, writeSchedulerState } = await import('./storage');
const { writeRunRecord } = await import('../run/storage');
const { countQueuedWebhooks, enqueueWebhook } = await import('../webhook/queue');
const { makeRunRecord } = await import('domains/run/mocks');

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
  assert.deepEqual(result, { started: [], skipped: [] });
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
  });
  const result = tick(new Date('2026-09-30T10:02:30'));
  assert.deepEqual(result.started, []);
  assert.deepEqual(result.skipped, ['every-minute (already running)']);
  assert.equal(
    readSchedulerState()?.routines[everyMinute]?.skips.at(-1)?.reason,
    'already_running',
  );
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

test('queued webhooks start one at a time once their routine is idle', () => {
  writeRoutine('triage', 'webhook: true\nagent: command\ncommand: "true"');
  enqueueWebhook(triage, runIdSchema.parse('20261109T120000Z-aaaa'), '{"n":1}');
  enqueueWebhook(triage, runIdSchema.parse('20261109T120000Z-bbbb'), '{"n":2}');
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
  enqueueWebhook(paused, runIdSchema.parse('20261109T120000Z-cccc'), '');
  assert.deepEqual(tick(new Date('2026-10-02T10:04:00')).started, []);
  assert.equal(countQueuedWebhooks(paused), 1);
});

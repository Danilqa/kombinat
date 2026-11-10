import assert from 'node:assert/strict';
import os from 'node:os';
import { test } from 'node:test';

import { buildRoutine, describeSchedule, getNextRun, parseFrontmatter } from './utils';

const routineFile = (frontmatter: string): string =>
  `---\nname: demo\ncwd: /tmp\n${frontmatter}\n---\nHello`;

test('parses frontmatter scalars', () => {
  const { data, body } = parseFrontmatter(
    '---\nname: demo\nschedule: "30 11 * * *"\nenabled: false\ntimeoutMinutes: 20\n---\nDo the thing',
  );
  assert.deepEqual(data, {
    name: 'demo',
    schedule: '30 11 * * *',
    enabled: false,
    timeoutMinutes: 20,
  });
  assert.equal(body, 'Do the thing');
});

test('builds a routine with defaults', () => {
  const r = buildRoutine(
    '/tmp/demo.md',
    '---\nname: demo\nschedule: 0 9 * * *\ncwd: ~/Projects\n---\nHello',
  );
  assert.equal(r.agent, 'claude');
  assert.equal(r.model, 'claude-opus-5-5');
  assert.equal(r.effort, 'high');
  assert.equal(r.permissionMode, 'auto');
  assert.equal(r.enabled, true);
  assert.equal(r.timeoutMinutes, 55);
  assert.equal(r.cwd, `${os.homedir()}/Projects`);
});

test('before hook is optional', () => {
  const withHook = buildRoutine(
    '/tmp/demo.md',
    '---\nname: demo\ncwd: /tmp\nbefore: ensure-docker.sh\n---\nHello',
  );
  assert.equal(withHook.before, 'ensure-docker.sh');
  const without = buildRoutine('/tmp/demo.md', '---\nname: demo\ncwd: /tmp\n---\nHello');
  assert.equal(without.before, null);
});

test('webhooks are off unless the frontmatter turns them on', () => {
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('schedule: manual')).webhook, false);
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('webhook: true')).webhook, true);
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('webhook: false')).webhook, false);
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('webhook: "false"')),
    /webhook must be true or false/,
  );
});

test('a webhook gate needs the webhook', () => {
  const gated = buildRoutine('/tmp/demo.md', routineFile('webhook: true\nwebhookGate: check.sh'));
  assert.equal(gated.webhookGate, 'check.sh');
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('webhook: true')).webhookGate, null);
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('webhookGate: check.sh')),
    /webhookGate needs webhook: true/,
  );
});

test('manual routines have no schedule', () => {
  const r = buildRoutine(
    '/tmp/demo.md',
    '---\nname: demo\nschedule: manual\ncwd: /tmp\n---\nHello',
  );
  assert.equal(r.schedule, null);
});

test('the schedule gives the routine its label and its next run', () => {
  const now = new Date('2026-09-30T10:00:00');
  const weekdays = buildRoutine('/tmp/demo.md', routineFile('schedule: 0 8 * * 1-5'));
  assert.equal(describeSchedule(weekdays), 'Weekdays at 08:00');
  assert.equal(getNextRun(weekdays, now), new Date('2026-10-01T08:00:00').toISOString());
  const manual = buildRoutine('/tmp/demo.md', routineFile('schedule: manual'));
  assert.equal(describeSchedule(manual), 'Manual');
  assert.equal(getNextRun(manual, now), null);
  const disabled = buildRoutine(
    '/tmp/demo.md',
    routineFile('schedule: 0 8 * * 1-5\nenabled: false'),
  );
  assert.equal(getNextRun(disabled, now), null);
});

test('rejects mismatching names and bad cron', () => {
  assert.throws(
    () => buildRoutine('/tmp/demo.md', '---\nname: other\ncwd: /tmp\n---\nHello'),
    /must match/,
  );
  assert.throws(
    () =>
      buildRoutine('/tmp/demo.md', '---\nname: demo\nschedule: 99 * * * *\ncwd: /tmp\n---\nHello'),
    /Invalid cron/,
  );
  assert.throws(() => buildRoutine('/tmp/demo.md', '---\nname: demo\ncwd: /tmp\n---\n'), /empty/);
});

test('each agent gets its own defaults', () => {
  const codex = buildRoutine('/tmp/demo.md', routineFile('agent: codex'));
  assert.equal(codex.model, null);
  assert.equal(codex.effort, null);
  assert.equal(codex.permissionMode, 'workspace-write');
  const command = buildRoutine('/tmp/demo.md', routineFile('agent: command\ncommand: cat'));
  assert.equal(command.command, 'cat');
  assert.equal(command.model, null);
});

test('keeps the agent settings that the frontmatter sets', () => {
  const claude = buildRoutine(
    '/tmp/demo.md',
    routineFile('model: claude-sonnet-5-5\neffort: low\nmaxBudgetUsd: 2'),
  );
  assert.equal(claude.model, 'claude-sonnet-5-5');
  assert.equal(claude.effort, 'low');
  assert.equal(claude.maxBudgetUsd, 2);
  const codex = buildRoutine(
    '/tmp/demo.md',
    routineFile('agent: codex\nmodel: gpt-5.5\neffort: high'),
  );
  assert.equal(codex.model, 'gpt-5.5');
  assert.equal(codex.effort, 'high');
});

test('rejects settings the agent does not support', () => {
  assert.throws(() => buildRoutine('/tmp/demo.md', routineFile('agent: gemini')), /agent must be/);
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('agent: codex\neffort: max')),
    /effort must be one of minimal/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('agent: codex\nmaxBudgetUsd: 5')),
    /does not support maxBudgetUsd/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('permissionMode: yolo')),
    /permissionMode must be one of auto/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('agent: command')),
    /needs a command/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('timeoutMinutes: soon')),
    /timeoutMinutes must be a number/,
  );
});

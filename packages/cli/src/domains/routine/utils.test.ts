import assert from 'node:assert/strict';
import os from 'node:os';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';

import {
  buildRoutine,
  describeSchedule,
  getNextRun,
  listChainProblems,
  listRoutineProblems,
  parseFrontmatter,
} from './utils';

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

test('after hook is optional', () => {
  assert.equal(
    buildRoutine('/tmp/demo.md', routineFile('after: scripts/notify.sh')).after,
    'scripts/notify.sh',
  );
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('schedule: manual')).after, null);
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

test('a routine runs in its cwd unless the frontmatter asks for a worktree', () => {
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('schedule: manual')).worktree, false);
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('worktree: true')).worktree, true);
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('worktree: yes')),
    /worktree must be true or false/,
  );
});

test('a routine retries no errors unless the frontmatter sets retries', () => {
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('schedule: manual')).retries, 0);
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('retries: 2')).retries, 2);
  for (const retries of ['-1', '1.5', '11', 'twice']) {
    assert.throws(
      () => buildRoutine('/tmp/demo.md', routineFile(`retries: ${retries}`)),
      /retries must be a whole number from 0 to 10/,
    );
  }
});

test('a start makes one run unless the frontmatter sets runs, with at most that many at once', () => {
  const single = buildRoutine('/tmp/demo.md', routineFile('schedule: manual'));
  assert.deepEqual([single.runs, single.maxParallel], [1, 1]);
  const batch = buildRoutine('/tmp/demo.md', routineFile('runs: 5\nmaxParallel: 2'));
  assert.deepEqual([batch.runs, batch.maxParallel], [5, 2]);
  for (const runs of ['0', '2.5', '21', 'three']) {
    assert.throws(
      () => buildRoutine('/tmp/demo.md', routineFile(`runs: ${runs}`)),
      /runs must be a whole number from 1 to 20/,
    );
  }
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('runs: 2\nmaxParallel: 3')),
    /maxParallel must be at most runs, which is 2/,
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

test('a check needs a schedule', () => {
  const checked = buildRoutine(
    '/tmp/demo.md',
    routineFile('schedule: "*/15 * * * *"\ncheck: exit 78'),
  );
  assert.equal(checked.check, 'exit 78');
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('schedule: manual\ncheck: exit 78')),
    /check runs only at scheduled times, add a schedule or remove check/,
  );
});

test('memory is off unless the frontmatter turns it on for an agent', () => {
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('agent: codex')).memory, false);
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('memory: true')).memory, true);
  assert.equal(
    buildRoutine('/tmp/demo.md', routineFile('agent: codex\nmemory: true')).memory,
    true,
  );
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('memory: false')).memory, false);
  assert.equal(
    buildRoutine('/tmp/demo.md', routineFile('agent: command\ncommand: echo hi')).memory,
    false,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('agent: command\ncommand: echo\nmemory: true')),
    /agent command has no memory/,
  );
});

test('a routine runs on the primary login unless the frontmatter names another account', () => {
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('')).account, null);
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('account: primary')).account, null);
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('account: personal')).account, 'personal');
  assert.equal(
    buildRoutine('/tmp/demo.md', routineFile('agent: codex\naccount: me@example.com')).account,
    'me@example.com',
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('account: ../work')),
    /account must start with a letter or digit/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('account: my work')),
    /account must start with a letter or digit/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('agent: command\ncommand: echo\naccount: work')),
    /does not support account/,
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
    /demo\.md: Cron field "99" must use numbers from 0 to 59/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', 'Hello'),
    /demo\.md: must start with a frontmatter block/,
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

test('a claude routine can cap the tokens of a run, written in full or with k or M', () => {
  const tokensOf = (value: string) =>
    buildRoutine('/tmp/demo.md', routineFile(`maxBudgetTokens: ${value}`)).maxBudgetTokens;
  assert.equal(tokensOf('3000000'), 3_000_000);
  assert.equal(tokensOf('500k'), 500_000);
  assert.equal(tokensOf('2M'), 2_000_000);
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('')).maxBudgetTokens, null);
  assert.throws(() => tokensOf('lots'), /maxBudgetTokens must be a number of tokens, such as 500k/);
  assert.throws(() => tokensOf('0'), /maxBudgetTokens must be a number of tokens/);
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('agent: codex\nmaxBudgetTokens: 1M')),
    /does not support maxBudgetTokens/,
  );
});

test('a claude routine can name fallback models', () => {
  const claude = buildRoutine(
    '/tmp/demo.md',
    routineFile('fallbackModel: claude-sonnet-5-5,claude-haiku-4-5 ,'),
  );
  assert.equal(claude.model, 'claude-opus-5-5');
  assert.equal(claude.fallbackModel, 'claude-sonnet-5-5, claude-haiku-4-5');
  assert.equal(buildRoutine('/tmp/demo.md', routineFile('')).fallbackModel, null);
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('agent: codex\nfallbackModel: gpt-5.4')),
    /does not support fallbackModel/,
  );
});

test('a claude routine can fail the run when its agent gives up', () => {
  const readGiveUp = (frontmatter: string) =>
    buildRoutine('/tmp/demo.md', routineFile(frontmatter)).onAgentGiveUp;
  assert.equal(readGiveUp('onAgentGiveUp: fail'), 'fail');
  assert.equal(readGiveUp(''), 'succeed');
  assert.equal(readGiveUp('agent: codex'), null);
  assert.throws(
    () => readGiveUp('onAgentGiveUp: stop'),
    /onAgentGiveUp must be one of succeed, fail/,
  );
  assert.throws(
    () => readGiveUp('agent: codex\nonAgentGiveUp: fail'),
    /does not support onAgentGiveUp/,
  );
  assert.throws(
    () => readGiveUp('agent: command\ncommand: echo hi\nonAgentGiveUp: fail'),
    /does not support onAgentGiveUp/,
  );
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

test('a valid routine has no problems', () => {
  assert.deepEqual(listRoutineProblems('/tmp/demo.md', routineFile('schedule: 0 9 * * *')), []);
});

test('unknown settings are problems, with the setting they look like', () => {
  assert.deepEqual(
    listRoutineProblems('/tmp/demo.md', routineFile('scheduel: 0 9 * * *\ntimeoutminutes: 20')),
    [
      '/tmp/demo.md: unknown setting scheduel, did you mean schedule?',
      '/tmp/demo.md: unknown setting timeoutminutes, did you mean timeoutMinutes?',
    ],
  );
  assert.deepEqual(listRoutineProblems('/tmp/demo.md', routineFile('slackChannel: ops')), [
    '/tmp/demo.md: unknown setting slackChannel',
  ]);
});

test('a setting set twice is a problem', () => {
  assert.deepEqual(
    listRoutineProblems('/tmp/demo.md', routineFile('schedule: manual\nschedule: 0 9 * * *')),
    ['/tmp/demo.md: schedule is set more than once, the last one wins'],
  );
});

test('lists the unknown settings and the error of a routine together', () => {
  assert.deepEqual(listRoutineProblems('/tmp/demo.md', routineFile('retrys: 2\nretries: 99')), [
    '/tmp/demo.md: unknown setting retrys, did you mean retries?',
    '/tmp/demo.md: retries must be a whole number from 0 to 10',
  ]);
  assert.deepEqual(listRoutineProblems('/tmp/demo.md', 'Hello'), [
    '/tmp/demo.md: must start with a frontmatter block between --- lines',
  ]);
});

test('a frontmatter line without a key is a problem', () => {
  assert.deepEqual(listRoutineProblems('/tmp/demo.md', routineFile(': ops')), [
    '/tmp/demo.md: frontmatter line ": ops" must look like key: value',
  ]);
});

test('a routine starts after another one when it succeeds, unless startsWhen says otherwise', () => {
  const after = buildRoutine('/tmp/demo.md', routineFile('startsAfter: night-tasks'));
  assert.deepEqual([after.startsAfter, after.startsWhen], ['night-tasks', 'succeeds']);
  const onFindings = buildRoutine(
    '/tmp/demo.md',
    routineFile('startsAfter: night-tasks\nstartsWhen: has-findings'),
  );
  assert.equal(onFindings.startsWhen, 'has-findings');
  const alone = buildRoutine('/tmp/demo.md', routineFile('schedule: manual'));
  assert.deepEqual([alone.startsAfter, alone.startsWhen], [null, null]);
});

test('startsWhen needs startsAfter, and both need values a routine file can have', () => {
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('startsWhen: fails')),
    /startsWhen needs startsAfter/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('startsAfter: night\nstartsWhen: done')),
    /startsWhen must be one of finishes, succeeds, fails, has-findings/,
  );
  assert.throws(
    () => buildRoutine('/tmp/demo.md', routineFile('startsAfter: Night Tasks')),
    /startsAfter must be the name of a routine/,
  );
});

test('a chain is a problem when it names a missing routine or makes a loop', () => {
  const chained = (name: string, startsAfter: string) =>
    buildRoutine(
      `/tmp/${name}.md`,
      `---\nname: ${name}\ncwd: /tmp\nstartsAfter: ${startsAfter}\n---\nHello`,
    );
  const routines = [
    chained('review', 'notes'),
    chained('notes', 'review'),
    chained('tidy', 'gone'),
  ];
  const names = ['review', 'notes', 'tidy', 'broken'].map(name => routineNameSchema.parse(name));

  assert.deepEqual(listChainProblems(routines, names), [
    '/tmp/tidy.md: startsAfter names gone, but there is no routines/gone.md. Fix the name or add that routine',
    '/tmp/review.md, /tmp/notes.md: startsAfter makes a loop, notes → review → notes. Remove startsAfter from one of them',
  ]);
  assert.deepEqual(listChainProblems([chained('tidy', 'broken')], names), []);
});

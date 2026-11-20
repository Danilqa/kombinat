import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sessionIdSchema } from 'domains/agent/ids';
import { releaseVersionSchema } from 'domains/release/ids';
import { routineNameSchema } from 'domains/routine/ids';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { runIdSchema } from 'domains/run/ids';
import type { RunRecord } from 'domains/run/types';
import type { Settings } from 'domains/settings/types';
import { compareRunsByNewest, decodeRunsCursor, paginateRuns } from 'domains/run/utils';
import type { Transcript } from 'domains/transcript/types';
import { webhookCallIdSchema } from 'domains/webhook/ids';

import { TuiApp } from './app';
import type { DaemonClient, Overview } from './daemon-client';
import { lineWidth, plain } from './terminal/text';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const WIDTH = 140;
const HEIGHT = 40;

function makeRun(routine: string, id: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: runIdSchema.parse(id),
    routine: routineNameSchema.parse(routine),
    agent: 'claude',
    trigger: 'schedule',
    scheduledFor: null,
    startedAt: '2026-10-06T11:00:00Z',
    endedAt: '2026-10-06T11:01:23Z',
    status: 'succeeded',
    pid: 42,
    exitCode: 0,
    sessionId: sessionIdSchema.parse('session-1'),
    resumeCommand: 'claude --resume session-1',
    model: 'claude-opus-5-5',
    costUsd: null,
    numTurns: 7,
    durationMs: 83_000,
    resultText: 'All quiet',
    error: null,
    logFile: `/state/runs/${routine}/${id}.jsonl`,
    replyPid: null,
    conversation: null,
    usageLimit: null,
    tokens: null,
    ...overrides,
  };
}

function makeRoutine(name: string, overrides: Partial<RoutineSummary> = {}): RoutineSummary {
  return {
    name: routineNameSchema.parse(name),
    description: `${name} does things`,
    schedule: '10 7-22 * * *',
    scheduleHuman: 'Hourly at :10, 07:00-22:59',
    nextRunAt: '2026-10-06T12:10:00Z',
    enabled: true,
    webhook: false,
    webhookGate: null,
    queuedWebhooks: 0,
    agent: 'claude',
    model: 'claude-opus-5-5',
    effort: 'high',
    permissionMode: 'auto',
    command: null,
    cwd: '/repo',
    timeoutMinutes: 55,
    maxBudgetUsd: null,
    file: `routines/${name}.md`,
    running: false,
    lastRun: null,
    lastSkip: null,
    tokenUsage: null,
    ...overrides,
  };
}

function makeOverview(): Overview {
  const onCallRun = makeRun('on-call-monitoring', '20261006T110000Z-abcd');
  const smokeRun = makeRun('smoke-test', '20261006T100000Z-wxyz', {
    trigger: 'manual',
    status: 'failed',
    error: 'exit code 1',
  });
  return {
    status: {
      version: '1.2.3',
      pid: 4242,
      startedAt: '2026-10-06T09:00:00Z',
      lastTickAt: '2026-10-06T11:59:50Z',
      routinesDir: '/repo/routines',
      stateDir: '/state',
      claudeBin: '/bin/claude',
      codexBin: 'codex',
      maxConcurrentRuns: 3,
      running: 0,
      timezone: 'Europe/London',
      now: '2026-10-06T12:00:00Z',
    },
    routines: [
      makeRoutine('on-call-monitoring', { lastRun: onCallRun }),
      makeRoutine('smoke-test', {
        schedule: null,
        scheduleHuman: 'Manual',
        nextRunAt: null,
        lastRun: smokeRun,
      }),
    ],
    runs: [onCallRun, smokeRun],
    settings: { runRetentionDays: null },
    releaseUpdate: null,
  };
}

const transcript: Transcript = {
  eventCount: 4,
  items: [
    {
      kind: 'init',
      key: 'init-0',
      model: 'claude-opus-5-5',
      cwd: '/repo',
      toolCount: 0,
      permissionMode: 'auto',
    },
    { kind: 'text', key: '1-0', text: 'Checking the queue', isSubagent: false },
    {
      kind: 'tool',
      key: '1-1',
      id: 't1',
      name: 'Bash',
      input: { command: 'gh pr list' },
      preview: 'gh pr list',
      result: { content: 'no open PRs', isError: false },
      isSubagent: false,
    },
    {
      kind: 'result',
      key: 'result-3',
      text: 'All quiet',
      isError: false,
      costUsd: null,
      numTurns: 7,
      durationMs: 83_000,
    },
  ],
};

interface FakeOptions {
  isDown?: boolean;
  overview?: Overview;
  runsPageSize?: number;
  transcript?: Transcript;
  webhookCalls?: RoutineDetail['webhookCalls'];
}

function makeClient(overview: Overview, options: FakeOptions) {
  const started: string[] = [];
  const scheduled: string[] = [];
  const savedSettings: Settings[] = [];
  const readRuns: string[] = [];
  const client: DaemonClient = {
    getOverview() {
      return options.isDown
        ? Promise.reject(new Error('daemon not reachable at http://127.0.0.1:7433'))
        : Promise.resolve(overview);
    },
    getRoutine(name) {
      const summary = overview.routines.find(r => r.name === name);
      if (!summary) return Promise.reject(new Error(`Unknown routine ${name}`));
      const detail: RoutineDetail = {
        ...summary,
        prompt: '# Steps\n\n- look at the queue',
        skips: [],
        queue: Array.from({ length: summary.queuedWebhooks }, (_, index) => ({
          runId: runIdSchema.parse(`20261006T11${String(50 + index)}00Z-q${index}`),
          queuedAt: `2026-10-06T11:${String(50 + index)}:00Z`,
          bytes: 26,
          preview:
            ['{"alert":"api is slow"}\n', '', `{\n  "issue": "${'a long title '.repeat(40)}"\n}`][
              index
            ] ?? '',
        })),
        webhookCalls: options.webhookCalls ?? [],
        oneTimeRuns: scheduled.flatMap(entry => {
          const [routine, at] = entry.split(' ');
          return routine === name && at !== undefined ? [{ routine: name, at }] : [];
        }),
      };
      return Promise.resolve(detail);
    },
    getRuns(routine, cursor) {
      return Promise.resolve(
        paginateRuns(
          overview.runs.filter(r => r.routine === routine).toSorted(compareRunsByNewest),
          cursor === null ? null : decodeRunsCursor(cursor),
          options.runsPageSize,
        ),
      );
    },
    getRun(routine, id) {
      const run = overview.runs.find(r => r.routine === routine && r.id === id);
      if (!run) return Promise.reject(new Error('Run not found'));
      return Promise.resolve({ run, transcript: options.transcript ?? transcript });
    },
    markRunRead(routine, id) {
      readRuns.push(`${routine}/${id}`);
      return Promise.resolve();
    },
    startRun(name) {
      started.push(name);
      return Promise.resolve();
    },
    scheduleOneTimeRun(name, at) {
      scheduled.push(`${name} ${at.toISOString()}`);
      return Promise.resolve();
    },
    updateSettings(settings) {
      savedSettings.push(settings);
      return Promise.resolve();
    },
    watchChanges: () => Promise.resolve(),
  };
  return { client, started, scheduled, savedSettings, readRuns };
}

async function makeApp(options: FakeOptions = {}) {
  const overview = options.overview ?? makeOverview();
  const { client, started, scheduled, savedSettings, readRuns } = makeClient(overview, options);
  const app = new TuiApp({ client, now: () => NOW, pageLoadDelayMs: null });
  await app.refresh();
  const screen = () => app.render(WIDTH, HEIGHT).map(plain).join('\n');
  // Each argument is one chunk from stdin, the way the terminal hands keys over.
  const pressChunk = async (keys: string[]) => {
    app.render(WIDTH, HEIGHT);
    app.handleKeys(keys, WIDTH, HEIGHT);
    await app.loadVisiblePage();
    return screen();
  };
  const press = async (...keys: string[]) => {
    for (const key of keys) await pressChunk([key]);
    return screen();
  };
  return {
    app,
    overview,
    started,
    scheduled,
    savedSettings,
    readRuns,
    screen,
    press,
    pressChunk,
  };
}

test('fills the terminal exactly, with the status, routines, runs and detail panels', async () => {
  const { app } = await makeApp();
  const frame = app.render(WIDTH, HEIGHT);
  assert.equal(frame.length, HEIGHT);
  for (const line of frame) assert.equal(lineWidth(line), WIDTH);
  const text = frame.map(plain).join('\n');
  assert.match(text, /▟ Kombinat +v1\.2\.3 · © 2026/);
  assert.match(text, /daemon pid 4242/);
  assert.match(text, /1 {2}Routines/);
  assert.match(text, /2 {2}Recent runs/);
  assert.match(text, /on-call-monitoring\s+in 10m/);
  assert.match(text, /Hourly at :10, 07:00-22:59/);
});

test('the status panel grows a line with how much of the Claude plan is left', async () => {
  const overview = makeOverview();
  overview.status.claudeUsage = {
    updatedAt: '2026-10-06T11:50:00Z',
    session: { usedRatio: 0.95, resetsAt: '2026-10-06T14:00:00Z' },
    week: { usedRatio: 0.4, resetsAt: '2026-10-09T10:00:00Z' },
  };
  const { app } = await makeApp({ overview });
  const frame = app.render(WIDTH, HEIGHT);
  assert.equal(frame.length, HEIGHT);
  assert.match(frame.map(plain).join('\n'), /claude 5% left · 5-hour limit resets in 2h\s/);
});

test('moving through the routines list changes the detail panel', async () => {
  const { screen, press } = await makeApp();
  assert.match(screen(), /0 {2}on-call-monitoring/);
  assert.match(await press('j'), /0 {2}smoke-test/);
  assert.match(await press('k'), /0 {2}on-call-monitoring/);
});

test("enter opens a run from the routine's runs tab and esc goes back", async () => {
  const { press } = await makeApp();
  await press('enter');
  const runScreen = await press('enter');
  assert.match(runScreen, /0 {2}on-call-monitoring › 20261006T110000Z-abcd/);
  assert.match(runScreen, /TRANSCRIPT\s+4 events/);
  assert.match(runScreen, /▸ Bash\s+gh pr list/);
  assert.match(runScreen, /claude --resume session-1/);
  assert.match(await press('escape'), /0 {2}on-call-monitoring {2}/);
});

test('opening a finished run marks it read in the inbox once, though its page reloads', async () => {
  const { app, readRuns, press } = await makeApp();
  await press('enter', 'enter');
  await app.loadVisiblePage();
  assert.deepEqual(readRuns, ['on-call-monitoring/20261006T110000Z-abcd']);
});

test('loads older runs of a routine as the cursor nears the end of the runs tab', async () => {
  const overview = makeOverview();
  overview.runs.push(
    ...Array.from({ length: 24 }, (_, index) =>
      makeRun('on-call-monitoring', `20261005T${String(index).padStart(2, '0')}0000Z-old${index}`),
    ),
  );
  const { press } = await makeApp({ overview, runsPageSize: 10 });

  const routineScreen = await press('enter');
  assert.match(routineScreen, /Runs 25/);
  assert.match(routineScreen, /15 more…/);
  assert.doesNotMatch(routineScreen, /20261005T000000Z-old0/);

  const endScreen = await press('G', 'G', 'G');
  assert.match(endScreen, /20261005T000000Z-old0/);
  assert.doesNotMatch(endScreen, /more…/);
});

test('the prompt tab renders the routine prompt as markdown', async () => {
  const { press } = await makeApp();
  const promptScreen = await press('enter', ']');
  assert.match(promptScreen, /Steps/);
  assert.match(promptScreen, /• look at the queue/);
});

test('enter on a tool call expands it and e collapses everything again', async () => {
  const { press } = await makeApp();
  await press('2', 'enter');
  let screen = await press('G');
  for (let i = 0; i < 4 && !/Input/.test(screen); i++) screen = await press('k', 'enter');
  assert.match(screen, /▾ Bash/);
  assert.match(screen, /│ command: gh pr list/);
  assert.match(screen, /│ no open PRs/);
  assert.doesNotMatch(await press('e'), /│ command: gh pr list/);
});

test('the transcript labels the before hook and the after hook', async () => {
  const hook = { kind: 'hook', exitCode: 0, output: '' } as const;
  const { press } = await makeApp({
    transcript: {
      eventCount: 6,
      items: [
        { ...hook, key: 'hook-0', command: 'git pull --ff-only', phase: 'before' },
        ...transcript.items,
        { ...hook, key: 'hook-1', command: 'notify-slack', exitCode: 1, phase: 'after' },
      ],
    },
  });
  await press('enter');
  const lines = (await press('enter')).split('\n');
  const before = lines.findIndex(line => /before hook {2}git pull --ff-only {2}exit 0/.test(line));
  const result = lines.findIndex(line => /✓ Finished/.test(line));
  const after = lines.findIndex(line => /after hook {2}notify-slack {2}exit 1/.test(line));
  assert.ok(before !== -1 && result !== -1 && after !== -1, lines.join('\n'));
  assert.ok(before < result && result < after);
});

test('the transcript shows a message sent from the dashboard before its reply', async () => {
  const { press } = await makeApp({
    transcript: {
      eventCount: 7,
      items: [
        ...transcript.items,
        { kind: 'message', key: 'reply-0', text: 'Open a PR\nwith the fix', source: 'dashboard' },
        { kind: 'text', key: 'reply-0-0-0', text: 'Opened #12', isSubagent: false },
      ],
    },
  });
  await press('enter');
  const lines = (await press('enter')).split('\n');
  const message = lines.findIndex(line => /› Open a PR/.test(line));
  const reply = lines.findIndex(line => /Opened #12/.test(line));
  assert.ok(message !== -1 && reply !== -1, lines.join('\n'));
  assert.equal(lines[message + 1]?.indexOf('with the fix'), lines[message]?.indexOf('Open a PR'));
  assert.ok(message < reply);
});

test('a message from a webhook says so above it', async () => {
  const { press } = await makeApp({
    transcript: {
      eventCount: 7,
      items: [
        ...transcript.items,
        { kind: 'message', key: 'reply-0', text: 'Fix the flaky test too', source: 'webhook' },
      ],
    },
  });
  await press('enter');
  const lines = (await press('enter')).split('\n');
  const label = lines.findIndex(line => /From a webhook/.test(line));
  assert.ok(label !== -1, lines.join('\n'));
  assert.match(lines[label + 1] ?? '', /› Fix the flaky test too/);
  assert.equal(lines[label]?.indexOf('From'), lines[label + 1]?.indexOf('Fix'));
});

test('an open finished run shows a message sent to it from the dashboard and its reply', async () => {
  const options: FakeOptions = {};
  const { app, screen, press } = await makeApp(options);
  await press('enter');
  assert.doesNotMatch(await press('enter'), /Open a PR/);
  options.transcript = {
    eventCount: 6,
    items: [
      ...transcript.items,
      { kind: 'message', key: 'reply-0', text: 'Open a PR', source: 'dashboard' },
      { kind: 'text', key: 'reply-0-0-0', text: 'Opened #12', isSubagent: false },
    ],
  };
  await app.refresh();
  assert.match(screen(), /› Open a PR[\s\S]*Opened #12/);
});

test('r asks before starting a routine and only y starts it through the daemon', async () => {
  const { started, press } = await makeApp();
  assert.match(await press('r'), /Start on-call-monitoring now\?/);
  assert.doesNotMatch(await press('n'), /Start on-call-monitoring now\?/);
  await press('r', 'enter');
  assert.deepEqual(started, []);
  await press('j', 'r', 'y');
  assert.deepEqual(started, ['smoke-test']);
});

test('L offers times to run a routine once later and a number key schedules it', async () => {
  const { scheduled, press } = await makeApp();
  const tomorrowMorning = new Date(NOW);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);
  assert.match(await press('L'), /Run on-call-monitoring once at[\s\S]*3 {2}Tomorrow at 09:00/);
  assert.doesNotMatch(await press('x'), /once at/);
  assert.deepEqual(scheduled, []);
  await press('L', '3');
  assert.deepEqual(scheduled, [`on-call-monitoring ${tomorrowMorning.toISOString()}`]);
  const routineScreen = await press('enter');
  const time = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(tomorrowMorning);
  assert.match(routineScreen, new RegExp(`run once\\s+${time}`));
});

test('s shows how long runs are kept and a number key changes it', async () => {
  const { savedSettings, press } = await makeApp();
  assert.match(await press('s'), /Keep runs for[\s\S]*● Forever/);
  assert.doesNotMatch(await press('x'), /Keep runs for/);
  assert.deepEqual(savedSettings, []);
  await press('s', '2');
  assert.deepEqual(savedSettings, [{ runRetentionDays: 30 }]);
});

test("r on the runs panel runs that run's routine", async () => {
  const { started, press } = await makeApp();
  await press('2', 'j', 'r', 'y');
  assert.deepEqual(started, ['smoke-test']);
});

test('r and y arriving in one chunk open the popup but do not start anything', async () => {
  const { started, pressChunk, press } = await makeApp();
  assert.match(await pressChunk(['e', 'v', 'e', 'r', 'y']), /Start on-call-monitoring now\?/);
  assert.deepEqual(started, []);
  await press('y');
  assert.deepEqual(started, ['on-call-monitoring']);
});

test('every key in a chunk acts on the screen the previous key left', async () => {
  const { pressChunk, press } = await makeApp();
  await press('enter');
  assert.match(
    await pressChunk(['enter', 'enter']),
    /0 {2}on-call-monitoring › 20261006T110000Z-abcd/,
  );
  assert.match(await press('escape'), /0 {2}on-call-monitoring {2}/);
});

test('the cursor stays on the same run when a new run shows up above it', async () => {
  const { app, overview, press } = await makeApp();
  overview.runs.push(makeRun('on-call-monitoring', '20261006T100000Z-older'));
  await app.refresh();
  await press('enter', 'j');
  overview.runs.unshift(makeRun('on-call-monitoring', '20261006T115000Z-newer'));
  await app.refresh();
  app.render(WIDTH, HEIGHT);
  assert.match(await press('enter'), /0 {2}on-call-monitoring › 20261006T100000Z-older/);
});

test('does not offer to start a routine that is already running', async () => {
  const overview = makeOverview();
  const [onCall] = overview.routines;
  assert.ok(onCall);
  onCall.running = true;
  const { started, press } = await makeApp({ overview });
  const screen = await press('r');
  assert.doesNotMatch(screen, /Start on-call-monitoring now\?/);
  assert.match(screen, /on-call-monitoring is already running/);
  assert.deepEqual(started, []);
});

test('shows a clear error when the daemon is down', async () => {
  const { screen } = await makeApp({ isDown: true });
  assert.match(screen(), /daemon not reachable/);
});

test('the bottom bar says when a newer kombinat is available, until it is skipped', async () => {
  const overview = makeOverview();
  const release = {
    version: releaseVersionSchema.parse('1.3.0'),
    notes: '- A new thing',
    url: 'https://github.com/Danilqa/kombinat/releases/tag/v1.3.0',
    publishedAt: '2026-10-05T12:00:00Z',
  };
  overview.releaseUpdate = {
    installedVersion: releaseVersionSchema.parse('1.2.3'),
    releases: [release],
    skippedVersion: null,
    updateCommand: 'pnpm add --save-exact kombinat@1.3.0',
  };
  const { screen } = await makeApp({ overview });
  assert.match(screen(), /kombinat 1\.3\.0 is available · updated/);

  overview.releaseUpdate = { ...overview.releaseUpdate, skippedVersion: release.version };
  const { screen: skippedScreen } = await makeApp({ overview });
  assert.doesNotMatch(skippedScreen(), /is available/);
});

test('q quits and ? toggles help', async () => {
  const { app, press } = await makeApp();
  assert.match(await press('?'), /toggle this help/);
  assert.match(
    app.render(WIDTH, 18).map(plain).join('\n'),
    /q {2}ctrl-c\s+quit/,
    'help fits a minimum-height terminal',
  );
  assert.doesNotMatch(await press('?'), /toggle this help/);
  assert.equal(app.handleKey('q'), 'quit');
});

test('every row fits exactly in narrow and wide terminals, on every page', async () => {
  const { app, press } = await makeApp();
  const check = (label: string) => {
    const sizes: Array<[number, number]> = [
      [60, 16],
      [100, 30],
      [200, 50],
    ];
    for (const [width, height] of sizes) {
      app
        .render(width, height)
        .forEach((line, row) =>
          assert.equal(
            lineWidth(line),
            width,
            `${label} ${width}x${height} row ${row}: ${plain(line)}`,
          ),
        );
    }
  };
  check('routine runs');
  assert.match(
    app.render(100, 30).map(plain).join('\n'),
    /20261006T110000Z-abcd\s+1h ago\s+1m 23s/,
    'compact runs table is not cut off',
  );
  await press('enter', ']');
  check('routine prompt');
  await press(']');
  check('routine skips');
  await press('[', '[', 'enter', 'e');
  check('run expanded');
  await press('?');
  check('help');
});

test('the routine page and its runs show the tokens they used', async () => {
  const overview = makeOverview();
  const tokens = { input: 90_200, output: 189_300, cacheWrite: 793_400, cacheRead: 24_827_100 };
  overview.runs = overview.runs.map(run => ({ ...run, tokens }));
  overview.routines = overview.routines.map(routine => ({
    ...routine,
    tokenUsage: { runs: 7, counts: tokens, days: [], share: 0.334 },
  }));
  const { app, press } = await makeApp({ overview });
  const routineScreen = await press('enter');
  assert.match(routineScreen, /tokens {4}25\.9M in 7 days · 7 runs · 33% of all routines/);
  assert.match(routineScreen, /TURNS\s+TOKENS/);
  assert.match(routineScreen, /20261006T110000Z-abcd\s+Scheduled\s+1h ago\s+1m 23s\s+7\s+25\.9M/);
  for (const [width, height] of [
    [60, 16],
    [100, 30],
    [200, 50],
  ] as const) {
    for (const line of app.render(width, height)) assert.equal(lineWidth(line), width);
  }
  assert.match(await press('enter'), /tokens {4}25\.9M/);
});

test('the routines list and the queue tab show the webhooks that wait', async () => {
  const overview = makeOverview();
  overview.routines = overview.routines.map(routine =>
    routine.name === 'smoke-test' ? { ...routine, webhook: true, queuedWebhooks: 3 } : routine,
  );
  const { app, screen, press } = await makeApp({ overview });
  assert.match(screen(), /smoke-test {2}3 in queue/);
  await press('j', 'enter');
  assert.match(screen(), /smoke-test {2}· 3 in queue/);
  const queueTab = await press(']', ']', ']');
  assert.match(queueTab, /Queue 3/);
  assert.match(queueTab, /Next\s+10m ago\s+26 B\s+\{"alert":"api is slow"\}/);
  assert.match(queueTab, /#2\s+9m ago\s+26 B\s+empty body/);
  const longBody = queueTab.split('\n').filter(line => line.includes('a long title'));
  assert.equal(longBody.length, 3);
  assert.match(longBody[0] ?? '', /#3\s+8m ago\s+26 B\s+\{ "issue": "a long title/);
  assert.match(longBody[2] ?? '', /…\s*$/);
  for (const [width, height] of [
    [60, 16],
    [100, 30],
    [200, 50],
  ] as const) {
    for (const line of app.render(width, height)) assert.equal(lineWidth(line), width);
  }
  assert.match(await press(']', ']'), /Runs 1/);
});

test('the webhooks tab lists the calls of a routine with what each did', async () => {
  const overview = makeOverview();
  overview.routines = overview.routines.map(routine =>
    routine.name === 'smoke-test' ? { ...routine, webhook: true } : routine,
  );
  const call = {
    id: webhookCallIdSchema.parse('001791280000000'),
    receivedAt: '2026-10-06T11:55:00Z',
    outcome: 'started' as const,
    status: 200,
    runId: runIdSchema.parse('20261006T115500Z-wh01'),
    reason: null,
    bytes: 23,
    preview: '{"alert":"api is slow"}',
  };
  const { press } = await makeApp({
    overview,
    webhookCalls: [
      {
        ...call,
        id: webhookCallIdSchema.parse('001791280300000'),
        receivedAt: '2026-10-06T11:58:00Z',
        outcome: 'rejected',
        status: 401,
        runId: null,
        reason: 'exited with 1: bad signature',
        bytes: 0,
        preview: '',
      },
      call,
    ],
  });
  await press('j', 'enter');
  const tab = await press('[');
  assert.match(tab, /Webhooks 2/);
  assert.match(
    tab,
    /2m ago\s+401\s+Rejected by the gate\s+0 B\s+▌\s+exited with 1: bad signature\s+▌\s+empty body/,
  );
  assert.match(tab, /5m ago\s+200\s+Started a run\s+23 B\s+▌\s+\{"alert":"api is slow"\}/);
});

test('routines without a webhook have no queue tab', async () => {
  const { press } = await makeApp();
  await press('enter');
  assert.doesNotMatch(await press(']', ']', ']'), /Queue/);
});

test('asks for a bigger terminal when it is too small', async () => {
  const { app } = await makeApp();
  const frame = app.render(40, 10);
  assert.equal(frame.length, 10);
  assert.match(frame.map(plain).join('\n'), /too small/);
});

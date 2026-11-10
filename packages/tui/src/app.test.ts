import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import type { RunRecord } from 'domains/run/types';
import type { Transcript } from 'domains/transcript/types';

import { TuiApp } from './app';
import type { DaemonClient, Overview } from './daemon-client';
import { lineWidth, plain } from './terminal/text';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const WIDTH = 140;
const HEIGHT = 40;

function makeRun(routine: string, id: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id,
    routine,
    agent: 'claude',
    trigger: 'schedule',
    scheduledFor: null,
    startedAt: '2026-10-06T11:00:00Z',
    endedAt: '2026-10-06T11:01:23Z',
    status: 'succeeded',
    pid: 42,
    exitCode: 0,
    sessionId: 'session-1',
    resumeCommand: 'claude --resume session-1',
    model: 'claude-opus-5-5',
    costUsd: null,
    numTurns: 7,
    durationMs: 83_000,
    resultText: 'All quiet',
    error: null,
    logFile: `/state/runs/${routine}/${id}.jsonl`,
    ...overrides,
  };
}

function makeRoutine(name: string, overrides: Partial<RoutineSummary> = {}): RoutineSummary {
  return {
    name,
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
}

function makeClient(overview: Overview, options: FakeOptions) {
  const started: string[] = [];
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
        runs: overview.runs.filter(r => r.routine === name),
        skips: [],
        queue: Array.from({ length: summary.queuedWebhooks }, (_, index) => ({
          runId: `20261006T11${String(50 + index)}00Z-q${index}`,
          queuedAt: `2026-10-06T11:${String(50 + index)}:00Z`,
          bytes: 26,
          preview:
            ['{"alert":"api is slow"}\n', '', `{\n  "issue": "${'a long title '.repeat(40)}"\n}`][
              index
            ] ?? '',
        })),
      };
      return Promise.resolve(detail);
    },
    getRun(routine, id) {
      const run = overview.runs.find(r => r.routine === routine && r.id === id);
      if (!run) return Promise.reject(new Error('Run not found'));
      return Promise.resolve({ run, transcript });
    },
    startRun(name) {
      started.push(name);
      return Promise.resolve();
    },
  };
  return { client, started };
}

async function makeApp(options: FakeOptions = {}) {
  const overview = options.overview ?? makeOverview();
  const { client, started } = makeClient(overview, options);
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
  return { app, overview, started, screen, press, pressChunk };
}

test('fills the terminal exactly, with the status, routines, runs and detail panels', async () => {
  const { app } = await makeApp();
  const frame = app.render(WIDTH, HEIGHT);
  assert.equal(frame.length, HEIGHT);
  for (const line of frame) assert.equal(lineWidth(line), WIDTH);
  const text = frame.map(plain).join('\n');
  assert.match(text, /daemon pid 4242/);
  assert.match(text, /1 {2}Routines/);
  assert.match(text, /2 {2}Recent runs/);
  assert.match(text, /on-call-monitoring\s+in 10m/);
  assert.match(text, /Hourly at :10, 07:00-22:59/);
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

test('r asks before starting a routine and only y starts it through the daemon', async () => {
  const { started, press } = await makeApp();
  assert.match(await press('r'), /Start on-call-monitoring now\?/);
  assert.doesNotMatch(await press('n'), /Start on-call-monitoring now\?/);
  await press('r', 'enter');
  assert.deepEqual(started, []);
  await press('j', 'r', 'y');
  assert.deepEqual(started, ['smoke-test']);
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
  assert.match(await press(']'), /Runs 1/);
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

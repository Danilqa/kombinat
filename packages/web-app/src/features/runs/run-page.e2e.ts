import { runsPageSchema } from 'domains/run/schemas';
import { expect, test } from 'e2e/web-app';

const REPLY_TIMEOUT_MS = 25_000;

test("shows a run's result, transcript and how to resume it", async ({
  page,
  kombinat,
  claude,
}) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    sessionId: 'b5c1e2d4',
    resumeCommand: 'claude --resume b5c1e2d4',
    resultText: 'Fixed the **checkout** test.',
    events: [
      claude.init(),
      claude.text('The checkout test fails, running it alone.'),
      claude.toolUse('tool-1', 'Bash', { command: 'pnpm e2e checkout' }),
      claude.toolResult('tool-1', '1 passed'),
      claude.result(),
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "${run.id}" [level=1]
    - text: Succeeded
    - tablist:
      - tab "Information" [selected]
      - tab "Transcript & chat 5"
    - tabpanel "Information":
      - term: Resume
      - definition: claude --resume b5c1e2d4
      - text: Result
      - paragraph:
        - text: Fixed the
        - strong: checkout
        - text: test.
  `);
  await page.getByRole('tab', { name: 'Transcript & chat 5' }).click();
  await expect(page.getByText('Session started')).toBeVisible();
  await expect(page.getByText('The checkout test fails, running it alone.')).toBeVisible();
  await page.getByRole('button', { name: 'Bash pnpm e2e checkout' }).click();
  await expect(page.getByRole('region', { name: 'Tool input' })).toContainText('pnpm e2e checkout');
  await expect(page.getByRole('region', { name: 'Tool result' })).toHaveText('1 passed');
  await expect(page.getByText('Finished', { exact: true })).toBeVisible();
});

test("counts a running run's duration every second", async ({ page, kombinat, time }) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    status: 'running',
    startedAt: time.minutesAgo(1),
    endedAt: null,
    exitCode: null,
    pid: process.pid,
  });
  await page.clock.install();
  await page.goto(`/runs/fix-e2e-tests/${run.id}`);
  const duration = page.getByRole('definition').filter({ hasText: /^\d+m \d+s$/ });
  await expect(duration).toHaveText(/^1m \ds$/);

  await page.clock.runFor(30_000);

  await expect(duration).toHaveText(/^1m 3\ds$/);
});

test('shows why a run failed', async ({ page, kombinat, claude }) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    status: 'failed',
    exitCode: 1,
    error: 'Reached the budget of $2.00',
    events: [
      claude.toolUse('tool-1', 'Bash', { command: 'pnpm e2e' }),
      claude.toolResult('tool-1', 'Command timed out', true),
      claude.result(true),
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);

  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - heading "${run.id}" [level=1]
    - text: Failed
  `);
  await expect(page.getByRole('region', { name: 'Run error' })).toHaveText(
    'Reached the budget of $2.00',
  );
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();
  await page.getByRole('button', { name: 'Bash pnpm e2e Failed' }).click();
  await expect(page.getByRole('region', { name: 'Tool error' })).toHaveText('Command timed out');
  await expect(page.getByText('Finished with error')).toBeVisible();
});

test("finds text in a run's transcript, inside collapsed tool calls too", async ({
  page,
  kombinat,
  claude,
}) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    events: [
      claude.text('The checkout test fails, running it alone.'),
      claude.toolUse('tool-1', 'Bash', { command: 'pnpm e2e' }),
      claude.toolResult('tool-1', 'Checkout passed'),
      claude.result(),
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();
  const searchButton = page.getByRole('button', { name: 'Search the transcript' });
  const search = page.getByRole('search');
  const matchCount = search.getByRole('status');
  const toolResult = page.getByRole('region', { name: 'Tool result' });

  await expect(search).toBeHidden();
  await searchButton.click();
  await expect(search.getByRole('textbox', { name: 'Search the transcript' })).toBeFocused();
  await page.keyboard.type('checkout');
  await expect(matchCount).toHaveText('1 of 2');
  await expect(toolResult).toHaveText('Checkout passed');
  await page.keyboard.press('Enter');
  await expect(matchCount).toHaveText('2 of 2');
  await page.keyboard.press('Enter');
  await expect(matchCount).toHaveText('1 of 2');
  await search.getByRole('button', { name: 'Previous match' }).click();
  await expect(matchCount).toHaveText('2 of 2');

  await search.getByRole('textbox').fill('checkout failed');
  await expect(matchCount).toHaveText('No matches');
  await expect(toolResult).toBeHidden();

  await search.getByRole('textbox').press('Escape');
  await expect(search).toBeHidden();
  await expect(searchButton).toBeFocused();
  await searchButton.click();
  await expect(search.getByRole('textbox')).toHaveValue('');
});

test('scrolls a long tool result to the match', async ({ page, kombinat, claude }) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const lines = Array.from({ length: 300 }, (_, line) => `line ${line + 1}`);
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    events: [
      claude.toolUse('tool-1', 'Bash', { command: 'pnpm e2e' }),
      claude.toolResult('tool-1', [...lines, 'Checkout failed'].join('\n')),
      claude.result(),
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();
  await page.getByRole('button', { name: 'Search the transcript' }).click();
  await page.getByRole('search').getByRole('textbox').fill('checkout failed');
  const toolResult = page.getByRole('region', { name: 'Tool result' });

  await expect
    .poll(() =>
      toolResult.evaluate(box => {
        const [match] = CSS.highlights.get('search-match-current') ?? [];
        if (!(match instanceof Range)) return false;
        const boxRect = box.getBoundingClientRect();
        const matchRect = match.getBoundingClientRect();
        return matchRect.top >= boxRect.top && matchRect.bottom <= boxRect.bottom;
      }),
    )
    .toBe(true);
});

test('shows when a run switched to a fallback model', async ({ page, kombinat, claude }) => {
  kombinat.addRoutine({
    name: 'fix-e2e-tests',
    model: 'claude-opus-5-5',
    fallbackModel: 'claude-sonnet-5-5',
  });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    model: 'claude-sonnet-5-5',
    events: [
      claude.init(),
      claude.modelFallback('claude-opus-5-5', 'claude-sonnet-5-5'),
      claude.text('The checkout test fails, running it alone.'),
      claude.result(),
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();

  await expect(page.getByText('Switched model')).toBeVisible();
  await expect(page.getByText('claude-opus-5-5 → claude-sonnet-5-5')).toBeVisible();
  await expect(page.getByText('because the model is overloaded')).toBeVisible();
});

test('shows the before hook first and the after hook last', async ({ page, kombinat, claude }) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    events: [
      { type: 'before_hook', command: 'git pull', exitCode: 0, output: 'Already up to date.' },
      claude.init(),
      claude.result(),
      { type: 'after_hook', command: 'notify-slack', exitCode: 0, output: 'Posted to #routines' },
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();

  await expect(page.getByText(/^(Before hook|Finished|After hook)$/)).toHaveText([
    'Before hook',
    'Finished',
    'After hook',
  ]);
  await expect(page.getByRole('region', { name: 'Hook output' })).toHaveText([
    'Already up to date.',
    'Posted to #routines',
  ]);
});

test("continues a run's session with a message and shows the reply", async ({
  page,
  kombinat,
  claude,
}) => {
  test.slow();
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    sessionId: 'b5c1e2d4',
    resumeCommand: 'claude --resume b5c1e2d4',
    events: [claude.init(), claude.text('The checkout test is flaky.'), claude.result()],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();
  const message = page.getByRole('textbox', { name: 'Message' });
  await expect(message).toHaveAttribute('placeholder', 'Message Claude');
  await message.fill('Open a PR with the fix');
  await message.press('Enter');

  await expect(message).toHaveValue('');
  await expect(page.getByText(/Open a PR with the fix$/)).toHaveText(
    ['You wrote: Open a PR with the fix', 'You asked: Open a PR with the fix'],
    { timeout: REPLY_TIMEOUT_MS },
  );
  await expect(page.getByText('Finished', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Claude is replying')).toBeHidden();
  await expect(message).toHaveAttribute('placeholder', 'Message Claude');
});

test('a webhook of the same conversation continues the run that the first one started', async ({
  page,
  kombinat,
}) => {
  test.slow();
  kombinat.addRoutine({
    name: 'answer-issue',
    webhook: true,
    webhookGate: `printf '{"conversation":"issue-1","message":"%s"}' "$(cat)"; exit 79`,
  });
  const url = '/api/routines/answer-issue/webhook';

  const readRuns = async () => {
    const response = await page.request.get('/api/runs?routine=answer-issue');
    return runsPageSchema.parse(await response.json()).runs;
  };

  await page.request.post(url, { data: 'Find the bug' });
  await expect
    .poll(async () => (await readRuns()).map(run => run.status), { timeout: REPLY_TIMEOUT_MS })
    .toEqual(['succeeded']);
  const runId = (await readRuns())[0]?.id;
  const continued = await page.request.post(url, { data: 'Open a PR with the fix' });
  expect(await continued.json()).toEqual({ ok: true, runId });

  await page.goto(`/runs/answer-issue/${runId}`);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();
  await expect(page.getByText('From a webhook')).toBeVisible();
  await expect(page.getByText('You asked: Open a PR with the fix')).toBeVisible({
    timeout: REPLY_TIMEOUT_MS,
  });
  await expect(page.getByText('You wrote: Open a PR with the fix')).toHaveCount(0);
});

test('a run without an agent session cannot be continued', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'say-hello', agent: 'command', command: 'echo Hello' });
  const run = kombinat.addRun({
    routine: 'say-hello',
    agent: 'command',
    events: [{ type: 'output', text: 'Hello' }],
  });

  await page.goto(`/runs/say-hello/${run.id}`);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();

  await expect(page.getByText('This run has no agent session to continue.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveCount(0);
});

import { routineNameSchema } from 'domains/routine/ids';
import { runsPageSchema } from 'domains/run/schemas';
import { createRunId } from 'domains/run/utils';
import { expect, test } from 'e2e/web-app';

const REPLY_TIMEOUT_MS = 25_000;

test('a run in its own worktree shows its branch and changes, and its worktree goes while the branch stays', async ({
  page,
  kombinat,
}) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests', worktree: true });
  const id = createRunId();
  const worktree = kombinat.addWorktree({ routine: routineNameSchema.parse('fix-e2e-tests'), id });
  kombinat.addRun({ routine: 'fix-e2e-tests', id, worktree });

  await page.goto(`/runs/fix-e2e-tests/${id}`);

  const card = page.getByRole('region', { name: 'Ran in its own worktree' });
  await expect(card).toContainText(`${worktree.branch} from main`);
  await expect(card).toContainText(worktree.path);
  await expect(card.getByRole('list', { name: 'Changed files' })).toHaveText(
    'e2e/checkout.e2e.ts+2−1',
  );
  await expect(card).toContainText('1 file changed in 1 commit');
  await card.getByRole('button', { name: 'Remove worktree' }).click();
  await expect(card.getByRole('button', { name: 'Worktree removed' })).toBeDisabled();
  await expect(card).toContainText('Worktree removed. The branch stays.');
  await expect(card.getByRole('button', { name: 'Copy git switch' })).toBeVisible();
  expect(kombinat.inspectWorktree(worktree)).toEqual({ hasFolder: false, hasBranch: true });
});

test('a worktree with changes that are not committed stays and says how to remove it', async ({
  page,
  kombinat,
}) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests', worktree: true });
  const id = createRunId();
  const worktree = kombinat.addWorktree({
    routine: routineNameSchema.parse('fix-e2e-tests'),
    id,
    uncommittedFile: 'notes.md',
  });
  kombinat.addRun({ routine: 'fix-e2e-tests', id, worktree });

  await page.goto(`/runs/fix-e2e-tests/${id}`);
  const card = page.getByRole('region', { name: 'Ran in its own worktree' });
  await card.getByRole('button', { name: 'Remove worktree' }).click();

  await expect(card.getByRole('alert')).toHaveText(
    `The worktree has changes that aren't committed. Commit them, or delete them with git worktree remove --force ${worktree.path}`,
  );
  await expect(card.getByRole('button', { name: 'Remove worktree' })).toBeEnabled();
  expect(kombinat.inspectWorktree(worktree)).toEqual({ hasFolder: true, hasBranch: true });
});

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
      - term: Resume command
      - definition: claude --resume b5c1e2d4
      - text: Result
      - paragraph:
        - text: Fixed the
        - strong: checkout
        - text: test.
  `);
  await page.getByRole('tab', { name: 'Transcript & chat 5' }).click();
  await expect(page).toHaveURL(new RegExp(`/runs/fix-e2e-tests/${run.id}\\?tab=transcript$`));
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

test('a run that waits for a usage limit says when it continues and can continue now', async ({
  page,
  kombinat,
  claude,
  time,
}) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const usageLimit = {
    limit: 'session',
    stoppedAt: time.minutesAgo(5),
    continuesAt: new Date(Date.now() + 47 * 60_000).toISOString(),
  } as const;
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    status: 'waiting',
    endedAt: null,
    exitCode: null,
    pid: process.pid,
    sessionId: 'b5c1e2d4',
    resumeCommand: 'claude --resume b5c1e2d4',
    usageLimit,
    events: [
      claude.init(),
      claude.text('The checkout test fails, running it alone.'),
      claude.result(true),
      { type: 'usage_limit_wait', ...usageLimit },
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);

  const card = page.getByRole('region', { name: /Waiting for Claude.s 5-hour limit to reset/ });
  await expect(page.getByRole('main').getByText('Waiting for limit')).toBeVisible();
  await expect(card).toContainText(/continues its session at \d\d:\d\d, in 47 min\./);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();
  await expect(page.getByText('Paused at the 5-hour limit')).toBeVisible();
  await expect(page.getByText('Finished with error')).toBeHidden();

  const continued = page.waitForResponse(response => response.url().endsWith('/wait/continue'));
  await card.getByRole('button', { name: 'Continue now' }).click();
  expect((await continued).status()).toBe(202);
  await expect(card.getByRole('button', { name: 'Continuing…' })).toBeVisible();
});

test('a waiting run past its reset says it continues once another run finishes', async ({
  page,
  kombinat,
  time,
}) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    status: 'waiting',
    endedAt: null,
    exitCode: null,
    pid: process.pid,
    sessionId: 'b5c1e2d4',
    resumeCommand: 'claude --resume b5c1e2d4',
    usageLimit: {
      limit: 'session',
      stoppedAt: time.minutesAgo(300),
      continuesAt: time.minutesAgo(2),
    },
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);

  const card = page.getByRole('region', { name: 'Waiting for a free run slot' });
  await expect(card).toContainText('the 5-hour limit has reset');
  await expect(card.getByRole('button', { name: 'Continue now' })).toBeVisible();
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
  await expect(toolResult).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(matchCount).toHaveText('2 of 2');
  await expect(toolResult).toHaveText('Checkout passed');
  await page.keyboard.press('Enter');
  await expect(matchCount).toHaveText('1 of 2');
  await search.getByRole('button', { name: 'Previous match' }).click();
  await expect(matchCount).toHaveText('2 of 2');

  await search.getByRole('textbox').fill('checkout failed');
  await expect(matchCount).toHaveText('No matches');

  await search.getByRole('textbox').press('Escape');
  await expect(search).toBeHidden();
  await expect(searchButton).toBeFocused();
  await searchButton.click();
  await expect(search.getByRole('textbox')).toHaveValue('');
});

test('opens only the tool call of the current match, one at a time', async ({
  page,
  kombinat,
  claude,
}) => {
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    events: [
      claude.toolUse('tool-1', 'Bash', { command: 'pnpm e2e checkout' }),
      claude.toolResult('tool-1', 'Checkout failed'),
      claude.toolUse('tool-2', 'Bash', { command: 'pnpm e2e cart' }),
      claude.toolResult('tool-2', 'Cart failed'),
      claude.result(),
    ],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);
  await page.getByRole('tab', { name: /Transcript & chat/ }).click();
  await page.getByRole('button', { name: 'Search the transcript' }).click();
  await page.keyboard.type('failed');
  const matchCount = page.getByRole('search').getByRole('status');
  const toolResult = page.getByRole('region', { name: 'Tool result' });

  await expect(matchCount).toHaveText('1 of 2');
  await expect(toolResult).toHaveText(['Checkout failed']);
  await page.keyboard.press('Enter');
  await expect(matchCount).toHaveText('2 of 2');
  await expect(toolResult).toHaveText(['Checkout failed', 'Cart failed']);
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

test('a run blocked from actions lists them with their rules and continues with them allowed', async ({
  page,
  context,
  kombinat,
  claude,
}) => {
  test.slow();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const run = kombinat.addRun({
    routine: 'fix-e2e-tests',
    sessionId: 'b5c1e2d4',
    resumeCommand: 'claude --resume b5c1e2d4',
    resultText: 'Fixed the checkout test on a branch.',
    blockedActions: [
      { tool: 'Bash', preview: 'git push -u origin fix/checkout', rules: ['Bash(git push *)'] },
      { tool: 'Bash', preview: 'gh pr create --fill', rules: ['Bash(gh pr create *)'] },
    ],
    events: [claude.init(), claude.result()],
  });

  await page.goto(`/runs/fix-e2e-tests/${run.id}`);

  await expect(page.getByRole('main').getByText('2 blocked')).toBeVisible();
  const card = page.getByRole('region', { name: '2 actions were blocked' });
  await expect(card).toContainText(
    'Nobody was there to approve them, and Claude went on without them. The run still counts as succeeded.',
  );
  await expect(card.getByRole('listitem')).toHaveText([
    'Bashgit push -u origin fix/checkoutBash(git push *)',
    'Bashgh pr create --fillBash(gh pr create *)',
  ]);
  await expect(card).toContainText('/repo/.claude/settings.json');
  await card.getByRole('button', { name: 'Copy all rules' }).click();
  await expect(card.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '"Bash(git push *)",\n"Bash(gh pr create *)"',
  );

  await card.getByRole('button', { name: 'Allow and continue' }).click();

  await expect(card.getByRole('button', { name: 'Continuing…' })).toBeVisible();
  await expect(card).toBeHidden({ timeout: REPLY_TIMEOUT_MS });
  await expect(page).toHaveURL(/\?tab=transcript$/);
  await expect(page.getByRole('main').getByText('2 blocked')).toBeHidden();
  await expect(
    page.getByText('You asked: These are allowed now: Bash(git push *), Bash(gh pr create *).', {
      exact: false,
    }),
  ).toBeVisible({ timeout: REPLY_TIMEOUT_MS });
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

test('a run whose allowed reply fails offers to allow its blocked actions again', async ({
  page,
  kombinat,
  claude,
}) => {
  test.slow();
  // A routine that switched agents can no longer continue the run's Claude session.
  kombinat.addRoutine({ name: 'switched', agent: 'command', command: 'echo Hello' });
  const run = kombinat.addRun({
    routine: 'switched',
    sessionId: 'b5c1e2d4',
    resumeCommand: 'claude --resume b5c1e2d4',
    blockedActions: [{ tool: 'Bash', preview: 'git push', rules: ['Bash(git push *)'] }],
    events: [claude.init(), claude.result()],
  });

  await page.goto(`/runs/switched/${run.id}`);
  const card = page.getByRole('region', { name: '1 action was blocked' });
  await card.getByRole('button', { name: 'Allow and continue' }).click();

  await expect(page.getByText('This claude run has no session to continue')).toBeVisible({
    timeout: REPLY_TIMEOUT_MS,
  });
  await expect(card.getByRole('button', { name: 'Allow and continue' })).not.toHaveAttribute(
    'aria-disabled',
  );
  await expect(card.getByRole('listitem')).toHaveText(['Bashgit pushBash(git push *)']);
  await expect(page.getByRole('main').getByText('1 blocked')).toBeVisible();
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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('wraps a long tool name instead of scrolling the page sideways', async ({
    page,
    kombinat,
    claude,
  }) => {
    const toolName = 'mcp__claude_ai_Linear__create_attachment_from_upload';
    kombinat.addRoutine({ name: 'attach-demo' });
    const run = kombinat.addRun({
      routine: 'attach-demo',
      events: [
        claude.init(),
        claude.toolUse('tool-1', toolName, { issue: 'KOM-1' }),
        claude.toolResult('tool-1', 'Attached'),
        claude.result(),
      ],
    });

    await page.goto(`/runs/attach-demo/${run.id}`);
    await page.getByRole('tab', { name: /Transcript & chat/ }).click();

    await expect(page.getByRole('button', { name: new RegExp(`^${toolName}`) })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('centers the send button in the message box', async ({ page, kombinat, claude }) => {
    kombinat.addRoutine({ name: 'fix-e2e-tests' });
    const run = kombinat.addRun({
      routine: 'fix-e2e-tests',
      sessionId: 'b5c1e2d4',
      resumeCommand: 'claude --resume b5c1e2d4',
      events: [claude.init(), claude.text('The checkout test is flaky.'), claude.result()],
    });

    await page.goto(`/runs/fix-e2e-tests/${run.id}`);
    await page.getByRole('tab', { name: /Transcript & chat/ }).click();

    const messageBox = await page.getByRole('textbox', { name: 'Message' }).boundingBox();
    const sendBox = await page.getByRole('button', { name: 'Send' }).boundingBox();
    const getMiddle = (box: typeof messageBox) => (box?.y ?? 0) + (box?.height ?? 0) / 2;
    expect(getMiddle(sendBox)).toBeCloseTo(getMiddle(messageBox), 0);
  });
});

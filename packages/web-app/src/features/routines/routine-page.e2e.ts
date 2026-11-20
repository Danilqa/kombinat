import { startedRunWithIdSchema } from 'domains/routine/schemas';
import { expect, test } from 'e2e/web-app';

test("shows a routine's settings, runs, skipped runs and prompt", async ({ page, kombinat }) => {
  kombinat.addRoutine({
    name: 'triage-sentry',
    description: 'Triages new Sentry issues',
    schedule: '0 8 * * 1-5',
    effort: 'medium',
    timeoutMinutes: 30,
    maxBudgetUsd: 2,
    webhook: true,
    prompt: '## Steps\n\nFix the issue that affects the most users.',
  });
  const run = kombinat.addRun({ routine: 'triage-sentry', status: 'failed' });
  kombinat.addSkip('triage-sentry', 'concurrency_limit');
  await page.goto('/');

  await page
    .getByRole('row', { name: /triage-sentry/ })
    .getByText('Triages new Sentry issues')
    .click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('triage-sentry');
  await expect(page.getByText('Effort medium')).toBeVisible();
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - term: Timeout
    - definition: 30 min
    - term: Budget
    - definition: $2.00
    - term: File
    - definition: routines/triage-sentry.md
    - term: Webhook
    - definition: POST /api/routines/triage-sentry/webhook
  `);
  await expect(page.getByRole('row', { name: new RegExp(`Failed ${run.id}`) })).toBeVisible();
  await expect(page.getByRole('row', { name: /concurrency limit/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Prompt' }).click();
  await expect(page.getByRole('heading', { name: 'Steps' })).toBeVisible();
});

test('shows the tokens each routine used in the last 7 days', async ({ page, kombinat, time }) => {
  const tokens = (scale: number) => ({
    input: 1000 * scale,
    output: 9000 * scale,
    cacheWrite: 90_000 * scale,
    cacheRead: 900_000 * scale,
  });
  kombinat.addRoutine({ name: 'night-agent-tasks' });
  kombinat.addRoutine({ name: 'release-notes' });
  kombinat.addRoutine({ name: 'disk-cleanup', agent: 'command', command: 'echo done' });
  kombinat.addRun({
    routine: 'night-agent-tasks',
    startedAt: time.minutesAgo(60),
    tokens: tokens(2),
  });
  kombinat.addRun({
    routine: 'night-agent-tasks',
    startedAt: time.minutesAgo(90),
    tokens: tokens(1),
  });
  kombinat.addRun({
    routine: 'night-agent-tasks',
    startedAt: time.minutesAgo(8 * 24 * 60),
    tokens: tokens(5),
  });
  kombinat.addRun({ routine: 'release-notes', startedAt: time.minutesAgo(30), tokens: tokens(1) });
  kombinat.addRun({ routine: 'disk-cleanup', startedAt: time.minutesAgo(30) });
  await page.goto('/');

  await expect(page.getByText('All routines used 4M tokens in the last 7 days')).toBeVisible();
  await expect(page.getByRole('row', { name: /release-notes/ })).toContainText(
    '1M tokens in 7 days',
  );
  await expect(page.getByRole('row', { name: /disk-cleanup/ })).not.toContainText('tokens');
  await page.getByRole('link', { name: 'night-agent-tasks' }).click();

  const usage = page.locator('section', { hasText: 'Tokens, last 7 days' });
  await expect(usage).toContainText('Used3M2 runs');
  await expect(usage).toContainText('Per run1.5Mon average');
  await expect(usage).toContainText('Share75%of all routines');
  await expect(usage).toContainText('Input3KOutput27KCache write270KCache read2.7M');
  await expect(page.getByRole('row', { name: /2M$/ })).toHaveCount(1);
});

test('keeps the open tab in the URL', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'triage-sentry', prompt: '## Steps\n\nFix the top issue.' });
  await page.goto('/routines/triage-sentry');

  await page.getByRole('tab', { name: 'Prompt' }).click();
  await expect(page).toHaveURL(/\/routines\/triage-sentry\?tab=prompt$/);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Prompt' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Steps' })).toBeVisible();

  await page.getByRole('tab', { name: /^Runs/ }).click();
  await expect(page).toHaveURL(/\/routines\/triage-sentry$/);
  await page.goto('/routines/triage-sentry?tab=webhooks');
  await expect(page.getByRole('tab', { name: /^Runs/ })).toHaveAttribute('aria-selected', 'true');
});

// The browser runs in UTC, so the time input takes UTC times.
function toTimeInputValue(date: Date): string {
  return date.toISOString().slice(0, 16);
}

test('blocks Run now while the routine runs but still schedules a run once later', async ({
  page,
  kombinat,
}) => {
  kombinat.addRoutine({ name: 'write-release-notes' });
  kombinat.addRun({
    routine: 'write-release-notes',
    status: 'running',
    endedAt: null,
    exitCode: null,
    pid: process.pid,
  });
  await page.goto('/routines/write-release-notes');

  await expect(page.getByRole('button', { name: 'Running write-release-notes' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - term: Next run
    - definition: "-"
  `);
  await page.getByRole('button', { name: 'More ways to run write-release-notes' }).click();
  await page.getByRole('menuitem', { name: /^Tonight at 02:00/ }).click();

  await expect(page.getByRole('heading', { name: 'Scheduled once' })).toBeVisible();
  await expect(page.getByText('1 run, kept on this machine, not in git')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Cancel the run at .+, 02:00$/ })).toBeVisible();
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - term: Next run
    - definition:
      - time: /^in /
  `);
});

test('schedules a run at a picked time and cancels runs scheduled once', async ({
  page,
  kombinat,
}) => {
  kombinat.addRoutine({ name: 'write-release-notes' });
  await page.goto('/routines/write-release-notes');
  const openMenu = () =>
    page.getByRole('button', { name: 'More ways to run write-release-notes' }).click();

  await openMenu();
  await page.getByRole('menuitem', { name: 'Pick a time…' }).click();
  const time = page.getByLabel('Run write-release-notes once at');
  await expect(time).toBeFocused();
  await time.fill(toTimeInputValue(new Date(Date.now() - 60 * 60_000)));
  await page.getByRole('button', { name: 'Schedule run' }).click();
  await expect(page.getByRole('alert')).toHaveText('Choose a time in the future');

  const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60_000);
  inTwoDays.setUTCHours(10, 30, 0, 0);
  await time.fill(toTimeInputValue(inTwoDays));
  await page.getByRole('button', { name: 'Schedule run' }).click();
  await expect(time).toBeHidden();
  await openMenu();
  await page.getByRole('menuitem', { name: /^In 1 hour/ }).click();

  const cancelButtons = page.getByRole('button', { name: /^Cancel the run at / });
  await expect(cancelButtons).toHaveCount(2);
  await expect(page.getByText('2 runs, kept on this machine, not in git')).toBeVisible();
  await expect(cancelButtons.last()).toHaveAccessibleName(/, 10:30$/);
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - term: Next run
    - definition:
      - time: /^in 1 hr\\./
  `);

  await cancelButtons.first().focus();
  await page.keyboard.press('Enter');
  await expect(cancelButtons).toHaveCount(1);
  await expect(cancelButtons.first()).toBeFocused();
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - term: Next run
    - definition:
      - time: /^(in [23] days|tomorrow) /
  `);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Scheduled once' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Run now write-release-notes' })).toBeFocused();
});

test('logs the webhook calls of a routine with what each of them did', async ({
  page,
  kombinat,
}) => {
  kombinat.addRoutine({
    name: 'triage-issue',
    agent: 'command',
    command: 'cat',
    webhook: true,
    webhookGate:
      'printenv KOMBINAT_WEBHOOK_HEADERS | grep -q s3cret || { echo bad signature >&2; exit 1; }; grep -q create || exit 78',
  });
  const url = '/api/routines/triage-issue/webhook';
  const headers = { 'x-secret': 's3cret' };
  await page.request.post(url, { data: { action: 'create' } });
  await page.request.post(url, { headers, data: { action: 'update' } });
  const created = await page.request.post(url, { headers, data: { action: 'create' } });
  const { runId } = startedRunWithIdSchema.parse(await created.json());
  await page.goto('/routines/triage-issue');

  await page.getByRole('tab', { name: 'Webhooks 3' }).click();
  const calls = page.getByRole('list', { name: 'Webhook calls' }).getByRole('listitem');
  await expect(calls).toHaveText([
    /^200Started a run.* · 19 B\{"action":"create"\}$/,
    /^200Ignored by the gate.* · 19 B\{"action":"update"\}$/,
    /^401Rejected by the gate.* · 19 Bexited with 1: bad signature\{"action":"create"\}$/,
  ]);
  await calls.first().getByRole('link', { name: 'Started a run' }).click();
  await expect(page).toHaveURL(new RegExp(`/runs/triage-issue/${runId}$`));
  // The daemon is shared, and a run that starts after the next test's reset would stay starting there.
  await expect(page.getByRole('button', { name: /daemon status/ })).toHaveText(/0 of 3 running/, {
    timeout: 25_000,
  });
});

test('loads older runs page by page as you scroll a long history', async ({
  page,
  kombinat,
  time,
}) => {
  kombinat.addRoutine({ name: 'inbox-triage', schedule: '*/5 * * * *' });
  const newest = kombinat.addRun({ routine: 'inbox-triage', startedAt: time.minutesAgo(5) });
  for (let index = 2; index < 120; index++) {
    kombinat.addRun({ routine: 'inbox-triage', startedAt: time.minutesAgo(index * 5) });
  }
  const oldest = kombinat.addRun({ routine: 'inbox-triage', startedAt: time.minutesAgo(600) });
  await page.goto('/routines/inbox-triage');

  const table = page.getByRole('table');
  await expect(table.getByRole('row', { name: new RegExp(newest.id) })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Runs 120' })).toBeVisible();
  await expect(table).toHaveAttribute('aria-rowcount', '121');
  const oldestRow = table.getByRole('row', { name: new RegExp(oldest.id) });
  await expect(async () => {
    await page.keyboard.press('End');
    await expect(oldestRow).toBeVisible({ timeout: 1000 });
  }).toPass();
  expect(await table.getByRole('row').count()).toBeLessThan(60);
});

test('explains that a routine does not exist', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'inbox-triage' });
  kombinat.addRun({ routine: 'inbox-triage' });
  await page.goto('/routines/nightly-digest');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('nightly-digest');
  await expect(page.getByRole('alert')).toHaveText('Unknown routine nightly-digest');
  const runs = await page.request.get('/api/runs?routine=nightly-digest%2F..%2Finbox-triage');
  expect(runs.status()).toBe(404);
});

test('keeps the breadcrumbs, the section and its table header stacked as the page scrolls', async ({
  page,
  kombinat,
}) => {
  kombinat.addRoutine({ name: 'inbox-triage', schedule: '*/5 * * * *' });
  for (let index = 0; index < 30; index++) kombinat.addSkip('inbox-triage', 'concurrency_limit');
  await page.goto('/routines/inbox-triage');
  const section = page.getByRole('heading', { name: 'Skipped runs' });
  await expect(section).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumbs).toBeInViewport();
  await expect(section).toBeInViewport();
  const breadcrumbsBox = await breadcrumbs.boundingBox();
  const sectionBox = await section.boundingBox();
  expect(sectionBox?.y).toBeGreaterThan((breadcrumbsBox?.y ?? 0) + (breadcrumbsBox?.height ?? 0));
  const sectionBottom = (sectionBox?.y ?? 0) + (sectionBox?.height ?? 0);
  const headerTops = await page
    .locator('th', { hasText: /^Skipped at$/ })
    .evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().top));
  expect(headerTops.filter(top => top > sectionBottom && top < sectionBottom + 32)).toHaveLength(1);
});

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

test('blocks both halves of the run button while the routine runs', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.addRun({
    routine: 'triage-sentry',
    status: 'running',
    endedAt: null,
    exitCode: null,
    pid: process.pid,
  });
  await page.goto('/routines/triage-sentry');

  await expect(page.getByRole('button', { name: 'Running triage-sentry' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  const menu = page.getByRole('button', { name: 'More ways to run triage-sentry' });
  await expect(menu).toHaveAttribute('aria-disabled', 'true');
  await menu.click({ force: true });
  await menu.press('Enter');
  await expect(page.getByRole('menu')).toBeHidden();
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

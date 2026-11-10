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

test('explains that a routine does not exist', async ({ page }) => {
  await page.goto('/routines/nightly-digest');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('nightly-digest');
  await expect(page.getByRole('alert')).toHaveText('Unknown routine nightly-digest');
});

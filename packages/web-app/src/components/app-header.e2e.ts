import { expect, test } from 'e2e/web-app';

test('warns when the scheduler stops ticking', async ({ page, kombinat }) => {
  kombinat.stallScheduler();
  await page.goto('/');

  const status = page.getByRole('button', { name: /daemon status/ });
  await expect(status).toHaveText(/Scheduler stalled/);
  await status.click();
  await expect(page.getByRole('dialog')).toContainText('Scheduler has not ticked recently');
});

test('shows when the daemon is offline', async ({ page }) => {
  await page.route('**/api/status', route => route.abort());
  await page.goto('/');

  const status = page.getByRole('button', { name: /daemon status/ });
  await expect(status).toHaveText(/Offline/);
  await status.click();
  await expect(page.getByRole('dialog')).toContainText('Daemon is unreachable');
});

test('shows the free disk space and the cpu load of the machine', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /daemon status/ }).click();
  const details = page.getByRole('dialog');
  await expect(details).toContainText(/Disk[\d.,]+ [kMGT]B free of [\d.,]+ [kMGT]B/);
  await expect(details).toContainText(/CPU load(\d+%|-)/);
});

test('shows how much of the Claude plan is left once a run reports it', async ({
  page,
  kombinat,
}) => {
  test.slow();
  kombinat.addRoutine({ name: 'triage-issues' });
  await page.goto('/');
  const status = page.getByRole('button', { name: /daemon status/ });
  await expect(status).toHaveText(/0 of 3 running, daemon status/);
  const plan = page.getByRole('button', { name: /plan usage/ });
  await expect(plan).toBeHidden();

  await page.getByRole('button', { name: 'Run now triage-issues' }).click();

  await expect(plan).toHaveText(/^Claude 80% left, plan usage$/, { timeout: 25_000 });
  await expect(status).toHaveText(/^\d of 3 running, daemon status$/);
  await plan.click();
  const details = page.getByRole('dialog');
  await expect(details).toContainText('Claude plan');
  await expect(details).toContainText(/5-hour limit88% left · resets in 2 hr\./);
  await expect(details).toContainText(/Weekly limit80% left · resets in 3 days/);
});

test('shows the Claude plan in the daemon status on phones', async ({ page, kombinat }) => {
  test.slow();
  await page.setViewportSize({ width: 390, height: 844 });
  kombinat.addRoutine({ name: 'triage-issues' });
  await page.goto('/');

  await page.getByRole('button', { name: 'Run now triage-issues' }).click();
  await page.getByRole('button', { name: /daemon status/ }).click();

  await expect(page.getByRole('dialog')).toContainText(/Weekly limit80% left/, { timeout: 25_000 });
  await expect(page.getByRole('button', { name: /plan usage/ })).toBeHidden();
});

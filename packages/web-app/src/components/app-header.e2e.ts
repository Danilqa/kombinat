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

test('shows the plan left of each account by name, and its limits in the popover', async ({
  page,
  kombinat,
  time,
}) => {
  kombinat.addRoutine({ name: 'triage-issues' });
  kombinat.addRoutine({ name: 'water-plants', account: 'personal' });
  kombinat.addRoutine({ name: 'plan-trips', account: 'personal' });
  const usage = (usedRatio: number) => ({
    updatedAt: time.minutesAgo(5),
    session: { usedRatio, resetsAt: time.minutesAgo(-120) },
    week: null,
  });
  kombinat.addPlanUsage(null, usage(0.93));
  kombinat.addPlanUsage('personal', usage(0.22));
  await page.goto('/');

  const plan = page.getByRole('button', { name: /plan usage/ });
  await expect(plan).toHaveText(/^primary 7% · personal 78% left, plan usage$/);
  await plan.click();
  const details = page.getByRole('dialog');
  await expect(details).toContainText('primary · 1 routine');
  await expect(details).toContainText('personal · 2 routines');
  await expect(details).toContainText(/5-hour limit78% left/);
  await expect(details).toContainText('kombinat login <name>');
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

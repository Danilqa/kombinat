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

import { expect, test } from 'e2e/web-app';

const DAY_MINUTES = 24 * 60;

const tokens = (millions: number) => ({
  input: 1000 * millions,
  output: 9000 * millions,
  cacheWrite: 90_000 * millions,
  cacheRead: 900_000 * millions,
});

test('compares the last 7 days with the days before and ranks the routines by tokens', async ({
  page,
  kombinat,
  time,
}) => {
  kombinat.addRoutine({ name: 'night-agent-tasks' });
  kombinat.addRoutine({ name: 'release-notes' });
  kombinat.addRoutine({ name: 'disk-cleanup', agent: 'command', command: 'echo done' });
  kombinat.addRun({
    routine: 'night-agent-tasks',
    startedAt: time.minutesAgo(5),
    tokens: tokens(2),
  });
  kombinat.addRun({
    routine: 'night-agent-tasks',
    status: 'failed',
    startedAt: time.minutesAgo(4),
    tokens: tokens(1),
  });
  kombinat.addRun({ routine: 'release-notes', startedAt: time.minutesAgo(3), tokens: tokens(1) });
  kombinat.addRun({ routine: 'disk-cleanup', startedAt: time.minutesAgo(2) });
  kombinat.addRun({
    routine: 'night-agent-tasks',
    startedAt: time.minutesAgo(8 * DAY_MINUTES),
    tokens: tokens(2),
  });
  await page.goto('/');

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Insights' })
    .click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights');
  const stats = page.getByRole('main').locator('dl').first();
  await expect(stats).toContainText('Tokens4M+100% vs prior 7 days');
  await expect(stats).toContainText('Runs4+300% vs prior 7 days');
  await expect(stats).toContainText('Failed125% of finished runs');
  await expect(stats).toContainText('Average run time5m 0sSame as prior 7 days');
  await expect(page.getByRole('img', { name: /: 4 runs, 1 failed$/ })).toBeVisible();
  const today = page.getByRole('img', { name: /: 4M tokens$/ });
  await today.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('img', { name: /: 0 tokens$/ }).nth(5)).toBeFocused();
  await expect(page.getByRole('tooltip', { name: /: 0 tokens$/ })).toBeVisible();
  await page.keyboard.press('End');
  await expect(today).toBeFocused();
  const table = page.getByRole('table');
  await expect(table.getByRole('link')).toHaveText([
    'night-agent-tasks',
    'release-notes',
    'disk-cleanup',
  ]);
  await expect(table.getByRole('row', { name: /night-agent-tasks/ })).toContainText(
    'night-agent-tasks3M75%21',
  );
  await expect(table.getByRole('row', { name: /disk-cleanup/ })).toContainText('disk-cleanup--10');

  await table.getByRole('link', { name: 'release-notes' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('release-notes');
});

test('keeps the period in the URL', async ({ page, kombinat, time }) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(20 * DAY_MINUTES) });
  await page.goto('/insights');
  await expect(
    page.getByText('No runs in the last 7 days. Run a routine with Run now to see it here.'),
  ).toBeVisible();

  await page.getByRole('tab', { name: '30 days' }).click();

  await expect(page).toHaveURL(/\/insights\?days=30$/);
  await expect(page.getByRole('row', { name: /triage-sentry/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: '30 days' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('main').locator('dl').first()).toContainText(
    'Runs1None in prior 30 days',
  );
  expect((await page.request.get('/api/insights?days=14')).status()).toBe(400);
});

test('leaves out the change when the runs before the period are deleted', async ({
  page,
  kombinat,
  time,
}) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(30), tokens: tokens(1) });
  await page.request.put('/api/settings', { data: { runRetentionDays: 30 } });
  await page.goto('/insights');
  const stats = page.getByRole('main').locator('dl').first();
  await expect(stats).toContainText('Runs1None in prior 7 days');

  await page.getByRole('tab', { name: '30 days' }).click();

  await expect(stats).toContainText('Tokens1MRuns kept for 1 month');
  await expect(stats).toContainText('Runs1Runs kept for 1 month');
  await expect(stats).toContainText('Average run time5m 0sRuns kept for 1 month');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('opens Insights from the icon in the nav', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Insights' })
      .tap();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights');
    await expect(
      page.getByText('No runs in the last 7 days. Run a routine with Run now to see it here.'),
    ).toBeVisible();
  });
});

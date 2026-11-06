import { expect, test } from './fixtures';
import { formatDay, todayAt } from './support/time';

const DAY_MS = 86_400_000;

test("shows this week's runs and opens one", async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'morning-digest' });
  const run = kombinat.addRun({
    routine: 'morning-digest',
    startedAt: todayAt(6),
    endedAt: todayAt(6, 20),
  });

  await page.goto('/calendar');

  await page.getByRole('link', { name: /^morning-digest, .*, 06:00–06:20, succeeded$/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(run.id);
});

test('plans the next runs and highlights overlaps', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'daily-check', schedule: '0 9 * * *' });
  kombinat.addRoutine({ name: 'weekly-report', schedule: '0 9 * * 1' });
  await page.goto('/calendar');

  await page.getByRole('button', { name: 'Next week' }).click();

  const dailyChecks = page.getByRole('link', { name: /^daily-check, .*, 09:00–09:20, planned/ });
  await expect(dailyChecks).toHaveCount(7);
  await page.getByRole('button', { name: 'Calendar options' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Highlight overlaps 1 this week' }).click();
  await expect(
    page.getByRole('link', { name: /^weekly-report, .*Overlaps with daily-check$/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Calendar options' }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: /Highlight overlaps/ })).toBeChecked();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('shows one day at a time', async ({ page, kombinat }) => {
    const today = new Date(todayAt(6));
    // Another day of this week: Tuesday when today is Monday, yesterday otherwise.
    const otherDay = new Date(today.getTime() + (today.getUTCDay() === 1 ? DAY_MS : -DAY_MS));
    kombinat.addRoutine({ name: 'morning-digest' });
    kombinat.addRoutine({ name: 'weekly-cleanup' });
    kombinat.addRun({ routine: 'morning-digest', startedAt: today.toISOString() });
    kombinat.addRun({ routine: 'weekly-cleanup', startedAt: otherDay.toISOString() });
    await page.goto('/calendar');

    const todayRun = page.getByRole('link', { name: /^morning-digest/ });
    const otherDayRun = page.getByRole('link', { name: /^weekly-cleanup/ });
    await expect(todayRun).toBeVisible();
    await expect(otherDayRun).toBeHidden();
    await page.getByRole('button', { name: formatDay(otherDay), exact: true }).tap();
    await expect(otherDayRun).toBeVisible();
    await expect(todayRun).toBeHidden();
  });
});

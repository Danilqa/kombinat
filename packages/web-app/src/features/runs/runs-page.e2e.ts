import { expect, test } from 'e2e/web-app';

test('lists the latest runs of all routines and opens one', async ({ page, kombinat, time }) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const older = kombinat.addRun({
    routine: 'triage-sentry',
    status: 'failed',
    startedAt: time.minutesAgo(120),
  });
  const newer = kombinat.addRun({
    routine: 'fix-e2e-tests',
    trigger: 'manual',
    startedAt: time.minutesAgo(30),
  });
  await page.goto('/');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Runs' }).click();

  await expect(page.getByText('2 runs')).toBeVisible();
  await expect(page.getByRole('table')).toMatchAriaSnapshot(`
    - rowgroup:
      - row /^fix-e2e-tests Succeeded ${newer.id} Manual/
      - row /^triage-sentry Failed ${older.id} Scheduled/
  `);
  await page
    .getByRole('row', { name: /^triage-sentry/ })
    .getByText('Failed')
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(older.id);
  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'triage-sentry' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('triage-sentry');
});

test('shows the date and time a run started next to how long ago it was', async ({
  page,
  kombinat,
}) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.addRun({ routine: 'triage-sentry', startedAt: '2026-03-04T06:05:09.000Z' });
  await page.goto('/runs');

  await expect(page.getByRole('row', { name: /^triage-sentry/ })).toContainText('4 Mar, 06:05');
});

test('keeps runs for the chosen time, and always the last run of each routine', async ({
  page,
  kombinat,
  time,
}) => {
  const tenDays = 10 * 24 * 60;
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.addRoutine({ name: 'weekly-report' });
  const recent = kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(60) });
  kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(tenDays) });
  const lastReport = kombinat.addRun({
    routine: 'weekly-report',
    startedAt: time.minutesAgo(tenDays + 60),
  });
  await page.goto('/runs');
  await expect(page.getByText('3 runs')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Forever' })).toBeChecked();
  await page.getByRole('menuitemradio', { name: '1 week' }).click();

  await expect(page.getByText('2 runs')).toBeVisible();
  await expect(page.getByRole('table')).toMatchAriaSnapshot(`
    - rowgroup:
      - row /^triage-sentry Succeeded ${recent.id}/
      - row /^weekly-report Succeeded ${lastReport.id}/
  `);
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('menuitemradio', { name: '1 week' })).toBeChecked();
});

test('keeps the page header and the table header on top as the list scrolls', async ({
  page,
  kombinat,
  time,
}) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  for (let index = 1; index <= 40; index++) {
    kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(index * 10) });
  }
  await page.goto('/runs');
  const title = page.getByRole('heading', { level: 1, name: 'Runs' });
  await expect(page.getByText('40 runs')).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  await expect(title).toBeInViewport();
  const titleBox = await title.boundingBox();
  const titleBottom = (titleBox?.y ?? 0) + (titleBox?.height ?? 0);
  const headerTops = await page
    .locator('th', { hasText: /^Routine$/ })
    .evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().top));
  expect(headerTops.filter(top => top > titleBottom && top < titleBottom + 32)).toHaveLength(1);
});

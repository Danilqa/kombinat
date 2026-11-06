import { expect, test } from './fixtures';
import { minutesAgo } from './fixtures/time';

test('lists the latest runs of all routines and opens one', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  const older = kombinat.addRun({
    routine: 'triage-sentry',
    status: 'failed',
    startedAt: minutesAgo(120),
  });
  const newer = kombinat.addRun({
    routine: 'fix-e2e-tests',
    trigger: 'manual',
    startedAt: minutesAgo(30),
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

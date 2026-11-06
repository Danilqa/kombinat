import { expect, test } from './fixtures';
import { minutesAgo } from './fixtures/time';

// Idle pages poll every 15 seconds.
const NEW_RUN_TIMEOUT_MS = 25_000;

test('lists each routine with its schedule, agent and last run', async ({ page, kombinat }) => {
  kombinat.addRoutine({
    name: 'triage-sentry',
    description: 'Triages new Sentry issues',
    schedule: '0 8 * * 1-5',
    model: 'claude-sonnet-5-5',
  });
  kombinat.addRun({ routine: 'triage-sentry', status: 'failed', startedAt: minutesAgo(90) });
  kombinat.addRoutine({
    name: 'say-hello',
    agent: 'command',
    command: 'echo Hello',
    enabled: false,
  });

  await page.goto('/');

  await expect(page.getByText('2 routines')).toBeVisible();
  const triage = page.getByRole('row', { name: /triage-sentry/ });
  await expect(triage).toContainText('Triages new Sentry issues');
  await expect(triage).toContainText('Weekdays at 08:00');
  await expect(triage).toContainText('claude-sonnet-5-5');
  await expect(triage.getByRole('link', { name: /Failed/ })).toBeVisible();
  const sayHello = page.getByRole('row', { name: /say-hello/ });
  await expect(sayHello).toContainText('Disabled');
  await expect(sayHello).toContainText('Manual');
  await expect(sayHello).toContainText('Never run');
  await expect(page.getByRole('button', { name: /daemon status/ })).toHaveText(/0 of 3 running/);
});

test('runs a routine on demand and shows its output', async ({ page, kombinat }) => {
  test.slow();
  kombinat.addRoutine({ name: 'say-hello', agent: 'command', command: 'echo Hello from Kombinat' });
  await page.goto('/');

  await page.getByRole('button', { name: 'Run now say-hello' }).click();

  const lastRun = page
    .getByRole('row', { name: /say-hello/ })
    .getByRole('link', { name: /Succeeded/ });
  await expect(lastRun).toBeVisible({ timeout: NEW_RUN_TIMEOUT_MS });
  await lastRun.click();
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - term: Trigger
    - definition: Manual
    - text: Result
    - paragraph: Hello from Kombinat
    - heading "Transcript" [level=2]
    - paragraph: Hello from Kombinat
  `);
});

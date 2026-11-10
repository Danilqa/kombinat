import { expect, test } from 'e2e/web-app';

// Idle pages poll every 15 seconds.
const NEW_RUN_TIMEOUT_MS = 25_000;

test('lists each routine with its schedule, agent and last run', async ({
  page,
  kombinat,
  time,
}) => {
  kombinat.addRoutine({
    name: 'triage-sentry',
    description: 'Triages new Sentry issues',
    schedule: '0 8 * * 1-5',
    model: 'claude-sonnet-5-5',
  });
  kombinat.addRun({ routine: 'triage-sentry', status: 'failed', startedAt: time.minutesAgo(90) });
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

test('runs a routine from a webhook with its request body', async ({ page, kombinat }) => {
  test.slow();
  kombinat.addRoutine({
    name: 'echo-payload',
    agent: 'command',
    command: 'grep pullRequest',
    webhook: true,
  });

  const response = await page.request.post('/api/routines/echo-payload/webhook', {
    data: { pullRequest: 42 },
  });
  expect(response.status()).toBe(200);
  await page.goto('/');

  const lastRun = page
    .getByRole('row', { name: /echo-payload/ })
    .getByRole('link', { name: /Succeeded/ });
  await expect(lastRun).toBeVisible({ timeout: NEW_RUN_TIMEOUT_MS });
  await lastRun.click();
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - term: Trigger
    - definition: Webhook
    - text: Result
    - paragraph: '{"pullRequest":42}'
  `);
});

test('runs a routine only for the webhooks its gate lets through', async ({ page, kombinat }) => {
  test.slow();
  kombinat.addRoutine({
    name: 'triage-issue',
    agent: 'command',
    command: 'cat',
    webhook: true,
    webhookGate:
      'printenv KOMBINAT_WEBHOOK_HEADERS | grep -q s3cret || exit 1; grep -q create || exit 78',
  });
  const url = '/api/routines/triage-issue/webhook';
  const headers = { 'x-secret': 's3cret' };

  const unsigned = await page.request.post(url, { data: { action: 'create' } });
  expect(unsigned.status()).toBe(401);
  const updated = await page.request.post(url, { headers, data: { action: 'update' } });
  expect(await updated.json()).toEqual({ ok: true, runId: null });
  const created = await page.request.post(url, { headers, data: { action: 'create' } });
  expect(await created.json()).toEqual({ ok: true, runId: expect.any(String) });
  await page.goto('/routines/triage-issue');

  await expect(page.getByRole('tab', { name: 'Runs 1' })).toBeVisible({
    timeout: NEW_RUN_TIMEOUT_MS,
  });
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - term: Webhook gate
    - definition: printenv KOMBINAT_WEBHOOK_HEADERS | grep -q s3cret || exit 1; grep -q create || exit 78
  `);
});

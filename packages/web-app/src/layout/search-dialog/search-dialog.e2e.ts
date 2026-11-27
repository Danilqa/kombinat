import { expect, test } from 'e2e/web-app';

const NEW_RUN_TIMEOUT_MS = 25_000;

test('finds a run by what it said and opens it', async ({ page, kombinat, time }) => {
  kombinat.addRoutine({ name: 'daily-digest' });
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  kombinat.addRun({
    routine: 'daily-digest',
    startedAt: time.minutesAgo(90),
    resultText: 'Nothing new today',
  });
  const found = kombinat.addRun({
    routine: 'fix-e2e-tests',
    startedAt: time.minutesAgo(30),
    resultText: 'Opened PR #42 for the flaky checkout test',
  });
  await page.goto('/');

  await page.keyboard.press('ControlOrMeta+K');
  const search = page.getByRole('dialog', { name: 'Search' });
  await search.getByRole('combobox').fill('flaky checkout');

  await expect(search.getByRole('option')).toHaveText([
    /^fix-e2e-tests.*Opened PR #42 for the flaky checkout test.*Succeeded$/,
  ]);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(found.id);
  await expect(search).toBeHidden();
});

test('opens from the header and finds routines and pages', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'triage-sentry', description: 'Sorts new Sentry issues' });
  kombinat.addRoutine({ name: 'daily-digest' });
  await page.goto('/runs');

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Search' });
  const input = search.getByRole('combobox');
  await input.fill('sentry');
  await expect(search.getByRole('option')).toHaveText([
    /^triage-sentry\s*Sorts new Sentry issues/,
    'Run triage-sentry now',
  ]);
  await input.fill('calendar');
  await expect(search.getByRole('option')).toHaveText(['Calendar']);
  await input.fill('nothing like this');
  await expect(search).toContainText('No results for “nothing like this”');
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();

  await page.keyboard.press('ControlOrMeta+K');
  await expect(input).toHaveValue('');
  await input.fill('sentry');
  await search.getByRole('option', { name: /^triage-sentry/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('triage-sentry');
});

test('runs a routine from the search', async ({ page, kombinat }) => {
  test.slow();
  kombinat.addRoutine({ name: 'say-hello', agent: 'command', command: 'echo Hello from Kombinat' });
  await page.goto('/');

  await page.keyboard.press('ControlOrMeta+K');
  await page.getByRole('combobox').fill('run say-hello');
  await page.getByRole('option', { name: 'Run say-hello now' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('say-hello');
  await expect(page.getByRole('row', { name: /Succeeded.*Manual/ })).toBeVisible({
    timeout: NEW_RUN_TIMEOUT_MS,
  });
});

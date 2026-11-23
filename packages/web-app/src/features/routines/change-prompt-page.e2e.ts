import { expect, test } from 'e2e/web-app';

// Shorter than the 15 s idle poll, so the run page has to wait for the run that just started.
const RUN_START_TIMEOUT_MS = 10_000;

test('runs a routine once with a changed prompt and opens that run', async ({ page, kombinat }) => {
  test.slow();
  kombinat.addRoutine({
    name: 'echo-prompt',
    agent: 'command',
    command: 'cat',
    prompt: 'Triage the newest issue.',
  });
  await page.goto('/routines/echo-prompt');

  await page.getByRole('button', { name: 'More ways to run echo-prompt' }).click();
  await page.getByRole('menuitem', { name: 'Change prompt and run' }).click();
  const prompt = page.getByRole('textbox', { name: 'Prompt' });
  await expect(prompt).toHaveValue('Triage the newest issue.');
  await prompt.fill('Triage only the issue from Ada.');
  await expect(page.getByText('Changed for this run')).toBeVisible();
  await prompt.press('ControlOrMeta+Enter');

  await expect(page).toHaveURL(/\/runs\/echo-prompt\/[^/]+$/);
  await expect(page.getByRole('main')).toMatchAriaSnapshot(
    `
    - term: Trigger
    - definition: Manual
    - text: Result
    - paragraph: Triage only the issue from Ada.
  `,
    { timeout: RUN_START_TIMEOUT_MS },
  );
  await page.getByRole('link', { name: 'echo-prompt' }).click();
  await page.getByRole('tab', { name: 'Prompt' }).click();
  await expect(page.getByText('Triage the newest issue.')).toBeVisible();
});

test('closes the prompt editor back to the page it was opened from', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'echo-prompt' });
  await page.goto('/');

  await page.getByRole('button', { name: 'More ways to run echo-prompt' }).click();
  await page.getByRole('menuitem', { name: 'Change prompt and run' }).click();
  await expect(page).toHaveURL(/\/routines\/echo-prompt\/run$/);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/routines/echo-prompt/run');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/routines\/echo-prompt$/);
});

test('refuses to start a run with a blank prompt', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'echo-prompt' });

  const response = await page.request.post('/api/routines/echo-prompt/run', {
    data: { prompt: '  ' },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({
    error:
      "The body must be JSON, with a prompt that isn't blank and runs and maxParallel from 1 to 20",
  });
});

import { expect, test } from 'e2e/web-app';

// Shorter than the 15 s idle poll, so the run page has to wait for the run that just started.
const RUN_START_TIMEOUT_MS = 10_000;

test('runs a new prompt once with the routine it picks and opens that run', async ({
  page,
  kombinat,
}) => {
  test.slow();
  kombinat.addRoutine({ name: 'weekly-report', description: 'Sums up the week' });
  kombinat.addRoutine({
    name: 'echo-prompt',
    description: 'Prints its prompt',
    agent: 'command',
    command: 'cat',
    prompt: 'Triage the newest issue.',
  });
  await page.goto('/runs');

  await page.getByRole('link', { name: 'New run' }).click();
  await expect(page).toHaveURL(/\/runs\/new$/);
  const prompt = page.getByRole('textbox', { name: 'Prompt' });
  await expect(prompt).toBeFocused();
  await prompt.fill('Summarize the open pull requests.');
  await prompt.press('ControlOrMeta+Enter');
  await expect(page).toHaveURL(/\/runs\/new$/);

  const search = page.getByRole('combobox', { name: 'Search routines' });
  await expect(search).toBeFocused();
  await search.fill('prints');
  await expect(page.getByRole('option')).toHaveText([/^echo-prompt/]);
  await search.press('Enter');
  await expect(page.getByRole('button', { name: 'Routine echo-prompt' })).toBeVisible();
  await expect(prompt).toBeFocused();
  await prompt.press('ControlOrMeta+Enter');

  await expect(page).toHaveURL(/\/runs\/echo-prompt\/[^/]+$/);
  await expect(page.getByRole('main')).toMatchAriaSnapshot(
    `
    - term: Trigger
    - definition: Manual
    - text: Result
    - paragraph: Summarize the open pull requests.
  `,
    { timeout: RUN_START_TIMEOUT_MS },
  );
});

test('closes the new run back to Runs', async ({ page, kombinat }) => {
  kombinat.addRoutine({ name: 'echo-prompt' });
  await page.goto('/runs');

  await page.getByRole('link', { name: 'New run' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/runs$/);

  await page.goto('/runs/new');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/runs$/);
});

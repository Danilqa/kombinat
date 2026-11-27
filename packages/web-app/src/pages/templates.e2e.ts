import { expect, test } from 'e2e/web-app';

test('adds a routine from a template and opens it with a reminder to commit it', async ({
  page,
  daemon,
}) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'New routine' }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Code',
    'Product',
    'Watch',
    'Reports',
    'Home',
  ]);
  await page.getByRole('link', { name: /^Say if you need an umbrella/ }).click();
  await expect(page).toHaveURL(/\/templates\/umbrella-check$/);

  await expect(page.getByLabel('Name')).toHaveValue('umbrella-check');
  await page.getByLabel('Working directory').fill(daemon.root);
  const schedule = page.getByLabel('Schedule');
  await expect(schedule).toHaveAccessibleDescription('Weekdays at 08:00');
  await schedule.fill('*/30 * * * *');
  await expect(schedule).toHaveAccessibleDescription('Every 30 minutes');
  await schedule.fill('*/15 9-17 1 * 1-5');
  await expect(schedule).toHaveAccessibleDescription(
    'Every 15 minutes, 09:00-17:59, on the 1st of the month or on weekdays',
  );
  await schedule.fill('*/30 * * * *');

  await expect(page.getByLabel('Agent')).toHaveValue('claude');
  await expect(page.getByLabel('Agent')).toHaveAccessibleDescription('Installed on this machine');
  const model = page.getByLabel('Model');
  await expect(model).toHaveValue('claude-haiku-5-5');
  await expect(model).toHaveAccessibleDescription('The model of the template');
  await model.selectOption('claude-opus-5-5');
  await expect(model).toHaveAccessibleDescription('The template uses claude-haiku-5-5');

  const prompt = page.getByLabel('Prompt');
  await expect(prompt).toHaveValue(/^Check today's weather forecast for where I am\./);
  await expect(page.getByText('Change it to fit your project')).toBeVisible();
  await prompt.fill('Say hello.');
  await expect(page.getByText('Changed from the template')).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(prompt).toHaveValue(/^Check today's weather forecast for where I am\./);
  await prompt.fill('Tell me if I need a coat in London today.');
  await page.getByRole('button', { name: 'Add routine' }).click();

  await expect(page).toHaveURL(/\/routines\/umbrella-check$/);
  await expect(page.getByRole('status').filter({ hasText: 'Added' })).toHaveText(
    /Added from a template\. Commit it to keep it in git:\s*git add routines\/umbrella-check\.md/,
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('umbrella-check');
  await expect(page.getByText('Every 30 minutes', { exact: true })).toBeVisible();
  await expect(page.getByText(daemon.root, { exact: true })).toBeVisible();
  await expect(page.getByText('claude-opus-5-5', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Prompt' }).click();
  await expect(page.getByText('Tell me if I need a coat in London today.')).toBeVisible();
});

test('never replaces a routine and explains what to fix', async ({ page, kombinat, daemon }) => {
  kombinat.addRoutine({ name: 'umbrella-check' });
  await page.goto('/templates/umbrella-check');

  const name = page.getByLabel('Name');
  await expect(name).toHaveValue('umbrella-check-2');
  await name.fill('umbrella-check');
  await expect(name).toHaveAccessibleDescription(
    'A routine with this name exists. Choose another name',
  );
  await name.fill('Umbrella');
  await expect(name).toHaveAccessibleDescription(
    'Use lowercase letters, numbers and dashes, such as my-routine',
  );
  await name.fill('rain');

  const schedule = page.getByLabel('Schedule');
  await schedule.fill('every morning');
  await expect(schedule).toHaveAccessibleDescription(
    'Enter a cron schedule, such as 0 9 * * 1-5, or manual',
  );
  await schedule.fill('manual');
  await expect(schedule).toHaveAccessibleDescription('Manual');

  const missing = `${daemon.root}/missing`;
  await page.getByLabel('Working directory').fill(missing);
  await page.getByRole('button', { name: 'Add routine' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    `There is no folder at ${missing}. Check the path, or create the folder first.`,
  );
  await expect(page).toHaveURL(/\/templates\/umbrella-check$/);

  await page.getByLabel('Prompt').fill('  ');
  await page.getByRole('button', { name: 'Add routine' }).click();
  await expect(page.getByText('Enter a prompt for the agent')).toBeVisible();
});

test('offers the agents and models of this machine, and bug investigation starts on Opus', async ({
  page,
  daemon,
}) => {
  await page.route('**/api/agents', route =>
    route.fulfill({
      json: [
        { name: 'claude', isInstalled: false, models: ['claude-opus-5-5', 'claude-sonnet-5-5'] },
        { name: 'codex', isInstalled: true, models: ['gpt-5.5', 'gpt-5.4'] },
      ],
    }),
  );
  await page.goto('/templates/investigate-bug-reports');

  const agent = page.getByLabel('Agent');
  const model = page.getByLabel('Model');
  await expect(model).toHaveValue('claude-opus-5-5');
  await expect(agent).toHaveAccessibleDescription("Claude isn't installed on this machine");
  await expect(agent.getByRole('option')).toHaveText(['Claude (not installed)', 'Codex']);

  await agent.selectOption('Codex');
  await expect(agent).toHaveAccessibleDescription('Installed on this machine');
  await expect(agent.getByRole('option', { name: 'Claude (not installed)' })).toBeDisabled();
  await expect(model).toHaveValue('');
  await expect(model).toHaveAccessibleDescription('The model Codex is set up to use');
  await expect(model.getByRole('option')).toHaveText(['Default', 'gpt-5.5', 'gpt-5.4']);
  await expect(page.getByText('high', { exact: true })).toBeHidden();
  await model.selectOption('gpt-5.4');
  await expect(model).toHaveAccessibleDescription('The template uses claude-opus-5-5');

  await page.getByLabel('Working directory').fill(daemon.root);
  await page.getByRole('button', { name: 'Add routine' }).click();
  await expect(page).toHaveURL(/\/routines\/investigate-bug-reports$/);
  await expect(page.getByText('Codex', { exact: true })).toBeVisible();
  await expect(page.getByText('gpt-5.4', { exact: true })).toBeVisible();
});

test('adds a template that runs a plain command instead of an agent', async ({ page, daemon }) => {
  await page.goto('/templates/mute-sound-at-night');

  await expect(page.getByText(/^case \$\{KOMBINAT_TRIGGER:-\}/)).toBeVisible();
  await expect(page.getByLabel('Agent')).toBeHidden();
  await expect(page.getByLabel('Model')).toBeHidden();
  await expect(page.getByText('The command gets this text as its input')).toBeVisible();
  await page.getByLabel('Working directory').fill(daemon.root);
  await page.getByRole('button', { name: 'Add routine' }).click();

  await expect(page).toHaveURL(/\/routines\/mute-sound-at-night$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('mute-sound-at-night');
  await expect(page.getByText('Daily at 21:30', { exact: true })).toBeVisible();
});

test('shows that a template does not exist', async ({ page }) => {
  await page.goto('/templates/no-such-template');

  await expect(page.getByRole('alert')).toHaveText('There is no template named no-such-template');
  await page.getByRole('link', { name: 'Templates' }).click();
  await expect(page).toHaveURL(/\/templates$/);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('keeps the Add routine button at the bottom of the screen', async ({ page, daemon }) => {
    await page.goto('/templates/weekly-shipped-recap');

    const add = page.getByRole('button', { name: 'Add routine' });
    await expect(add).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel('Prompt')).not.toBeInViewport();
    await page.getByLabel('Prompt').scrollIntoViewIfNeeded();
    await expect(add).toBeInViewport({ ratio: 1 });

    await page.getByLabel('Working directory').fill(daemon.root);
    await add.click();
    await expect(page).toHaveURL(/\/routines\/weekly-shipped-recap$/);
  });
});

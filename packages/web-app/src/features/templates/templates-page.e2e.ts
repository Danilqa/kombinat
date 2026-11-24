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
    'Watch',
    'Reports',
    'Home',
  ]);
  await page.getByRole('link', { name: /^Say if you need an umbrella/ }).click();
  await expect(page).toHaveURL(/\/templates\/umbrella-check$/);

  await expect(page.getByLabel('Name')).toHaveValue('umbrella-check');
  await page.getByLabel('Folder').fill(daemon.root);
  const schedule = page.getByLabel('Schedule');
  await expect(schedule).toHaveAccessibleDescription('Weekdays at 08:00');
  await schedule.fill('*/30 * * * *');
  await expect(schedule).toHaveAccessibleDescription('Every 30 minutes');
  await page.getByRole('button', { name: 'Add routine' }).click();

  await expect(page).toHaveURL(/\/routines\/umbrella-check$/);
  await expect(page.getByRole('status').filter({ hasText: 'Added' })).toHaveText(
    /Added from a template\. Commit it to keep it in git:\s*git add routines\/umbrella-check\.md/,
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('umbrella-check');
  await expect(page.getByText('Every 30 minutes', { exact: true })).toBeVisible();
  await expect(page.getByText(daemon.root, { exact: true })).toBeVisible();
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
  await page.getByLabel('Folder').fill(missing);
  await page.getByRole('button', { name: 'Add routine' }).click();
  await expect(page.getByRole('alert')).toHaveText(`There is no folder at ${missing}`);
  await expect(page).toHaveURL(/\/templates\/umbrella-check$/);
});

test('shows that a template does not exist', async ({ page }) => {
  await page.goto('/templates/no-such-template');

  await expect(page.getByRole('alert')).toHaveText('There is no template named no-such-template');
  await page.getByRole('link', { name: 'Templates' }).click();
  await expect(page).toHaveURL(/\/templates$/);
});

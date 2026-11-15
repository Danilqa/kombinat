import { expect, test } from 'e2e/web-app';

test('the footer shows the version of the daemon, the copyright and a link to GitHub', async ({
  page,
}) => {
  await page.goto('/');

  const footer = page.getByRole('contentinfo');
  await expect(footer).toHaveText(/^v\d+\.\d+\.\d+ · © \d{4} Kombinat · GitHub$/);
  await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/Danilqa/kombinat',
  );
});

test('the footer stays at the bottom of the window when the page is short', async ({
  kombinat,
  page,
}) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  await page.goto('/');

  await expect(page.getByRole('row', { name: /triage-sentry/ })).toBeVisible();
  const footer = await page.getByRole('contentinfo').boundingBox();
  expect(footer && footer.y + footer.height).toBe(page.viewportSize()?.height);
});

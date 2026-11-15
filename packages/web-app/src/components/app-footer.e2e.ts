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

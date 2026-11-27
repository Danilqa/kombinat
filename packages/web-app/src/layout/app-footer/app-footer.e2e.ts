import { expect, test } from 'e2e/web-app';

test('the footer shows the version of the daemon, the copyright and links to the changelog and GitHub', async ({
  page,
}) => {
  await page.goto('/');

  const footer = page.getByRole('contentinfo');
  await expect(footer).toHaveText(/^v\d+\.\d+\.\d+ · © \d{4} Kombinat · Changelog · GitHub$/);
  await expect(footer.getByRole('link', { name: 'Changelog' })).toHaveAttribute(
    'href',
    'https://kombinat.tech/changelog',
  );
  await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/Danilqa/kombinat',
  );
});

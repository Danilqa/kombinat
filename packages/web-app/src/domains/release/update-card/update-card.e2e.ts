import { releaseUpdateSchema } from 'domains/release/schemas';
import { expect, test } from 'e2e/web-app';

const UPDATE_COMMAND = 'pnpm add --save-exact kombinat@0.6.0';

const RELEASES = [
  {
    version: '0.6.0',
    notes: '- The dashboard shows when a new version is out (#85)',
    url: 'https://github.com/Danilqa/kombinat/releases/tag/v0.6.0',
    publishedAt: '2026-11-18T10:00:00Z',
  },
  {
    version: '0.5.2',
    notes: '- Fixed: the footer stays at the bottom (#70)',
    url: 'https://github.com/Danilqa/kombinat/releases/tag/v0.5.2',
    publishedAt: '2026-11-17T10:00:00Z',
  },
];

// A checkout looks for no releases, so the daemon's answer gets two newer ones and keeps its skip.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/releases', async route => {
    const response = await route.fetch();
    const update = releaseUpdateSchema.parse(await response.json());
    await route.fulfill({
      response,
      json: {
        ...update,
        installedVersion: '0.5.1',
        releases: RELEASES,
        updateCommand: UPDATE_COMMAND,
      },
    });
  });
});

test('a newer version shows in a card with the changelog of every release since the installed one', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');

  const card = page.getByRole('complementary', { name: 'Kombinat 0.6.0 is available' });
  await expect(card).toContainText('You have 0.5.1');
  const changelog = card.getByRole('region', { name: 'Changelog' });
  await expect(changelog).toContainText('The dashboard shows when a new version is out (#85)');
  await expect(changelog).toContainText('Fixed: the footer stays at the bottom (#70)');
  await expect(card.getByRole('link', { name: 'Release notes on GitHub' })).toHaveAttribute(
    'href',
    RELEASES[0]?.url ?? '',
  );

  await card.getByRole('button', { name: 'Copy the command' }).click();
  await expect(card.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(UPDATE_COMMAND);
});

test('closing the card skips its version for good', async ({ page }) => {
  await page.goto('/');

  const card = page.getByRole('complementary', { name: 'Kombinat 0.6.0 is available' });
  await card.getByRole('button', { name: 'Skip version 0.6.0' }).click();
  await expect(card).toBeHidden();

  await expect
    .poll(async () => {
      const response = await page.request.get('/api/releases');
      return releaseUpdateSchema.parse(await response.json()).skippedVersion;
    })
    .toBe('0.6.0');
  const releases = page.waitForResponse('**/api/releases');
  await page.reload();
  await (await releases).finished();
  await expect(card).toBeHidden();
});

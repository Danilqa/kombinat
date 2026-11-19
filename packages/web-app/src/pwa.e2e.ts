import { expect, test } from 'e2e/web-app';

test('the dashboard installs as an app with a window and an icon of its own', async ({
  page,
  baseURL,
}) => {
  await page.goto('/runs');
  const cdp = await page.context().newCDPSession(page);

  const { errors, manifest } = await cdp.send('Page.getAppManifest');
  expect(errors).toEqual([]);
  expect(manifest).toMatchObject({
    name: 'Kombinat',
    display: 'kStandalone',
    startUrl: `${String(baseURL)}/`,
  });
  const iconSizes = await Promise.all(
    (manifest.icons ?? []).map(async icon => {
      const response = await page.request.get(icon.url);
      expect(response.headers()['content-type']).toBe('image/png');
      return icon.sizes;
    }),
  );
  expect(iconSizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
});

test('the icon of the installed app shows the number of unread runs', async ({
  page,
  kombinat,
  time,
}) => {
  const badges: number[] = [];
  await page.exposeFunction('reportAppBadge', (count: number) => {
    badges.push(count);
  });
  await page.addInitScript({
    content:
      'navigator.setAppBadge = count => reportAppBadge(count); navigator.clearAppBadge = () => reportAppBadge(0);',
  });
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.lookAtInbox(time.minutesAgo(120));
  kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(60) });
  kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(30) });

  await page.goto('/inbox');
  await expect.poll(() => badges.at(-1)).toBe(2);

  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect.poll(() => badges.at(-1)).toBe(0);
});

test.describe('with the service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('a page that cannot reach the daemon says so and opens once it answers', async ({
    page,
    context,
  }) => {
    await page.goto('/runs');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Daemon is unreachable' })).toBeVisible();
    await expect(page).toHaveURL(/\/runs$/);

    await context.setOffline(false);
    await expect(page.getByRole('heading', { name: 'Runs', level: 1 })).toBeVisible();
  });
});

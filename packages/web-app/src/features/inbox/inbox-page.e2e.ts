import { expect, test } from 'e2e/web-app';

test('groups the runs that ended since the last look and clears them as they are read', async ({
  page,
  kombinat,
  time,
}) => {
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.addRoutine({ name: 'fix-e2e-tests' });
  kombinat.addRoutine({ name: 'watch-incidents' });
  kombinat.lookAtInbox(time.minutesAgo(120));
  kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(300) });
  kombinat.addRun({
    routine: 'triage-sentry',
    status: 'timed_out',
    error: 'Killed after 55 minutes',
    startedAt: time.minutesAgo(60),
  });
  const fixed = kombinat.addRun({
    routine: 'fix-e2e-tests',
    resultText: 'Fixed the login spec and opened a pull request.',
    startedAt: time.minutesAgo(40),
  });
  kombinat.addRun({
    routine: 'watch-incidents',
    resultText: 'No open incidents.',
    startedAt: time.minutesAgo(20),
  });
  await page.goto('/');
  const inbox = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Inbox/ });
  await expect(inbox).toHaveAccessibleName('Inbox 3 unread');

  await inbox.click();

  await expect(page.getByRole('main').getByText('3 unread')).toBeVisible();
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - region "Needs a look":
      - heading "Needs a look"
      - list:
        - listitem:
          - link /^triage-sentry Timed out .+ ago .* Killed after 55 minutes$/
    - region "Has findings":
      - heading "Has findings"
      - list:
        - listitem:
          - link /^fix-e2e-tests .+ ago .* Fixed the login spec and opened a pull request\\.$/
    - region "Nothing to report":
      - heading "Nothing to report"
      - list:
        - listitem:
          - link /^watch-incidents .+ ago .* No open incidents\\.$/
  `);
  await page.getByRole('link', { name: /^fix-e2e-tests/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixed.id);
  await expect(inbox).toHaveAccessibleName('Inbox 2 unread');

  await inbox.click();
  await expect(page.getByRole('region', { name: 'Has findings' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mark all as read' }).click();

  await expect(
    page.getByText('You are all caught up. New runs show up here when they finish.'),
  ).toBeVisible();
  await expect(inbox).toHaveAccessibleName('Inbox');
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('fits the highlight of the Inbox tab to it once its count clears', async ({
    page,
    kombinat,
    time,
  }) => {
    kombinat.addRoutine({ name: 'triage-sentry' });
    kombinat.lookAtInbox(time.minutesAgo(120));
    kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(60) });
    await page.goto('/inbox');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const inbox = nav.getByRole('link', { name: /Inbox/ });
    const highlight = nav.locator(':scope > span');
    await expect(inbox).toHaveAccessibleName('Inbox 1 unread');

    await page.getByRole('button', { name: 'Mark all as read' }).click();

    await expect(inbox).toHaveAccessibleName('Inbox');
    await expect
      .poll(async () => (await highlight.boundingBox())?.width)
      .toBe((await inbox.boundingBox())?.width);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('opens the Inbox from beside the search and clears its count', async ({
    page,
    kombinat,
    time,
  }) => {
    kombinat.addRoutine({ name: 'triage-sentry' });
    kombinat.lookAtInbox(time.minutesAgo(120));
    kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(60) });
    kombinat.addRun({ routine: 'triage-sentry', startedAt: time.minutesAgo(30) });
    await page.goto('/');
    const inbox = page.getByRole('banner').getByRole('link', { name: /Inbox/ });
    await expect(inbox).toHaveAccessibleName('Inbox 2 unread');

    await inbox.tap();
    await page.getByRole('button', { name: 'Mark all as read' }).tap();

    await expect(inbox).toHaveAccessibleName('Inbox');
    await expect(inbox).toHaveAttribute('aria-current', 'page');
  });
});

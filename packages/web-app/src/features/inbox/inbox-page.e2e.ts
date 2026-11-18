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

  await expect(page.getByText('3 unread')).toBeVisible();
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

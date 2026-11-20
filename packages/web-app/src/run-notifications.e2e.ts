import { expect, test } from 'e2e/web-app';

// The headless shell denies notifications, and Chromium's new headless mode shows them.
test.use({ channel: 'chromium', serviceWorkers: 'allow' });

test('the service worker shows the notification of a run, as Android allows no other way', async ({
  page,
  context,
  baseURL,
  kombinat,
  time,
}) => {
  await context.grantPermissions(['notifications'], { origin: String(baseURL) });
  kombinat.addRoutine({ name: 'triage-sentry' });
  kombinat.lookAtInbox(time.minutesAgo(120));
  await page.request.put('/api/inbox/notify/triage-sentry', { data: { level: 'failures' } });
  await page.goto('/runs');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const inbox = page.waitForResponse(response => response.url().endsWith('/api/inbox'));
  await page.reload();
  await inbox;

  const run = kombinat.addRun({
    routine: 'triage-sentry',
    status: 'timed_out',
    error: 'Killed after 55 minutes',
    startedAt: time.minutesAgo(60),
  });

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        const notifications = await registration.getNotifications();
        return notifications.map(({ title, body, data }) => [title, body, JSON.stringify(data)]);
      }),
    )
    .toEqual([
      [
        'triage-sentry needs a look',
        'Timed out: Killed after 55 minutes',
        JSON.stringify({ url: `${String(baseURL)}/runs/triage-sentry/${run.id}` }),
      ],
    ]);
});

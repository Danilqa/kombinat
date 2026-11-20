import { createPointer, showCaption, typeSlowly, type TourSteps } from './capture-tour';

export const playReadmeTour: TourSteps = async (page, markCaption) => {
  const pointer = createPointer(page);
  async function caption(text: string | null) {
    if (text !== null) markCaption(text);
    await showCaption(page, text);
  }
  const pause = (ms: number) => page.waitForTimeout(ms);
  const nav = page.getByRole('navigation', { name: 'Main' });

  await pointer.place({ x: 760, y: 140 });
  await caption('Every routine, its schedule and last run');
  const onCallRow = page.locator('tbody tr').filter({ hasText: 'on-call-engineer' });
  await pointer.moveTo(onCallRow.getByRole('link', { name: 'on-call-engineer', exact: true }), {
    ms: 900,
  });
  await pause(1600);

  await caption('The week at a glance');
  await pointer.click(nav.getByRole('link', { name: 'Calendar' }), { ms: 700 });
  await page.getByRole('heading', { name: 'Calendar', level: 1 }).waitFor();
  await pause(2200);

  await caption('Every run, scheduled or from a webhook');
  await pointer.click(nav.getByRole('link', { name: 'Runs' }), { ms: 600 });
  await page.getByRole('heading', { name: 'Runs', level: 1 }).waitFor();
  await pause(2200);

  await caption('Unread runs, with failures and findings first');
  await pointer.click(nav.getByRole('link', { name: /^Inbox/ }), { ms: 600 });
  await page.getByRole('heading', { name: 'Inbox', level: 1 }).waitFor();
  await pause(2400);

  await caption('What runs now, with the disk and CPU of the machine');
  await pointer.click(page.getByRole('button', { name: /daemon status/ }), { ms: 700 });
  await pause(2400);
  await page.keyboard.press('Escape');
  await pause(300);

  await caption('Search routines and runs with ⌘K');
  await pointer.click(page.getByRole('button', { name: 'Search', exact: true }), { ms: 600 });
  await page.getByRole('dialog').waitFor();
  await pause(300);
  await typeSlowly(page, 'on-call');
  await pause(700);
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'on-call-engineer', level: 1 }).waitFor();
  await pause(1000);

  await caption('Full transcript of every run');
  await pointer.glide({ x: 640, y: 520 }, 400);
  await pointer.scroll(330);
  await pause(300);
  const webhookRun = page
    .locator('tbody tr')
    .filter({ hasText: 'Webhook' })
    .filter({ hasText: 'Succeeded' })
    .first();
  await pointer.click(webhookRun.locator('a').first(), { ms: 600 });
  const transcriptTab = page.getByRole('tab', { name: /Transcript & chat/ });
  await transcriptTab.waitFor();
  await pointer.click(transcriptTab, { ms: 500 });
  await pause(100);
  await pointer.scroll(520, 800);
  await pause(300);
  await pointer.click(page.locator('main button[aria-expanded]').nth(1), { dx: -120, ms: 600 });
  await pause(2200);
  await caption(null);
  await pause(300);
};

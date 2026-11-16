import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Locator, Page } from 'playwright';
import { DEVICE_SCALE, VIEWPORT } from '../src/timeline';
import { WEBSITE_SITE } from './serve-sites';
import { TOUR_OVERLAY } from './tour-overlay';

interface Point {
  x: number;
  y: number;
}

interface MoveOptions {
  dx?: number;
  dy?: number;
  ms?: number;
}

interface Frame {
  file: string;
  timestamp: number;
}

function easeInOutCubic(progress: number) {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

// Drives the mouse in real time with an eased path, so the screencast shows a smooth cursor.
function createPointer(page: Page) {
  let mouse: Point = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

  async function glide(target: Point, ms = 550) {
    const from = mouse;
    const startedAt = Date.now();
    for (;;) {
      const progress = Math.min(1, (Date.now() - startedAt) / ms);
      const eased = easeInOutCubic(progress);
      await page.mouse.move(
        from.x + (target.x - from.x) * eased,
        from.y + (target.y - from.y) * eased,
      );
      if (progress === 1) break;
      await page.waitForTimeout(8);
    }
    mouse = target;
  }

  async function moveTo(locator: Locator, { dx = 0, dy = 0, ms }: MoveOptions = {}) {
    const box = await locator.boundingBox();
    if (box === null) throw new Error(`${locator.toString()} is not visible`);
    await glide({ x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy }, ms);
  }

  async function click(locator: Locator, options: MoveOptions = {}) {
    await moveTo(locator, options);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.waitForTimeout(90);
    await page.mouse.up();
  }

  async function scroll(distance: number, ms = 650) {
    const startedAt = Date.now();
    let scrolled = 0;
    for (;;) {
      const progress = Math.min(1, (Date.now() - startedAt) / ms);
      const target = Math.round(distance * easeInOutCubic(progress));
      if (target !== scrolled) await page.mouse.wheel(0, target - scrolled);
      scrolled = target;
      if (progress === 1) break;
      await page.waitForTimeout(8);
    }
  }

  async function place(point: Point) {
    await page.mouse.move(point.x, point.y);
    mouse = point;
  }

  return { glide, moveTo, click, scroll, place };
}

async function showCaption(page: Page, text: string | null) {
  await page.evaluate(caption => {
    const element = document.getElementById('tour-caption');
    if (element === null) return;
    if (caption === null) {
      element.removeAttribute('data-visible');
      return;
    }
    element.textContent = caption;
    element.setAttribute('data-visible', '');
  }, text);
}

async function typeSlowly(page: Page, text: string) {
  for (const character of text) {
    await page.keyboard.type(character);
    await page.waitForTimeout(85);
  }
}

// The steps of the dashboard tour, in real time.
async function playTour(page: Page) {
  const pointer = createPointer(page);
  const pause = (ms: number) => page.waitForTimeout(ms);
  const nav = page.getByRole('navigation', { name: 'Main' });

  await pointer.place({ x: 760, y: 140 });
  await showCaption(page, 'Every routine, its schedule and last run');
  await pause(700);
  const onCallRow = page.locator('tbody tr').filter({ hasText: 'on-call-engineer' });
  await pointer.moveTo(onCallRow.getByText('2 queued'), { ms: 900 });
  await pause(900);

  await showCaption(page, 'Search routines and runs with ⌘K');
  await pointer.click(page.getByRole('button', { name: 'Search', exact: true }), { ms: 700 });
  await page.getByRole('dialog').waitFor();
  await pause(300);
  await typeSlowly(page, 'on-call');
  await pause(700);
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'on-call-engineer', level: 1 }).waitFor();

  await showCaption(page, 'Schedule, settings and the webhook');
  await pointer.moveTo(page.getByText('POST /api/routines/on-call-engineer/webhook'), {
    dx: -40,
    ms: 800,
  });
  await pause(1200);

  await showCaption(page, 'Webhook requests wait in a queue');
  await pointer.click(page.getByRole('button', { name: /in queue/ }), { ms: 650 });
  await pause(2000);
  await page.keyboard.press('Escape');
  await pause(200);

  await showCaption(page, 'Every run, scheduled or from a webhook');
  await pointer.glide({ x: 640, y: 520 }, 400);
  await pointer.scroll(330);
  await pause(400);
  const webhookRun = page
    .locator('tbody tr')
    .filter({ hasText: 'Webhook' })
    .filter({ hasText: 'Succeeded' })
    .first();
  await pointer.moveTo(webhookRun.getByText('Webhook'), { ms: 600 });
  await pause(700);
  await pointer.click(webhookRun.locator('a').first(), { ms: 500 });
  await page.getByText('Transcript', { exact: true }).first().waitFor();

  await showCaption(page, 'Full transcript of every run');
  await pause(600);
  await pointer.scroll(520, 800);
  await pause(300);
  await pointer.click(page.locator('main button[aria-expanded]').nth(1), { dx: -120, ms: 600 });
  await pause(1700);

  await showCaption(page, 'The week at a glance');
  await pointer.click(nav.getByRole('link', { name: 'Calendar' }), { ms: 700 });
  await page.getByRole('heading', { name: 'Calendar', level: 1 }).waitFor();
  await pause(1900);
  await showCaption(page, null);
  await pause(300);
}

// Records the tour through the CDP screencast: lossless frames with the time each one was painted.
export async function captureTour(context: BrowserContext, folder: string): Promise<number> {
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  await context.addInitScript(TOUR_OVERLAY);
  const page = await context.newPage();
  await page.goto(`${WEBSITE_SITE.origin}${WEBSITE_SITE.base}`);
  await page.getByRole('table').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  const cdp = await context.newCDPSession(page);
  const frames: Frame[] = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(folder, `${String(frames.length).padStart(5, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, timestamp: metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', {
    format: 'png',
    maxWidth: VIEWPORT.width * DEVICE_SCALE,
    maxHeight: VIEWPORT.height * DEVICE_SCALE,
    everyNthFrame: 1,
  });

  await playTour(page);

  await cdp.send('Page.stopScreencast');
  await page.close();

  const first = frames[0];
  const last = frames.at(-1);
  if (first === undefined || last === undefined) throw new Error('The screencast sent no frames');
  const lines = frames.flatMap((frame, index) => {
    const next = frames[index + 1]?.timestamp ?? frame.timestamp + 1 / 30;
    return [`file '${frame.file}'`, `duration ${(next - frame.timestamp).toFixed(4)}`];
  });
  lines.push(`file '${last.file}'`);
  fs.writeFileSync(path.join(folder, 'frames.txt'), `${lines.join('\n')}\n`);
  return last.timestamp + 1 / 30 - first.timestamp;
}

import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import { FPS, type SceneName } from '../src/timeline';
import '../src/stage/promo-api';
import { PROMO_SITE } from './serve-sites';

export async function openScene(context: BrowserContext, scene: SceneName): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${PROMO_SITE.origin}/?scene=${scene}&record`);
  await page.waitForFunction(() => window.promo !== undefined);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

export async function seekScene(page: Page, time: number) {
  await page.evaluate(async seconds => {
    if (window.promo === undefined) throw new Error('The scene is not ready');
    await window.promo.seek(seconds);
  }, time);
}

// Seeks the scene to every frame and saves each one as a PNG, so timing never depends on the machine.
export async function captureScene(
  context: BrowserContext,
  scene: SceneName,
  seconds: number,
  folder: string,
) {
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  const page = await openScene(context, scene);
  const frameCount = Math.round(seconds * FPS);
  for (let frame = 0; frame < frameCount; frame++) {
    await seekScene(page, frame / FPS);
    await page.screenshot({ path: path.join(folder, `${String(frame).padStart(5, '0')}.png`) });
  }
  await page.close();
}

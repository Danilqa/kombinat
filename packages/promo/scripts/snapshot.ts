import fs from 'node:fs';
import path from 'node:path';
import { findScene } from '../src/timeline';
import { openSession } from './browser';
import { openScene, seekScene } from './capture-scene';
import { OUT_DIR } from './paths';
import { PROMO_SITE } from './serve-sites';

// pnpm --filter promo snapshot webhook 1 3.5 7 saves those moments of the scene to out/snapshots.
const [sceneName = '', ...times] = process.argv.slice(2);
const segment = findScene(sceneName);
if (segment === undefined) throw new Error(`No scene named "${sceneName}" in the timeline`);

const folder = path.join(OUT_DIR, 'snapshots');
fs.mkdirSync(folder, { recursive: true });
const { browser, context } = await openSession([PROMO_SITE]);
const page = await openScene(context, segment.scene);
for (const time of times.length > 0 ? times.map(Number) : [segment.seconds - 0.01]) {
  await seekScene(page, time);
  const file = path.join(folder, `${segment.scene}-${String(time)}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();

import fs from 'node:fs';
import path from 'node:path';
import { openSession } from './browser';
import { OUT_DIR } from './paths';
import { PROMO_SITE } from './serve-sites';

// Renders the YouTube thumbnail, src/stills/thumbnail-still.tsx, to out/thumbnail.png at 1920×1080.
fs.mkdirSync(OUT_DIR, { recursive: true });
const { browser, context } = await openSession([PROMO_SITE]);
const page = await context.newPage();
await page.goto(`${PROMO_SITE.origin}/?still=thumbnail`);
await page.evaluate(() => document.fonts.ready);
const file = path.join(OUT_DIR, 'thumbnail.png');
await page.screenshot({ path: file });
await browser.close();
console.log(file);

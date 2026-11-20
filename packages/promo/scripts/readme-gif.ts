import path from 'node:path';
import { openSession } from './browser';
import { captureTour } from './capture-tour';
import { runFfmpeg } from './ffmpeg';
import { OUT_DIR, README_ASSETS } from './paths';
import { playReadmeTour } from './readme-tour';
import { WEBSITE_SITE } from './serve-sites';

const GIF_FPS = 12;
const GIF_WIDTH = 1280;

// pnpm --filter promo readme-gif records the dashboard tour of the website into the README's GIF.
const folder = path.join(OUT_DIR, 'frames', 'readme');
const { browser, context } = await openSession([WEBSITE_SITE]);
const seconds = await captureTour(context, folder, playReadmeTour);
await browser.close();
console.log(`Recorded ${seconds.toFixed(1)} s`);

const gif = path.join(README_ASSETS, 'dashboard.gif');
runFfmpeg([
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  path.join(folder, 'frames.txt'),
  '-vf',
  [
    `fps=${String(GIF_FPS)},scale=${String(GIF_WIDTH)}:-1:flags=lanczos,split[a][b]`,
    '[a]palettegen=stats_mode=diff[palette]',
    '[b][palette]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
  ].join(';'),
  '-loop',
  '0',
  gif,
]);
console.log(gif);

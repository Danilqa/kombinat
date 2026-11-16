import fs from 'node:fs';
import path from 'node:path';
import { match } from 'ts-pattern';
import { TIMELINE, toSegmentName } from '../src/timeline';
import { openSession } from './browser';
import { captureScene } from './capture-scene';
import { captureTour } from './capture-tour';
import { OUT_DIR } from './paths';
import { renderVideo, type RenderedSegment } from './render-video';
import { PROMO_SITE, WEBSITE_SITE } from './serve-sites';

// pnpm --filter promo record captures every segment. Name segments, such as `record webhook tour`,
// to capture only those and reuse the frames of the rest from the last recording.
const requested = new Set(process.argv.slice(2));

for (const name of requested) {
  if (!TIMELINE.some(segment => toSegmentName(segment) === name)) {
    throw new Error(`No segment named "${name}" in the timeline`);
  }
}

const framesDir = path.join(OUT_DIR, 'frames');
const { browser, context } = await openSession([PROMO_SITE, WEBSITE_SITE]);
const rendered: RenderedSegment[] = [];
for (const segment of TIMELINE) {
  const name = toSegmentName(segment);
  const folder = path.join(framesDir, name);
  const hasFrames = fs.existsSync(folder) && fs.readdirSync(folder).length > 0;
  const isRequested = requested.size === 0 || requested.has(name);
  if (isRequested || !hasFrames) {
    console.log(`Capturing ${name}`);
    await match(segment)
      .with({ kind: 'tour' }, async () => {
        const seconds = await captureTour(context, folder);
        console.log(`  ${seconds.toFixed(1)} s`);
      })
      .with({ kind: 'scene' }, ({ scene, seconds }) =>
        captureScene(context, scene, seconds, folder),
      )
      .exhaustive();
  }
  rendered.push({
    name,
    folder,
    kind: match(segment.kind)
      .with('tour', () => 'concat' as const)
      .with('scene', () => 'frames' as const)
      .exhaustive(),
  });
}
await browser.close();

console.log('Rendering');
const video = renderVideo(rendered, OUT_DIR);
const titleFrames = fs.readdirSync(path.join(framesDir, 'title')).sort();
const posterFrame = titleFrames.at(-1);
if (posterFrame !== undefined) {
  fs.copyFileSync(path.join(framesDir, 'title', posterFrame), path.join(OUT_DIR, 'poster.png'));
}
console.log(video);

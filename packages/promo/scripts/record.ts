import fs from 'node:fs';
import path from 'node:path';
import { match } from 'ts-pattern';
import { TIMELINE, toSegmentName } from '../src/timeline';
import { openSession } from './browser';
import { captureScene } from './capture-scene';
import { captureTour, TOUR_MARKS_FILE } from './capture-tour';
import { OUT_DIR } from './paths';
import { renderVideo, type RenderedSegment } from './render-video';
import { PROMO_SITE, WEBSITE_SITE } from './serve-sites';
import { mixVoiceover, placeVoiceLines, readTourMarks, readVoiceLines } from './voiceover';

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
const silent = renderVideo(rendered, OUT_DIR);
const video = path.join(OUT_DIR, 'kombinat.mp4');
const voiceLines = readVoiceLines();
if (voiceLines.length === 0) {
  console.log('No voiceover in out/voice, run pnpm --filter promo voice to add it');
  fs.copyFileSync(silent.file, video);
} else {
  const marks = readTourMarks(path.join(framesDir, 'tour', TOUR_MARKS_FILE));
  mixVoiceover(silent.file, placeVoiceLines(voiceLines, silent.starts, marks), video);
}
const thumbnailFrames = fs.readdirSync(path.join(framesDir, 'routine-file')).sort();
const thumbnailFrame = thumbnailFrames.at(-1);
if (thumbnailFrame !== undefined) {
  fs.copyFileSync(
    path.join(framesDir, 'routine-file', thumbnailFrame),
    path.join(OUT_DIR, 'poster.png'),
  );
}
console.log(video);

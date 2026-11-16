import fs from 'node:fs';
import path from 'node:path';
import { NARRATION } from '../src/narration';
import { CROSSFADE_SECONDS, findScene } from '../src/timeline';
import { normalizeClip } from './voice-clip';
import { VOICE_DIR, VOICE_LEAD_SECONDS, VOICE_LINES_FILE, type VoiceLine } from './voiceover';

// Turns the takes in out/voice/raw/ into one clip per line at the same pace, and checks that each fits its scene.
const rawDir = path.join(VOICE_DIR, 'raw');
const linesDir = path.join(VOICE_DIR, 'lines');
fs.rmSync(linesDir, { recursive: true, force: true });

const lines: VoiceLine[] = NARRATION.map((line, index) => {
  const name = `${String(index + 1).padStart(2, '0')}-${line.segment}`;
  const takes = (line.take === undefined ? (['a', 'b'] as const) : [line.take]).filter(take =>
    fs.existsSync(path.join(rawDir, `${name}-${take}.mp3`)),
  );
  if (takes.length === 0) {
    throw new Error(`${name}-a.mp3 is missing in out/voice/raw, see the promo README`);
  }
  const clips = takes.map(take =>
    normalizeClip(
      path.join(rawDir, `${name}-${take}.mp3`),
      path.join(linesDir, `${name}-${take}.wav`),
      line.text,
    ),
  );
  const best = clips.reduce((winner, clip) =>
    Math.abs(clip.tempo - 1) < Math.abs(winner.tempo - 1) ? clip : winner,
  );
  console.log(
    `${name}  ${best.seconds.toFixed(2)} s  tempo ${best.tempo.toFixed(3)}  ${path.basename(best.file)}`,
  );
  return {
    segment: line.segment,
    ...(line.cue === undefined ? {} : { cue: line.cue }),
    file: best.file,
    seconds: best.seconds,
  };
});

fs.writeFileSync(VOICE_LINES_FILE, `${JSON.stringify(lines, null, 2)}\n`);

for (const line of lines) {
  const scene = line.cue === undefined ? findScene(line.segment) : undefined;
  if (scene === undefined) continue;
  const room = scene.seconds - CROSSFADE_SECONDS - VOICE_LEAD_SECONDS;
  if (line.seconds > room) {
    console.warn(
      `${line.segment} needs ${(line.seconds + CROSSFADE_SECONDS + VOICE_LEAD_SECONDS).toFixed(1)} s, it has ${String(scene.seconds)} s`,
    );
  }
}

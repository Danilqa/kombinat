import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { match } from 'ts-pattern';
import { CROSSFADE_SECONDS, DEVICE_SCALE, FPS, VIEWPORT } from '../src/timeline';

export interface RenderedSegment {
  name: string;
  folder: string;
  kind: 'frames' | 'concat';
}

const ENCODE = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p'];
const FADE_OUT_SECONDS = 0.5;

function runFfmpeg(args: string[]) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

function probeSeconds(file: string): number {
  const output = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ]);
  return Number(output.toString().trim());
}

function encodeSegment(segment: RenderedSegment, file: string) {
  const size = `${String(VIEWPORT.width * DEVICE_SCALE)}:${String(VIEWPORT.height * DEVICE_SCALE)}`;
  const input = match(segment.kind)
    .with('frames', () => ['-framerate', String(FPS), '-i', path.join(segment.folder, '%05d.png')])
    .with('concat', () => [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      path.join(segment.folder, 'frames.txt'),
    ])
    .exhaustive();
  runFfmpeg([...input, '-vf', `scale=${size},fps=${String(FPS)}`, ...ENCODE, file]);
}

// Encodes every segment, then joins them with crossfades into one video.
export function renderVideo(segments: RenderedSegment[], outDir: string): string {
  const clipsDir = path.join(outDir, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });
  const clips = segments.map((segment, index) => {
    const file = path.join(clipsDir, `${String(index).padStart(2, '0')}-${segment.name}.mp4`);
    encodeSegment(segment, file);
    return { file, seconds: probeSeconds(file) };
  });

  const filters: string[] = [];
  let label = '[0:v]';
  let offset = 0;
  clips.slice(1).forEach((_, index) => {
    offset += (clips[index]?.seconds ?? 0) - CROSSFADE_SECONDS;
    const next = `[v${String(index + 1)}]`;
    filters.push(
      `${label}[${String(index + 1)}:v]xfade=transition=fade:duration=${String(CROSSFADE_SECONDS)}:offset=${offset.toFixed(3)}${next}`,
    );
    label = next;
  });
  const total = offset + (clips.at(-1)?.seconds ?? 0);
  filters.push(
    `${label}fade=t=out:st=${(total - FADE_OUT_SECONDS).toFixed(3)}:d=${String(FADE_OUT_SECONDS)}[out]`,
  );

  const video = path.join(outDir, 'kombinat.mp4');
  runFfmpeg([
    ...clips.flatMap(clip => ['-i', clip.file]),
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    ...ENCODE,
    '-r',
    String(FPS),
    '-movflags',
    '+faststart',
    video,
  ]);
  return video;
}

import fs from 'node:fs';
import path from 'node:path';
import { match } from 'ts-pattern';
import { CROSSFADE_SECONDS, DEVICE_SCALE, FPS, VIEWPORT, type SegmentName } from '../src/timeline';
import { probeSeconds, runFfmpeg } from './ffmpeg';

export interface RenderedSegment {
  name: SegmentName;
  folder: string;
  kind: 'frames' | 'concat';
}

const ENCODE = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p'];
const FADE_OUT_SECONDS = 0.5;

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

export interface RenderedVideo {
  file: string;
  // When each segment starts in the video, in seconds.
  starts: Map<SegmentName, number>;
}

// Encodes every segment, then joins them with crossfades into one silent video.
export function renderVideo(segments: RenderedSegment[], outDir: string): RenderedVideo {
  const clipsDir = path.join(outDir, 'clips');
  fs.rmSync(clipsDir, { recursive: true, force: true });
  fs.mkdirSync(clipsDir, { recursive: true });
  const clips = segments.map((segment, index) => {
    const file = path.join(clipsDir, `${String(index).padStart(2, '0')}-${segment.name}.mp4`);
    encodeSegment(segment, file);
    return { file, seconds: probeSeconds(file) };
  });

  const filters: string[] = [];
  const starts = new Map<SegmentName, number>();
  let label = '[0:v]';
  let offset = 0;
  segments.forEach((segment, index) => {
    const previous = clips[index - 1];
    if (previous !== undefined) {
      offset += previous.seconds - CROSSFADE_SECONDS;
      const next = `[v${String(index)}]`;
      filters.push(
        `${label}[${String(index)}:v]xfade=transition=fade:duration=${String(CROSSFADE_SECONDS)}:offset=${offset.toFixed(3)}${next}`,
      );
      label = next;
    }
    starts.set(segment.name, offset);
  });
  const total = offset + (clips.at(-1)?.seconds ?? 0);
  filters.push(
    `${label}fade=t=out:st=${(total - FADE_OUT_SECONDS).toFixed(3)}:d=${String(FADE_OUT_SECONDS)}[out]`,
  );

  const video = path.join(outDir, 'kombinat-silent.mp4');
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
  return { file: video, starts };
}

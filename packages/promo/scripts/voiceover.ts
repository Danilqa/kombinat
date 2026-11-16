import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { TIMELINE, toSegmentName, type SegmentName } from '../src/timeline';
import { probeSeconds, runFfmpeg } from './ffmpeg';
import { OUT_DIR } from './paths';

const segmentNameSchema = z.custom<SegmentName>(
  value => typeof value === 'string' && TIMELINE.some(segment => toSegmentName(segment) === value),
);

const voiceLineSchema = z.object({
  segment: segmentNameSchema,
  cue: z.string().optional(),
  file: z.string(),
  seconds: z.number(),
});

const tourMarkSchema = z.object({ caption: z.string(), seconds: z.number() });

export type VoiceLine = z.infer<typeof voiceLineSchema>;
export type TourMark = z.infer<typeof tourMarkSchema>;

export interface PlacedVoiceLine {
  file: string;
  at: number;
}

export const VOICE_DIR = path.join(OUT_DIR, 'voice');
export const VOICE_LINES_FILE = path.join(VOICE_DIR, 'lines.json');
// A line starts once the crossfade into its segment is over.
export const VOICE_LEAD_SECONDS = 0.45;

export function readVoiceLines(): VoiceLine[] {
  if (!fs.existsSync(VOICE_LINES_FILE)) return [];
  return z.array(voiceLineSchema).parse(JSON.parse(fs.readFileSync(VOICE_LINES_FILE, 'utf8')));
}

export function readTourMarks(file: string): TourMark[] {
  if (!fs.existsSync(file)) return [];
  return z.array(tourMarkSchema).parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function placeVoiceLines(
  lines: VoiceLine[],
  segmentStarts: Map<SegmentName, number>,
  marks: TourMark[],
): PlacedVoiceLine[] {
  return lines.map(line => {
    const start = segmentStarts.get(line.segment);
    if (start === undefined) throw new Error(`No segment named "${line.segment}" in the video`);
    if (line.cue === undefined) return { file: line.file, at: start + VOICE_LEAD_SECONDS };
    const mark = marks.find(candidate => candidate.caption === line.cue);
    if (mark === undefined) throw new Error(`The tour never shows the caption "${line.cue}"`);
    return { file: line.file, at: start + mark.seconds };
  });
}

// Lays the voice lines over the video at their times.
export function mixVoiceover(video: string, lines: PlacedVoiceLine[], output: string) {
  const delays = lines.map((line, index) => {
    const ms = String(Math.round(line.at * 1000));
    return `[${String(index + 1)}:a]adelay=${ms}:all=1[v${String(index)}]`;
  });
  const inputs = lines.map((_, index) => `[v${String(index)}]`).join('');
  runFfmpeg([
    '-i',
    video,
    ...lines.flatMap(line => ['-i', line.file]),
    '-filter_complex',
    `${delays.join(';')};${inputs}amix=inputs=${String(lines.length)}:normalize=0,apad=whole_dur=${probeSeconds(video).toFixed(3)}[voice]`,
    '-map',
    '0:v',
    '-map',
    '[voice]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    output,
  ]);
}

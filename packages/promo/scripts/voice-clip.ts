import fs from 'node:fs';
import path from 'node:path';
import { listSilenceSeconds, probeSeconds, runFfmpeg } from './ffmpeg';

// Sarah's median pace across the lines, in letters of the script per second of speech.
export const TARGET_LETTERS_PER_SECOND = 13.7;
// More than this and the stretch starts to sound processed.
const MAX_TEMPO_CHANGE = 0.15;
const EDGE_SILENCE = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03';

export interface VoiceClip {
  file: string;
  seconds: number;
  tempo: number;
}

function countLetters(text: string): number {
  return text.match(/\p{L}/gu)?.length ?? 0;
}

// Trims the silence around a take, stretches it to the target pace and evens out its loudness.
export function normalizeClip(input: string, output: string, text: string): VoiceClip {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const trimmed = `${output}.trimmed.wav`;
  runFfmpeg(['-i', input, '-af', `${EDGE_SILENCE},areverse,${EDGE_SILENCE},areverse`, trimmed]);
  const pauses = listSilenceSeconds(trimmed, '-40dB', 0.12).reduce(
    (sum, seconds) => sum + seconds,
    0,
  );
  const voicedSeconds = probeSeconds(trimmed) - pauses;
  const targetSeconds = countLetters(text) / TARGET_LETTERS_PER_SECOND;
  const tempo = Math.min(
    1 + MAX_TEMPO_CHANGE,
    Math.max(1 - MAX_TEMPO_CHANGE, voicedSeconds / targetSeconds),
  );
  runFfmpeg([
    '-i',
    trimmed,
    '-af',
    `atempo=${tempo.toFixed(4)},loudnorm=I=-16:TP=-1.5:LRA=11`,
    '-ar',
    '48000',
    '-ac',
    '1',
    output,
  ]);
  fs.rmSync(trimmed);
  return { file: output, seconds: probeSeconds(output), tempo };
}

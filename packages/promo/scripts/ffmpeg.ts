import { execFileSync, spawnSync } from 'node:child_process';

export function runFfmpeg(args: string[]) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

export function probeSeconds(file: string): number {
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

// The pauses in a file, from ffmpeg's silencedetect log.
export function listSilenceSeconds(file: string, threshold: string, minSeconds: number): number[] {
  const { stderr } = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      file,
      '-af',
      `silencedetect=n=${threshold}:d=${String(minSeconds)}`,
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  );
  return [...stderr.matchAll(/silence_duration: ([\d.]+)/g)].map(([, seconds]) => Number(seconds));
}

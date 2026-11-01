import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const env = (name: string): string | undefined => process.env[name];

export const config = {
  repoRoot,
  routinesDir: env('KOMBINAT_ROUTINES_DIR') ?? path.join(repoRoot, 'routines'),
  stateDir: env('KOMBINAT_STATE_DIR') ?? path.join(os.homedir(), '.kombinat'),
  uiDist: path.join(repoRoot, 'ui', 'dist'),
  port: Number(env('KOMBINAT_PORT') ?? 7433),
  claudeBin: env('CLAUDE_BIN') ?? path.join(os.homedir(), '.local', 'bin', 'claude'),
  codexBin: env('CODEX_BIN') ?? 'codex',
  tickSeconds: Number(env('KOMBINAT_TICK_SECONDS') ?? 30),
  maxConcurrentRuns: Number(env('KOMBINAT_MAX_CONCURRENT') ?? 3),
  catchUpWindowDays: 7,
  pullMinutes: Number(env('KOMBINAT_PULL_MINUTES') ?? 5),
  pullBranch: env('KOMBINAT_PULL_BRANCH') ?? 'main',
  managed: env('KOMBINAT_MANAGED') === '1',
  launchdLabel: 'com.kombinat.daemon',
};

export const getCliArgs = (...args: string[]): string[] => [
  '--import',
  'tsx',
  path.join(repoRoot, 'src', 'cli.ts'),
  ...args,
];

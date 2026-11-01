import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const env = (name: string): string | undefined => process.env[name];

export const config = {
  repoRoot,
  routinesDir: env('PAPA_CARLO_ROUTINES_DIR') ?? path.join(repoRoot, 'routines'),
  stateDir: env('PAPA_CARLO_STATE_DIR') ?? path.join(os.homedir(), '.papa-carlo'),
  uiDist: path.join(repoRoot, 'ui', 'dist'),
  port: Number(env('PAPA_CARLO_PORT') ?? 7433),
  claudeBin: env('CLAUDE_BIN') ?? path.join(os.homedir(), '.local', 'bin', 'claude'),
  codexBin: env('CODEX_BIN') ?? 'codex',
  tickSeconds: Number(env('PAPA_CARLO_TICK_SECONDS') ?? 30),
  maxConcurrentRuns: Number(env('PAPA_CARLO_MAX_CONCURRENT') ?? 3),
  catchUpWindowDays: 7,
  pullMinutes: Number(env('PAPA_CARLO_PULL_MINUTES') ?? 5),
  pullBranch: env('PAPA_CARLO_PULL_BRANCH') ?? 'main',
  managed: env('PAPA_CARLO_MANAGED') === '1',
  launchdLabel: 'com.papa-carlo.daemon',
};

export const getCliArgs = (...args: string[]): string[] => [
  '--import',
  'tsx',
  path.join(repoRoot, 'src', 'cli.ts'),
  ...args,
];

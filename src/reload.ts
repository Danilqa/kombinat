import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { isMatching } from 'ts-pattern';
import { z } from 'zod';

import { config } from './config';
import { getErrorMessage } from './shared/errors';

type Log = (line: string) => void;

const processErrorSchema = z.object({ stderr: z.string() });

function getProcessOutput(error: unknown): string {
  const parsed = processErrorSchema.safeParse(error);
  return parsed.success && parsed.data.stderr ? parsed.data.stderr : getErrorMessage(error);
}

function getNewestMtime(root: string): number {
  if (!fs.existsSync(root)) return 0;
  const stat = fs.statSync(root);
  if (stat.isFile()) return stat.mtimeMs;
  return fs
    .readdirSync(root)
    .reduce(
      (newest, entry) => Math.max(newest, getNewestMtime(path.join(root, entry))),
      stat.mtimeMs,
    );
}

const uiSources = () => [
  path.join(config.repoRoot, 'ui', 'src'),
  path.join(config.repoRoot, 'ui', 'index.html'),
  path.join(config.repoRoot, 'ui', 'vite.config.ts'),
  path.join(config.repoRoot, 'src', 'shared'),
];

export function isUiStale(repoRoot = config.repoRoot): boolean {
  const built = path.join(repoRoot, 'ui', 'dist', 'index.html');
  if (!fs.existsSync(built)) return true;
  const builtAt = fs.statSync(built).mtimeMs;
  return uiSources().some(
    source => getNewestMtime(source.replace(config.repoRoot, repoRoot)) > builtAt,
  );
}

export function areDepsStale(repoRoot = config.repoRoot): boolean {
  const marker = path.join(repoRoot, 'node_modules', '.modules.yaml');
  if (!fs.existsSync(marker)) return true;
  const installedAt = fs.statSync(marker).mtimeMs;
  return ['package.json', 'pnpm-lock.yaml'].some(
    file =>
      fs.existsSync(path.join(repoRoot, file)) &&
      fs.statSync(path.join(repoRoot, file)).mtimeMs > installedAt,
  );
}

function runPnpm(args: string[], log: Log): boolean {
  try {
    const output = execFileSync('pnpm', ['-s', ...args], {
      cwd: config.repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5 * 60_000,
    });
    log(`pnpm ${args.join(' ')}: ${output.trim().split('\n').at(-1) ?? 'ok'}`);
    return true;
  } catch (err) {
    const stderr = getProcessOutput(err);
    log(`pnpm ${args.join(' ')} failed: ${stderr.trim().split('\n').slice(-5).join(' | ')}`);
    return false;
  }
}

export function installDepsIfStale(log: Log): boolean {
  if (!areDepsStale()) return false;
  log('dependencies changed, running pnpm install');
  return runPnpm(['install', '--frozen-lockfile'], log);
}

export function buildUiIfStale(log: Log): boolean {
  if (!isUiStale()) return false;
  log('ui sources newer than ui/dist, building');
  return runPnpm(['ui:build'], log);
}

function watchDebounced(
  target: string,
  delayMs: number,
  onChange: (file: string) => void,
): fs.FSWatcher | null {
  if (!fs.existsSync(target)) return null;
  let timer: NodeJS.Timeout | null = null;
  let lastFile = '';
  const watcher = fs.watch(target, { recursive: true }, (_event, file) => {
    lastFile = file ?? '';
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onChange(lastFile), delayMs);
  });
  watcher.unref();
  return watcher;
}

function runGit(args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...args],
    {
      cwd: config.repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90_000,
    },
  ).trim();
}

export interface PullResult {
  status: 'updated' | 'up_to_date' | 'skipped' | 'failed';
  detail: string;
}

export function pullLatest(): PullResult {
  try {
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== config.pullBranch)
      return { status: 'skipped', detail: `on branch ${branch}, not ${config.pullBranch}` };
    const dirty = runGit(['status', '--porcelain']);
    if (dirty)
      return {
        status: 'skipped',
        detail: `working tree has local changes (${dirty.split('\n').length} files)`,
      };
    const before = runGit(['rev-parse', 'HEAD']);
    runGit(['pull', '--ff-only', '--quiet', 'origin', config.pullBranch]);
    const after = runGit(['rev-parse', 'HEAD']);
    if (before === after) return { status: 'up_to_date', detail: after.slice(0, 10) };
    const summary = runGit(['log', '--oneline', `${before}..${after}`]);
    return { status: 'updated', detail: summary.split('\n').reverse().join(' | ') };
  } catch (err) {
    const stderr = getProcessOutput(err).trim();
    return { status: 'failed', detail: stderr.split('\n').slice(-3).join(' | ') };
  }
}

export function startAutoPull(log: Log): () => void {
  if (config.pullMinutes <= 0) return () => {};
  let lastMessage = '';
  const run = () => {
    const result = pullLatest();
    const message = isMatching({ status: 'up_to_date' }, result)
      ? ''
      : `git pull ${result.status}: ${result.detail}`;
    if (message && message !== lastMessage) log(message);
    lastMessage = message;
  };
  const timer = setInterval(run, config.pullMinutes * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

export function startReloadWatchers(log: Log, restart: (reason: string) => void): () => void {
  const watchers = [
    watchDebounced(path.join(config.repoRoot, 'src'), 1500, file => restart(`src/${file} changed`)),
    watchDebounced(path.join(config.repoRoot, 'ui', 'src'), 1500, file => {
      log(`ui/src/${file} changed, rebuilding ui`);
      runPnpm(['ui:build'], log);
    }),
    watchDebounced(path.join(config.repoRoot, 'pnpm-lock.yaml'), 1500, () => {
      installDepsIfStale(log);
      restart('dependencies changed');
    }),
  ];
  return () => watchers.forEach(w => w?.close());
}

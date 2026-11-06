import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PACKAGE_NAME = '@danilqa/kombinat';
export const DEFAULT_PORT = 7433;

export function findProjectRoot(from: string): string {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    if (path.dirname(dir) === dir) return from;
  }
}

export function findPackageLink(from: string): string | null {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', PACKAGE_NAME);
    if (fs.existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

const projectRoot = findProjectRoot(process.cwd());
const ownRoot = path.resolve(import.meta.dirname, '..');
const packageLink = findPackageLink(projectRoot);
// Unlike pnpm's versioned folder, the node_modules link survives upgrades.
const installedRoot =
  packageLink !== null && fs.realpathSync(packageLink) === fs.realpathSync(ownRoot)
    ? packageLink
    : null;
const packageRoot = installedRoot ?? ownRoot;
const fromSource = fs.existsSync(path.join(packageRoot, 'src', 'cli.ts'));

const env = (name: string): string | undefined => process.env[name];

export const config = {
  projectRoot,
  packageRoot,
  workspaceRoot: fromSource ? path.resolve(fs.realpathSync(packageRoot), '..', '..') : null,
  cliBin: path.join(packageRoot, 'bin', 'kombinat.js'),
  fromSource,
  installedInProject: installedRoot !== null,
  projectHasCopy: packageLink !== null,
  routinesDir: env('KOMBINAT_ROUTINES_DIR') ?? path.join(projectRoot, 'routines'),
  stateDir: env('KOMBINAT_STATE_DIR') ?? path.join(os.homedir(), '.kombinat'),
  webAppDist: path.join(packageRoot, 'dist', 'web-app'),
  port: Number(env('KOMBINAT_PORT') ?? DEFAULT_PORT),
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

export const getCliArgs = (...args: string[]): string[] => [config.cliBin, ...args];

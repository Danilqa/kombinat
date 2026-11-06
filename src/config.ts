import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PACKAGE_NAME = '@danilqa/kombinat';
export const DEFAULT_PORT = 7433;

// npm and pnpm run bins in the folder they are called from, which can be a subfolder of the project.
export function findProjectRoot(from: string): string {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    if (path.dirname(dir) === dir) return from;
  }
}

// The copy node resolves for the project, the same way it resolves any other dependency.
export function findPackageLink(from: string): string | null {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', PACKAGE_NAME);
    if (fs.existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

// The folder kombinat runs in: it holds routines/, package.json and the git checkout to pull.
const projectRoot = findProjectRoot(process.cwd());
const ownRoot = path.resolve(import.meta.dirname, '..');
const packageLink = findPackageLink(projectRoot);
// pnpm keeps each version in its own folder, so use the node_modules link instead: it survives upgrades.
const installedRoot =
  packageLink !== null && fs.realpathSync(packageLink) === fs.realpathSync(ownRoot)
    ? packageLink
    : null;
const packageRoot = installedRoot ?? ownRoot;

const env = (name: string): string | undefined => process.env[name];

export const config = {
  projectRoot,
  packageRoot,
  cliBin: path.join(packageRoot, 'bin', 'kombinat.js'),
  // A checkout of the kombinat repository: runs the TypeScript sources and builds the UI itself.
  fromSource: fs.existsSync(path.join(packageRoot, 'src', 'cli.ts')),
  installedInProject: installedRoot !== null,
  projectHasCopy: packageLink !== null,
  routinesDir: env('KOMBINAT_ROUTINES_DIR') ?? path.join(projectRoot, 'routines'),
  stateDir: env('KOMBINAT_STATE_DIR') ?? path.join(os.homedir(), '.kombinat'),
  uiDist: path.join(packageRoot, 'ui', 'dist'),
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

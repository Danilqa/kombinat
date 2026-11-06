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
  path.join(config.packageRoot, 'ui', 'src'),
  path.join(config.packageRoot, 'ui', 'index.html'),
  path.join(config.packageRoot, 'ui', 'vite.config.ts'),
  path.join(config.packageRoot, 'src', 'shared'),
];

export function isUiStale(packageRoot = config.packageRoot): boolean {
  const built = path.join(packageRoot, 'ui', 'dist', 'index.html');
  if (!fs.existsSync(built)) return true;
  const builtAt = fs.statSync(built).mtimeMs;
  return uiSources().some(
    source => getNewestMtime(source.replace(config.packageRoot, packageRoot)) > builtAt,
  );
}

interface PackageManager {
  command: string;
  install: string[];
  lockfile: string;
  marker: string;
}

interface Dependencies {
  manager: PackageManager;
  root: string;
}

const PACKAGE_MANAGERS: PackageManager[] = [
  {
    command: 'pnpm',
    install: ['-s', 'install', '--frozen-lockfile'],
    lockfile: 'pnpm-lock.yaml',
    marker: '.modules.yaml',
  },
  // Not npm ci: when it fails, node_modules is left empty, kombinat included.
  {
    command: 'npm',
    install: ['install', '--no-audit', '--no-fund', '--loglevel=error'],
    lockfile: 'package-lock.json',
    marker: '.package-lock.json',
  },
];

// pnpm does not touch its marker when there is nothing to install.
const INSTALL_MARKER = '.kombinat-install';

// Up to the git root, for workspaces with the lockfile at the top.
function getLockfileDirs(projectRoot: string): string[] {
  const dirs: string[] = [];
  for (let dir = projectRoot; ; dir = path.dirname(dir)) {
    dirs.push(dir);
    if (fs.existsSync(path.join(dir, '.git'))) return dirs;
    if (path.dirname(dir) === dir) return [projectRoot];
  }
}

export function findDependencies(projectRoot = config.projectRoot): Dependencies | null {
  for (const root of getLockfileDirs(projectRoot)) {
    const manager = PACKAGE_MANAGERS.find(candidate =>
      fs.existsSync(path.join(root, candidate.lockfile)),
    );
    if (manager !== undefined) return { manager, root };
  }
  return null;
}

function getMtime(file: string): number {
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
}

function isStale({ manager, root }: Dependencies): boolean {
  const installedAt = Math.max(
    ...[manager.marker, INSTALL_MARKER].map(marker =>
      getMtime(path.join(root, 'node_modules', marker)),
    ),
  );
  return ['package.json', manager.lockfile].some(
    file => getMtime(path.join(root, file)) > installedAt,
  );
}

export function areDepsStale(projectRoot = config.projectRoot): boolean {
  const dependencies = findDependencies(projectRoot);
  return dependencies !== null && isStale(dependencies);
}

function runTool(command: string, args: string[], cwd: string, log: Log): boolean {
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5 * 60_000,
    });
    log(`${command} ${args.join(' ')}: ${output.trim().split('\n').at(-1) || 'ok'}`);
    return true;
  } catch (err) {
    const stderr = getProcessOutput(err);
    log(`${command} ${args.join(' ')} failed: ${stderr.trim().split('\n').slice(-5).join(' | ')}`);
    return false;
  }
}

const buildUi = (log: Log): boolean => runTool('pnpm', ['-s', 'ui:build'], config.packageRoot, log);

export function installDepsIfStale(log: Log): boolean {
  const dependencies = findDependencies();
  if (dependencies === null || !isStale(dependencies)) return false;
  const { manager, root } = dependencies;
  log(`dependencies changed, running ${manager.command} ${manager.install.join(' ')}`);
  const isInstalled = runTool(manager.command, manager.install, root, log);
  const modules = path.join(root, 'node_modules');
  if (isInstalled && fs.existsSync(modules)) {
    fs.writeFileSync(path.join(modules, INSTALL_MARKER), '');
  }
  return isInstalled;
}

export function buildUiIfStale(log: Log): boolean {
  if (!config.fromSource || !isUiStale()) return false;
  log('ui sources newer than ui/dist, building');
  return buildUi(log);
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
      cwd: config.projectRoot,
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
    // git pull refuses to overwrite untracked files anyway.
    const dirty = runGit(['status', '--porcelain', '--untracked-files=no']);
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
  const dependencies = findDependencies();
  const sourceWatchers = config.fromSource
    ? [
        watchDebounced(path.join(config.packageRoot, 'src'), 1500, file =>
          restart(`src/${file} changed`),
        ),
        watchDebounced(path.join(config.packageRoot, 'ui', 'src'), 1500, file => {
          log(`ui/src/${file} changed, rebuilding ui`);
          buildUi(log);
        }),
      ]
    : [];
  const lockfile =
    dependencies === null ? null : path.join(dependencies.root, dependencies.manager.lockfile);
  const watchers = [
    ...sourceWatchers,
    lockfile === null
      ? null
      : watchDebounced(lockfile, 1500, () => {
          installDepsIfStale(log);
          if (!fs.existsSync(config.cliBin)) {
            log(`${config.cliBin} is missing after the install, keeping this version running`);
            return;
          }
          restart('dependencies changed');
        }),
  ];
  return () => watchers.forEach(w => w?.close());
}

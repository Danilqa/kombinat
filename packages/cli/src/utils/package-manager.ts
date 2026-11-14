import fs from 'node:fs';
import path from 'node:path';

export interface PackageManager {
  command: string;
  install: string[];
  add: string;
  runner: string;
  lockfile: string;
  marker: string;
}

export interface Dependencies {
  manager: PackageManager;
  root: string;
}

const PNPM: PackageManager = {
  command: 'pnpm',
  install: ['-s', 'install', '--frozen-lockfile'],
  add: 'add',
  runner: 'pnpm',
  lockfile: 'pnpm-lock.yaml',
  marker: '.modules.yaml',
};

// Not npm ci: when it fails, node_modules is left empty, kombinat included.
const NPM: PackageManager = {
  command: 'npm',
  install: ['install', '--no-audit', '--no-fund', '--loglevel=error'],
  add: 'install',
  runner: 'npx',
  lockfile: 'package-lock.json',
  marker: '.package-lock.json',
};

// Yarn 2+ reads --frozen-lockfile as --immutable.
const YARN: PackageManager = {
  command: 'yarn',
  install: ['install', '--frozen-lockfile'],
  add: 'add',
  runner: 'yarn',
  lockfile: 'yarn.lock',
  marker: '.yarn-integrity',
};

const PACKAGE_MANAGERS = [PNPM, NPM, YARN];

// Up to the git root, for workspaces with the lockfile at the top.
function getLockfileDirs(projectRoot: string): string[] {
  const dirs: string[] = [];
  for (let dir = projectRoot; ; dir = path.dirname(dir)) {
    dirs.push(dir);
    if (fs.existsSync(path.join(dir, '.git'))) return dirs;
    if (path.dirname(dir) === dir) return [projectRoot];
  }
}

export function findDependencies(projectRoot: string): Dependencies | null {
  for (const root of getLockfileDirs(projectRoot)) {
    const manager = PACKAGE_MANAGERS.find(candidate =>
      fs.existsSync(path.join(root, candidate.lockfile)),
    );
    if (manager !== undefined) return { manager, root };
  }
  return null;
}

// Package managers set it for the commands they start, such as "pnpm/11.0.9 node/v24.1.0".
export function detectPackageManager(userAgent: string | undefined): PackageManager {
  const command = userAgent?.split('/')[0];
  return PACKAGE_MANAGERS.find(manager => manager.command === command) ?? NPM;
}

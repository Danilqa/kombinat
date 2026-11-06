#!/usr/bin/env node
// Temporary, for LaunchAgents written before the move to packages/cli. Remove it one release later.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ABANDONED_LOCK_MS = 10 * 60_000;

const root = path.join(import.meta.dirname, '..');
const modules = path.join(root, 'node_modules');
const marker = path.join(modules, '.kombinat-install');
const lock = path.join(modules, '.kombinat-install.lock');

const getMtime = file => fs.statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? 0;

function isStale() {
  if (!fs.existsSync(path.join(root, 'packages', 'cli', 'node_modules'))) return true;
  const installedAt = Math.max(getMtime(path.join(modules, '.modules.yaml')), getMtime(marker));
  return ['pnpm-lock.yaml', 'package.json'].some(
    file => getMtime(path.join(root, file)) > installedAt,
  );
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function lockInstall() {
  for (;;) {
    try {
      fs.mkdirSync(lock);
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - getMtime(lock) > ABANDONED_LOCK_MS) {
        fs.rmSync(lock, { recursive: true, force: true });
      } else {
        sleep(1000);
      }
    }
  }
}

if (isStale()) {
  fs.mkdirSync(modules, { recursive: true });
  lockInstall();
  try {
    if (isStale()) {
      execFileSync('pnpm', ['install', '--frozen-lockfile'], {
        cwd: root,
        stdio: 'inherit',
        timeout: 5 * 60_000,
      });
      fs.writeFileSync(marker, '');
    }
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

await import('../packages/cli/bin/kombinat.js');

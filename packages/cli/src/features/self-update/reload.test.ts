import assert from 'node:assert/strict';
import { test } from 'node:test';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findDependencies } from '../../utils/package-manager';
import { checkAreDepsStale, installDepsBeforeRestart, checkIsWebAppStale } from './reload';

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-reload-'));
  fs.mkdirSync(path.join(root, 'packages', 'web-app', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages', 'cli', 'dist', 'web-app'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  return root;
}

function touch(file: string, whenMs: number): void {
  fs.writeFileSync(file, 'x');
  fs.utimesSync(file, whenMs / 1000, whenMs / 1000);
}

test('the web app is stale when dist/web-app is missing or older than a source file', () => {
  const root = makeRepo();
  assert.equal(checkIsWebAppStale(root), true);
  touch(path.join(root, 'packages', 'web-app', 'src', 'app.tsx'), 1_000_000);
  touch(path.join(root, 'packages', 'cli', 'dist', 'web-app', 'index.html'), 2_000_000);
  fs.utimesSync(path.join(root, 'packages', 'web-app', 'src'), 1000, 1000);
  fs.utimesSync(path.join(root, 'packages', 'web-app'), 1000, 1000);
  assert.equal(checkIsWebAppStale(root), false);
  touch(path.join(root, 'packages', 'web-app', 'src', 'app.tsx'), 3_000_000);
  assert.equal(checkIsWebAppStale(root), true);
});

test('shared packages are web app sources, their node_modules and dist are not', () => {
  const root = makeRepo();
  const utils = path.join(root, 'packages', 'utils');
  for (const folder of ['node_modules', 'dist']) {
    fs.mkdirSync(path.join(utils, folder), { recursive: true });
    touch(path.join(utils, folder, 'index.js'), 3_000_000);
  }
  touch(path.join(utils, 'http.ts'), 1_000_000);
  touch(path.join(root, 'packages', 'cli', 'dist', 'web-app', 'index.html'), 2_000_000);
  for (const folder of [utils, path.join(root, 'packages', 'web-app', 'src')]) {
    fs.utimesSync(folder, 1000, 1000);
  }
  assert.equal(checkIsWebAppStale(root), false);
  touch(path.join(utils, 'http.ts'), 3_000_000);
  assert.equal(checkIsWebAppStale(root), true);
});

test('docs next to the web app sources do not make it stale', () => {
  const root = makeRepo();
  const domains = path.join(root, 'packages', 'domains');
  fs.mkdirSync(domains);
  touch(path.join(domains, 'README.md'), 3_000_000);
  touch(path.join(root, 'packages', 'cli', 'dist', 'web-app', 'index.html'), 2_000_000);
  for (const folder of [domains, path.join(root, 'packages', 'web-app', 'src')]) {
    fs.utimesSync(folder, 1000, 1000);
  }
  assert.equal(checkIsWebAppStale(root), false);
});

test('the design system is a web app source', () => {
  const root = makeRepo();
  const designSystem = path.join(root, 'packages', 'design-system');
  fs.mkdirSync(designSystem);
  touch(path.join(designSystem, 'utils.ts'), 1_000_000);
  touch(path.join(root, 'packages', 'cli', 'dist', 'web-app', 'index.html'), 2_000_000);
  for (const folder of [designSystem, path.join(root, 'packages', 'web-app', 'src')]) {
    fs.utimesSync(folder, 1000, 1000);
  }
  assert.equal(checkIsWebAppStale(root), false);
  touch(path.join(designSystem, 'utils.ts'), 3_000_000);
  assert.equal(checkIsWebAppStale(root), true);
});

test('deps are stale when the lockfile is newer than the install marker', () => {
  const root = makeRepo();
  touch(path.join(root, 'pnpm-lock.yaml'), 1_000_000);
  assert.equal(checkAreDepsStale(root), true);
  touch(path.join(root, 'node_modules', '.modules.yaml'), 2_000_000);
  assert.equal(checkAreDepsStale(root), false);
  touch(path.join(root, 'pnpm-lock.yaml'), 3_000_000);
  assert.equal(checkAreDepsStale(root), true);
});

test('a restart waits for the dependencies the new code needs', () => {
  const root = makeRepo();
  const lines: string[] = [];
  const log = (line: string): void => {
    lines.push(line);
  };
  touch(path.join(root, 'pnpm-lock.yaml'), 1_000_000);
  touch(path.join(root, 'node_modules', '.modules.yaml'), 2_000_000);
  assert.equal(installDepsBeforeRestart(log, root), true);
  assert.equal(lines.length, 0);
  touch(path.join(root, 'pnpm-lock.yaml'), 3_000_000);
  assert.equal(installDepsBeforeRestart(log, root), false);
  assert.match(lines.join('\n'), /pnpm -s install --frozen-lockfile failed/);
  assert.equal(checkAreDepsStale(root), true);
});

test('npm projects are checked against the npm install marker', () => {
  const root = makeRepo();
  touch(path.join(root, 'package-lock.json'), 1_000_000);
  assert.equal(findDependencies(root)?.manager.command, 'npm');
  assert.equal(checkAreDepsStale(root), true);
  touch(path.join(root, 'node_modules', '.package-lock.json'), 2_000_000);
  assert.equal(checkAreDepsStale(root), false);
});

test('an install by kombinat counts even when pnpm left its own marker alone', () => {
  const root = makeRepo();
  touch(path.join(root, 'node_modules', '.modules.yaml'), 1_000_000);
  touch(path.join(root, 'package.json'), 2_000_000);
  touch(path.join(root, 'pnpm-lock.yaml'), 2_000_000);
  assert.equal(checkAreDepsStale(root), true);
  touch(path.join(root, 'node_modules', '.kombinat-install'), 3_000_000);
  assert.equal(checkAreDepsStale(root), false);
});

test('yarn projects are checked against the yarn install marker', () => {
  const root = makeRepo();
  touch(path.join(root, 'yarn.lock'), 1_000_000);
  assert.equal(findDependencies(root)?.manager.command, 'yarn');
  assert.equal(checkAreDepsStale(root), true);
  touch(path.join(root, 'node_modules', '.yarn-integrity'), 2_000_000);
  assert.equal(checkAreDepsStale(root), false);
});

test('deps are never stale without a lockfile', () => {
  const root = makeRepo();
  assert.equal(findDependencies(root), null);
  assert.equal(checkAreDepsStale(root), false);
  touch(path.join(root, 'bun.lock'), 1_000_000);
  assert.equal(findDependencies(root), null);
});

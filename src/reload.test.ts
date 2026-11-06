import assert from 'node:assert/strict';
import { test } from 'node:test';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { areDepsStale, findDependencies, isUiStale } from './reload';

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-reload-'));
  fs.mkdirSync(path.join(root, 'ui', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'ui', 'dist'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  return root;
}

function touch(file: string, whenMs: number): void {
  fs.writeFileSync(file, 'x');
  fs.utimesSync(file, whenMs / 1000, whenMs / 1000);
}

test('ui is stale when dist is missing or older than a source file', () => {
  const root = makeRepo();
  assert.equal(isUiStale(root), true);
  touch(path.join(root, 'ui', 'src', 'app.tsx'), 1_000_000);
  touch(path.join(root, 'ui', 'dist', 'index.html'), 2_000_000);
  fs.utimesSync(path.join(root, 'ui', 'src'), 1000, 1000);
  fs.utimesSync(path.join(root, 'ui'), 1000, 1000);
  assert.equal(isUiStale(root), false);
  touch(path.join(root, 'ui', 'src', 'app.tsx'), 3_000_000);
  assert.equal(isUiStale(root), true);
});

test('deps are stale when the lockfile is newer than the install marker', () => {
  const root = makeRepo();
  touch(path.join(root, 'pnpm-lock.yaml'), 1_000_000);
  assert.equal(areDepsStale(root), true);
  touch(path.join(root, 'node_modules', '.modules.yaml'), 2_000_000);
  assert.equal(areDepsStale(root), false);
  touch(path.join(root, 'pnpm-lock.yaml'), 3_000_000);
  assert.equal(areDepsStale(root), true);
});

test('npm projects are checked against the npm install marker', () => {
  const root = makeRepo();
  touch(path.join(root, 'package-lock.json'), 1_000_000);
  assert.equal(findDependencies(root)?.manager.command, 'npm');
  assert.equal(areDepsStale(root), true);
  touch(path.join(root, 'node_modules', '.package-lock.json'), 2_000_000);
  assert.equal(areDepsStale(root), false);
});

test('an install by kombinat counts even when pnpm left its own marker alone', () => {
  const root = makeRepo();
  touch(path.join(root, 'node_modules', '.modules.yaml'), 1_000_000);
  touch(path.join(root, 'package.json'), 2_000_000);
  touch(path.join(root, 'pnpm-lock.yaml'), 2_000_000);
  assert.equal(areDepsStale(root), true);
  touch(path.join(root, 'node_modules', '.kombinat-install'), 3_000_000);
  assert.equal(areDepsStale(root), false);
});

test('a workspace member uses the lockfile at the root of its git checkout', () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, '.git'));
  touch(path.join(root, 'pnpm-lock.yaml'), 1_000_000);
  const member = path.join(root, 'packages', 'agents');
  fs.mkdirSync(member, { recursive: true });
  assert.deepEqual(findDependencies(member)?.root, root);
});

test('a lockfile outside the git checkout of the project is ignored', () => {
  const root = makeRepo();
  touch(path.join(root, 'package-lock.json'), 1_000_000);
  const project = path.join(root, 'project');
  fs.mkdirSync(project);
  assert.equal(findDependencies(project), null);
});

test('yarn projects are checked against the yarn install marker', () => {
  const root = makeRepo();
  touch(path.join(root, 'yarn.lock'), 1_000_000);
  assert.equal(findDependencies(root)?.manager.command, 'yarn');
  assert.equal(areDepsStale(root), true);
  touch(path.join(root, 'node_modules', '.yarn-integrity'), 2_000_000);
  assert.equal(areDepsStale(root), false);
});

test('deps are never stale without a lockfile', () => {
  const root = makeRepo();
  assert.equal(findDependencies(root), null);
  assert.equal(areDepsStale(root), false);
  touch(path.join(root, 'bun.lock'), 1_000_000);
  assert.equal(findDependencies(root), null);
});

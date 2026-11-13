import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { detectPackageManager, findDependencies } from './package-manager';

function makeFolder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-package-manager-'));
}

test('a workspace member uses the lockfile at the root of its git checkout', () => {
  const root = makeFolder();
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), '');
  const member = path.join(root, 'packages', 'agents');
  fs.mkdirSync(member, { recursive: true });
  assert.deepEqual(findDependencies(member)?.root, root);
  assert.equal(findDependencies(member)?.manager.command, 'pnpm');
});

test('a lockfile outside the git checkout of the project is ignored', () => {
  const root = makeFolder();
  fs.writeFileSync(path.join(root, 'package-lock.json'), '');
  const project = path.join(root, 'project');
  fs.mkdirSync(project);
  assert.equal(findDependencies(project), null);
});

test('finds the package manager from the user agent it sets', () => {
  const detect = (userAgent: string): string => detectPackageManager(userAgent).command;
  assert.equal(detect('npm/11.4.2 node/v24.1.0 darwin arm64 workspaces/false'), 'npm');
  assert.equal(detect('pnpm/11.0.9 npm/? node/v24.1.0 darwin arm64'), 'pnpm');
  assert.equal(detect('yarn/4.9.1 npm/? node/v24.1.0 darwin arm64'), 'yarn');
});

test('falls back to npm when the user agent is unknown or missing', () => {
  assert.equal(detectPackageManager('bun/1.3.0 npm/? node/v24.1.0').command, 'npm');
  assert.equal(detectPackageManager('cnpm/9.0.0 node/v24.1.0').command, 'npm');
  assert.equal(detectPackageManager('').command, 'npm');
  assert.equal(detectPackageManager(undefined).command, 'npm');
});

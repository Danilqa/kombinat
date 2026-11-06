import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { findPackageLink, findProjectRoot, PACKAGE_NAME } from './config';

function makeProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-config-'));
  const project = path.join(root, 'project');
  fs.mkdirSync(path.join(project, 'routines'), { recursive: true });
  fs.writeFileSync(path.join(project, 'package.json'), '{}');
  return project;
}

test('the project is the closest folder with a package.json', () => {
  const project = makeProject();
  assert.equal(findProjectRoot(project), project);
  assert.equal(findProjectRoot(path.join(project, 'routines')), project);
});

test('without a package.json the project is the folder kombinat runs in', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-config-'));
  assert.equal(findProjectRoot(dir), dir);
});

test('finds the closest node_modules copy of the package, also in a parent folder', () => {
  const project = makeProject();
  assert.equal(findPackageLink(project), null);
  const link = path.join(path.dirname(project), 'node_modules', PACKAGE_NAME);
  fs.mkdirSync(link, { recursive: true });
  assert.equal(findPackageLink(project), link);
  const own = path.join(project, 'node_modules', PACKAGE_NAME);
  fs.mkdirSync(own, { recursive: true });
  assert.equal(findPackageLink(project), own);
});

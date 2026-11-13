import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  detectPackageManager,
  formatCommand,
  getInstallCommand,
  getKombinatCommand,
} from './package-manager';

const SPEC = '@danilqa/kombinat@^1.2.3';

test('finds the package manager from the user agent it sets', () => {
  const detect = (userAgent: string | undefined): string => detectPackageManager(userAgent).name;
  assert.equal(detect('npm/11.4.2 node/v24.1.0 darwin arm64 workspaces/false'), 'npm');
  assert.equal(detect('pnpm/11.0.9 npm/? node/v24.1.0 darwin arm64'), 'pnpm');
  assert.equal(detect('yarn/4.9.1 npm/? node/v24.1.0 darwin arm64'), 'yarn');
  assert.equal(detect('bun/1.3.0 npm/? node/v24.1.0 darwin arm64'), 'bun');
});

test('falls back to npm when the user agent is unknown or missing', () => {
  assert.equal(detectPackageManager('cnpm/9.0.0 node/v24.1.0').name, 'npm');
  assert.equal(detectPackageManager('').name, 'npm');
  assert.equal(detectPackageManager(undefined).name, 'npm');
});

test('gives each package manager its install, add and run commands', () => {
  const commands = ['npm/11', 'pnpm/11', 'yarn/4', 'bun/1', 'unknown/1'].map(userAgent => {
    const manager = detectPackageManager(userAgent);
    return [
      formatCommand(getInstallCommand(manager, null)),
      formatCommand(getInstallCommand(manager, SPEC)),
      getKombinatCommand(manager),
    ];
  });
  assert.deepEqual(commands, [
    ['npm install', "npm install '@danilqa/kombinat@^1.2.3'", 'npx kombinat'],
    ['pnpm install', "pnpm add '@danilqa/kombinat@^1.2.3'", 'pnpm kombinat'],
    ['yarn install', "yarn add '@danilqa/kombinat@^1.2.3'", 'yarn kombinat'],
    ['bun install', "bun add '@danilqa/kombinat@^1.2.3'", 'bunx kombinat'],
    ['npm install', "npm install '@danilqa/kombinat@^1.2.3'", 'npx kombinat'],
  ]);
});

test('passes the package spec to the package manager unquoted', () => {
  assert.deepEqual(getInstallCommand(detectPackageManager('pnpm/11'), SPEC), {
    command: 'pnpm',
    args: ['add', SPEC],
  });
});

test('quotes only the arguments a shell would change', () => {
  assert.equal(
    formatCommand({ command: 'cd', args: ["my routines/it's"] }),
    String.raw`cd 'my routines/it'\''s'`,
  );
  assert.equal(formatCommand({ command: 'cd', args: ['../a/b-c_d.e'] }), 'cd ../a/b-c_d.e');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectPackageManager } from '../../utils/package-manager';
import { formatCommand, getInstallCommand, getKombinatCommand } from './commands';

const SPEC = '@danilqa/kombinat@^1.2.3';

test('gives each package manager its install, add and run commands', () => {
  const commands = ['npm/11', 'pnpm/11', 'yarn/4', 'unknown/1'].map(userAgent => {
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

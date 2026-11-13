import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { loadRoutines } from '../../domains/routine/storage';
import { renderRoutinesTable, updateReadme } from '../readme/readme';
import { formatInitSummary, initFolder } from './init';
import type { InitOptions } from './init';
import { detectPackageManager } from './package-manager';
import type { PackageManager, ShellCommand } from './package-manager';
import { ROUTINE_TEMPLATES } from './templates';

const ROUTINE_FILES = [
  'hello-example-routine.md',
  'weather-example-routine.md',
  'weather-webhook-example-routine.md',
];

interface InstallCall {
  command: ShellCommand;
  cwd: string;
}

interface Recorder {
  calls: InstallCall[];
  options: InitOptions;
}

function makeFolder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-init-'));
}

function record(overrides: Partial<InitOptions> = {}): Recorder {
  const calls: InstallCall[] = [];
  return {
    calls,
    options: {
      install: true,
      version: '1.2.3',
      userAgentManager: detectPackageManager('npm/11.4.2 node/v24.1.0'),
      runInstall: (command, cwd) => {
        calls.push({ command, cwd });
        return null;
      },
      log: () => undefined,
      ...overrides,
    },
  };
}

const noInstall = (): InitOptions => record({ install: false }).options;

function readTree(root: string): Record<string, string> {
  const tree: Record<string, string> = {};
  for (const entry of fs.readdirSync(root, { recursive: true, encoding: 'utf8' }).sort()) {
    const file = path.join(root, entry);
    const stat = fs.statSync(file);
    tree[entry] = stat.isDirectory() ? `dir ${stat.mtimeMs}` : fs.readFileSync(file, 'utf8');
  }
  return tree;
}

const writeRoutine = (folder: string, name: string): void => {
  fs.mkdirSync(path.join(folder, 'routines'), { recursive: true });
  fs.writeFileSync(
    path.join(folder, 'routines', `${name}.md`),
    `---\nname: ${name}\ndescription: Mine\nschedule: manual\ncwd: ~/\n---\nDo it\n`,
  );
};

test('fills an empty folder with package.json, example routines, a README and .gitignore', () => {
  const folder = makeFolder();
  const result = initFolder(folder, noInstall());

  assert.deepEqual(result.created, [
    'package.json',
    ...ROUTINE_FILES.map(file => `routines/${file}`),
    'README.md',
    '.gitignore',
  ]);
  assert.deepEqual(result.kept, []);
  assert.equal(
    fs.readFileSync(path.join(folder, 'package.json'), 'utf8'),
    '{\n  "private": true,\n  "dependencies": {\n    "@danilqa/kombinat": "^1.2.3"\n  }\n}\n',
  );
  assert.deepEqual(fs.readdirSync(path.join(folder, 'routines')).sort(), ROUTINE_FILES);
  for (const template of ROUTINE_TEMPLATES) {
    assert.equal(
      fs.readFileSync(path.join(folder, 'routines', `${template.name}.md`), 'utf8'),
      template.source,
    );
  }
  assert.equal(fs.readFileSync(path.join(folder, '.gitignore'), 'utf8'), 'node_modules\n');
  assert.equal(loadRoutines(path.join(folder, 'routines')).length, 3);
});

test('creates a folder that does not exist yet', () => {
  const folder = path.join(makeFolder(), 'nested', 'my-routines');
  const result = initFolder(folder, noInstall());
  assert.equal(result.created.length, 6);
  assert.equal(fs.existsSync(path.join(folder, 'routines', 'hello-example-routine.md')), true);
  assert.match(fs.readFileSync(path.join(folder, 'README.md'), 'utf8'), /^# my-routines\n/);
});

test('refuses a path that is a file', () => {
  const file = path.join(makeFolder(), 'notes.txt');
  fs.writeFileSync(file, 'x');
  assert.throws(() => initFolder(file, noInstall()), /is not a folder/);
});

test('the README table is what kombinat readme renders, so readme keeps it as it is', () => {
  const folder = makeFolder();
  initFolder(folder, noInstall());
  const readme = path.join(folder, 'README.md');
  const routines = path.join(folder, 'routines');
  const source = fs.readFileSync(readme, 'utf8');
  assert.equal(source.includes(renderRoutinesTable(routines)), true);
  assert.equal(
    renderRoutinesTable(routines)
      .split('\n')
      .filter(line => line.startsWith('| [')).length,
    3,
  );
  assert.equal(updateReadme(readme, routines), false);
  assert.equal(fs.readFileSync(readme, 'utf8'), source);
});

test('the README and the summary use the command prefix of the package manager', () => {
  const folder = makeFolder();
  const result = initFolder(folder, {
    ...noInstall(),
    userAgentManager: detectPackageManager('pnpm/11.0.9'),
  });
  const readme = fs.readFileSync(path.join(folder, 'README.md'), 'utf8');
  assert.equal(readme.includes('`pnpm kombinat serve`'), true);
  assert.equal(readme.includes('npx'), false);
  const summary = formatInitSummary(result, path.dirname(folder));
  assert.equal(summary.includes(`  cd ${path.basename(folder)}\n`), true);
  assert.equal(summary.includes('  pnpm install'), true);
  assert.equal(summary.includes('  pnpm kombinat run hello-example-routine'), true);
  assert.equal(summary.includes('  pnpm kombinat serve'), true);
  assert.equal(summary.includes('  pnpm kombinat install'), true);
});

test('a fresh package.json gets a plain install in the folder', () => {
  const folder = makeFolder();
  const { calls, options } = record();
  const result = initFolder(folder, options);
  assert.deepEqual(calls, [{ command: { command: 'npm', args: ['install'] }, cwd: folder }]);
  assert.equal(result.install.status, 'installed');
  assert.match(formatInitSummary(result, folder), /Ran npm install\./);
});

test('--no-install runs nothing and lists the install among the next commands', () => {
  const folder = makeFolder();
  const { calls, options } = record({ install: false });
  const result = initFolder(folder, options);
  assert.deepEqual(calls, []);
  assert.equal(result.install.status, 'skipped');
  const summary = formatInitSummary(result, folder);
  assert.equal(summary.includes('cd '), false);
  assert.match(summary, /Next:\n {2}npm install +# /);
});

test('an existing package.json stays byte-identical and gets the add command', () => {
  const folder = makeFolder();
  const packageJson = '{"name":"app","dependencies":{"left-pad":"1.0.0"}}';
  fs.writeFileSync(path.join(folder, 'package.json'), packageJson);
  const { calls, options } = record();
  const result = initFolder(folder, options);
  assert.equal(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'), packageJson);
  assert.deepEqual(result.kept, ['package.json']);
  assert.deepEqual(calls, [
    { command: { command: 'npm', args: ['install', '@danilqa/kombinat@^1.2.3'] }, cwd: folder },
  ]);
  const summary = formatInitSummary(result, folder);
  assert.match(summary, /Left as they are:\n {2}package\.json\n/);
  assert.match(summary, /Ran npm install '@danilqa\/kombinat@\^1\.2\.3'\./);
});

test('a package.json that lists kombinat gets a plain install until it is installed', () => {
  const folder = makeFolder();
  fs.writeFileSync(
    path.join(folder, 'package.json'),
    '{"devDependencies":{"@danilqa/kombinat":"^0.1.0"}}',
  );
  const first = record();
  initFolder(folder, first.options);
  assert.deepEqual(first.calls, [{ command: { command: 'npm', args: ['install'] }, cwd: folder }]);

  fs.mkdirSync(path.join(folder, 'node_modules', '@danilqa', 'kombinat'), { recursive: true });
  const second = record();
  const result = initFolder(folder, second.options);
  assert.deepEqual(second.calls, []);
  assert.equal(result.install.status, 'already_installed');
});

test('a failed install keeps the files and gives the command to run by hand', () => {
  const folder = makeFolder();
  const result = initFolder(folder, {
    ...noInstall(),
    install: true,
    runInstall: () => 'npm install stopped with exit code 1',
  });
  assert.equal(result.install.status, 'failed');
  assert.equal(fs.existsSync(path.join(folder, 'package.json')), true);
  assert.equal(fs.existsSync(path.join(folder, 'routines', 'hello-example-routine.md')), true);
  const summary = formatInitSummary(result, folder);
  assert.match(
    summary,
    /The install failed: npm install stopped with exit code 1\. Run it by hand: npm install\n/,
  );
  assert.match(summary, /Next:\n {2}npm install +# /);
});

test('existing routines are left alone and the README lists them', () => {
  const folder = makeFolder();
  writeRoutine(folder, 'my-routine');
  const result = initFolder(folder, noInstall());
  assert.deepEqual(fs.readdirSync(path.join(folder, 'routines')), ['my-routine.md']);
  assert.deepEqual(result.kept, ['routines/']);
  const readme = fs.readFileSync(path.join(folder, 'README.md'), 'utf8');
  assert.equal(readme.includes('[my-routine](routines/my-routine.md)'), true);
  assert.equal(readme.includes('hello-example-routine'), false);
  const summary = formatInitSummary(result, folder);
  assert.equal(summary.includes('run hello-example-routine'), false);
  assert.equal(summary.includes('  npx kombinat list'), true);
});

test('a routines folder without routines gets the examples', () => {
  const folder = makeFolder();
  fs.mkdirSync(path.join(folder, 'routines'));
  fs.writeFileSync(path.join(folder, 'routines', 'notes.txt'), 'x');
  initFolder(folder, noInstall());
  assert.deepEqual(
    fs.readdirSync(path.join(folder, 'routines')).sort(),
    [...ROUTINE_FILES, 'notes.txt'].sort(),
  );
});

test('an existing README and .gitignore are left alone', () => {
  const folder = makeFolder();
  fs.writeFileSync(path.join(folder, 'README.md'), '# Mine\n');
  fs.writeFileSync(path.join(folder, '.gitignore'), 'dist\n');
  const result = initFolder(folder, noInstall());
  assert.deepEqual(result.kept, ['README.md', '.gitignore']);
  assert.equal(fs.readFileSync(path.join(folder, 'README.md'), 'utf8'), '# Mine\n');
  assert.equal(fs.readFileSync(path.join(folder, '.gitignore'), 'utf8'), 'dist\n');
});

test('a broken routine stops init before it writes anything', () => {
  const folder = makeFolder();
  fs.mkdirSync(path.join(folder, 'routines'));
  fs.writeFileSync(path.join(folder, 'routines', 'broken.md'), 'no frontmatter');
  assert.throws(() => initFolder(folder, noInstall()), /YAML frontmatter/);
  assert.deepEqual(fs.readdirSync(folder), ['routines']);
});

test('a second run changes nothing and says so', () => {
  const folder = makeFolder();
  initFolder(folder, noInstall());
  fs.mkdirSync(path.join(folder, 'node_modules', '@danilqa', 'kombinat'), { recursive: true });
  const before = readTree(folder);
  const { calls, options } = record();
  const result = initFolder(folder, options);
  assert.deepEqual(readTree(folder), before);
  assert.deepEqual(calls, []);
  assert.deepEqual(result.created, []);
  assert.deepEqual(result.kept, ['package.json', 'routines/', 'README.md', '.gitignore']);
  assert.match(formatInitSummary(result, folder), /^Nothing changed: /);
});

const pnpmUserAgent = (): PackageManager => detectPackageManager('pnpm/11.0.9 node/v24.1.0');

function makeProject(lockfile: string | null): string {
  const folder = makeFolder();
  fs.writeFileSync(path.join(folder, 'package.json'), '{"name":"app"}');
  if (lockfile !== null) fs.writeFileSync(path.join(folder, lockfile), '');
  return folder;
}

test('an existing project with pnpm-lock.yaml uses pnpm, whatever the user agent says', () => {
  const folder = makeProject('pnpm-lock.yaml');
  const { calls, options } = record();
  const result = initFolder(folder, options);
  assert.deepEqual(calls, [
    { command: { command: 'pnpm', args: ['add', '@danilqa/kombinat@^1.2.3'] }, cwd: folder },
  ]);
  assert.equal(result.manager.name, 'pnpm');
  const readme = fs.readFileSync(path.join(folder, 'README.md'), 'utf8');
  assert.equal(readme.includes('`pnpm kombinat serve`'), true);
  const summary = formatInitSummary(result, folder);
  assert.equal(summary.includes('  pnpm kombinat run hello-example-routine'), true);
  assert.equal(summary.includes('npx'), false);
});

test('an existing project with yarn.lock uses yarn, whatever the user agent says', () => {
  const folder = makeProject('yarn.lock');
  const { calls, options } = record();
  const result = initFolder(folder, options);
  assert.deepEqual(calls, [
    { command: { command: 'yarn', args: ['add', '@danilqa/kombinat@^1.2.3'] }, cwd: folder },
  ]);
  assert.equal(formatInitSummary(result, folder).includes('  yarn kombinat serve'), true);
});

test('an existing project with package-lock.json uses npm, even when pnpm started init', () => {
  const folder = makeProject('package-lock.json');
  const { calls, options } = record({ userAgentManager: pnpmUserAgent() });
  const result = initFolder(folder, options);
  assert.deepEqual(calls, [
    { command: { command: 'npm', args: ['install', '@danilqa/kombinat@^1.2.3'] }, cwd: folder },
  ]);
  assert.equal(formatInitSummary(result, folder).includes('  npx kombinat serve'), true);
});

test('an existing package in a workspace uses the lockfile at the root of its git checkout', () => {
  const root = makeFolder();
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), '');
  const folder = path.join(root, 'packages', 'routines');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'package.json'), '{"name":"routines"}');
  const { calls, options } = record();
  initFolder(folder, options);
  assert.deepEqual(calls, [
    { command: { command: 'pnpm', args: ['add', '@danilqa/kombinat@^1.2.3'] }, cwd: folder },
  ]);
});

test('a fresh folder follows the user agent, even under a checkout with a lockfile', () => {
  const root = makeFolder();
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), '');
  const folder = path.join(root, 'my-routines');
  const { calls, options } = record();
  const result = initFolder(folder, options);
  assert.deepEqual(calls, [{ command: { command: 'npm', args: ['install'] }, cwd: folder }]);
  assert.equal(result.manager.name, 'npm');
});

test('an existing project without a lockfile follows the user agent', () => {
  const folder = makeProject(null);
  const { calls, options } = record({ userAgentManager: pnpmUserAgent() });
  const result = initFolder(folder, options);
  assert.deepEqual(calls, [
    { command: { command: 'pnpm', args: ['add', '@danilqa/kombinat@^1.2.3'] }, cwd: folder },
  ]);
  assert.equal(result.manager.name, 'pnpm');
});

import fs from 'node:fs';
import path from 'node:path';

import { isMatching, match, P } from 'ts-pattern';
import { z } from 'zod';

import { config, DEFAULT_PORT, PACKAGE_NAME } from '../../config';
import { EXAMPLE_ROUTINES, HELLO_EXAMPLE_ROUTINE } from '../../domains/routine/examples';
import { listRoutineFiles, loadRoutines } from '../../domains/routine/storage';
import { readJsonFile } from '../../utils/json';
import { detectPackageManager, findDependencies } from '../../utils/package-manager';
import type { PackageManager } from '../../utils/package-manager';
import { renderRoutinesSection } from '../readme/readme';
import {
  formatCommand,
  getInstallCommand,
  getKombinatCommand,
  quoteShellArg,
  runInstall,
} from './commands';
import type { Installer, ShellCommand } from './commands';

export interface InitOptions {
  install: boolean;
  version: string | undefined;
  userAgentManager: PackageManager;
  runInstall: Installer;
  log: (line: string) => void;
}

interface InstallDone {
  status: 'installed';
  command: ShellCommand;
}

interface InstallSkipped {
  status: 'skipped';
  command: ShellCommand;
}

interface InstallFailed {
  status: 'failed';
  command: ShellCommand;
  error: string;
}

interface InstallNotNeeded {
  status: 'already_installed';
}

export type InstallStep = InstallDone | InstallSkipped | InstallFailed | InstallNotNeeded;

export interface InitResult {
  folder: string;
  manager: PackageManager;
  created: string[];
  kept: string[];
  hasHelloRoutine: boolean;
  install: InstallStep;
}

const dependenciesSchema = z.record(z.string(), z.unknown()).optional();

const packageJsonSchema = z.object({
  dependencies: dependenciesSchema,
  devDependencies: dependenciesSchema,
});

function checkListsKombinat(file: string): boolean {
  const manifest = readJsonFile(file, packageJsonSchema);
  return [manifest?.dependencies, manifest?.devDependencies].some(
    dependencies => dependencies !== undefined && PACKAGE_NAME in dependencies,
  );
}

const getVersionRange = (version: string | undefined): string =>
  version === undefined ? 'latest' : `^${version}`;

const renderPackageJson = (version: string | undefined): string =>
  `${JSON.stringify(
    { private: true, dependencies: { [PACKAGE_NAME]: getVersionRange(version) } },
    null,
    2,
  )}\n`;

function renderReadme(folder: string, manager: PackageManager): string {
  const kombinat = getKombinatCommand(manager);
  return [
    `# ${path.basename(folder)}`,
    '',
    'Routines that [Kombinat](https://github.com/Danilqa/kombinat) runs with AI agents, one file each in `routines/`.',
    '',
    `Run \`${kombinat} serve\` and open http://localhost:${DEFAULT_PORT}, or \`${kombinat} install\` to keep it running in the background. \`${kombinat} readme\` updates this table.`,
    '',
    '<!-- prettier-ignore-start -->',
    renderRoutinesSection(path.join(folder, 'routines')),
    '<!-- prettier-ignore-end -->',
    '',
  ].join('\n');
}

// Like the daemon, which installs with the manager of the lockfile it finds.
function chooseManager(
  folder: string,
  hadPackageJson: boolean,
  options: InitOptions,
): PackageManager {
  const dependencies = hadPackageJson ? findDependencies(folder) : null;
  return dependencies?.manager ?? options.userAgentManager;
}

function planInstall(
  folder: string,
  hadPackageJson: boolean,
  manager: PackageManager,
  version: string | undefined,
): ShellCommand | null {
  if (!hadPackageJson) return getInstallCommand(manager, null);
  if (!checkListsKombinat(path.join(folder, 'package.json'))) {
    return getInstallCommand(manager, `${PACKAGE_NAME}@${getVersionRange(version)}`);
  }
  if (fs.existsSync(path.join(folder, 'node_modules', PACKAGE_NAME))) return null;
  return getInstallCommand(manager, null);
}

function install(
  folder: string,
  hadPackageJson: boolean,
  manager: PackageManager,
  options: InitOptions,
): InstallStep {
  const command = planInstall(folder, hadPackageJson, manager, options.version);
  if (command === null) return { status: 'already_installed' };
  if (!options.install) return { status: 'skipped', command };
  options.log(`Running ${formatCommand(command)} in ${folder}`);
  const error = options.runInstall(command, folder);
  options.log('');
  return error === null ? { status: 'installed', command } : { status: 'failed', command, error };
}

export function initFolder(folder: string, options: InitOptions): InitResult {
  if (fs.existsSync(folder) && !fs.statSync(folder).isDirectory()) {
    throw new Error(`${folder} is not a folder`);
  }
  const routinesDir = path.join(folder, 'routines');
  const hasRoutines = listRoutineFiles(routinesDir).length > 0;
  const readme = path.join(folder, 'README.md');
  // The README lists the routines, so a broken one fails here, before anything is written.
  if (hasRoutines && !fs.existsSync(readme)) loadRoutines(routinesDir);

  const created: string[] = [];
  const kept: string[] = [];
  const writeIfMissing = (name: string, render: () => string): void => {
    const file = path.join(folder, name);
    if (fs.existsSync(file)) {
      kept.push(name);
      return;
    }
    fs.writeFileSync(file, render(), { flag: 'wx' });
    created.push(name);
  };

  const hadPackageJson = fs.existsSync(path.join(folder, 'package.json'));
  const manager = chooseManager(folder, hadPackageJson, options);
  fs.mkdirSync(folder, { recursive: true });
  writeIfMissing('package.json', () => renderPackageJson(options.version));
  if (hasRoutines) {
    kept.push('routines/');
  } else {
    fs.mkdirSync(routinesDir, { recursive: true });
    for (const example of EXAMPLE_ROUTINES) {
      writeIfMissing(`routines/${example.name}.md`, () => example.source);
    }
  }
  writeIfMissing('README.md', () => renderReadme(folder, manager));
  writeIfMissing('.gitignore', () => 'node_modules\n');

  return {
    folder,
    manager,
    created,
    kept,
    hasHelloRoutine: fs.existsSync(path.join(routinesDir, `${HELLO_EXAMPLE_ROUTINE}.md`)),
    install: install(folder, hadPackageJson, manager, options),
  };
}

function getFolderArg(folder: string, cwd: string): string | null {
  const relative = path.relative(cwd, folder);
  if (relative === '') return null;
  return relative.split(path.sep)[0] === '..' ? folder : relative;
}

interface NextStep {
  command: string;
  note: string | null;
}

function getNextSteps(result: InitResult, folderArg: string | null): NextStep[] {
  const kombinat = getKombinatCommand(result.manager);
  const steps: NextStep[] = [];
  if (folderArg !== null) steps.push({ command: `cd ${quoteShellArg(folderArg)}`, note: null });
  if (isMatching({ status: P.union('skipped', 'failed') }, result.install)) {
    steps.push({
      command: formatCommand(result.install.command),
      note: 'install the dependencies',
    });
  }
  steps.push(
    result.hasHelloRoutine
      ? {
          command: `${kombinat} run ${HELLO_EXAMPLE_ROUTINE}`,
          note: 'try a routine now, in this terminal',
        }
      : { command: `${kombinat} list`, note: 'see your routines' },
    {
      command: `${kombinat} serve`,
      note: `scheduler and dashboard at http://localhost:${DEFAULT_PORT}`,
    },
    { command: `${kombinat} install`, note: 'or keep it running in the background' },
  );
  return steps;
}

function formatNextSteps(steps: NextStep[]): string[] {
  const width = Math.max(...steps.map(step => step.command.length));
  return steps.map(({ command, note }) =>
    note === null ? `  ${command}` : `  ${command.padEnd(width)}   # ${note}`,
  );
}

function formatAnd(items: string[]): string {
  return items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

const formatList = (items: string[]): string[] => items.map(item => `  ${item}`);

function formatFiles(result: InitResult, where: string): string[] {
  if (result.created.length === 0) {
    const isUnchanged = isMatching(
      { status: P.union('already_installed', 'skipped') },
      result.install,
    );
    const prefix = isUnchanged ? 'Nothing changed: ' : '';
    return [`${prefix}${formatAnd(result.kept)} are already in ${where}.`];
  }
  const kept = result.kept.length === 0 ? [] : ['Left as they are:', ...formatList(result.kept)];
  return [`Created in ${where}:`, ...formatList(result.created), ...kept];
}

export function formatInitSummary(result: InitResult, cwd = process.cwd()): string {
  const folderArg = getFolderArg(result.folder, cwd);
  const install = match(result.install)
    .with({ status: 'installed' }, step => [`Ran ${formatCommand(step.command)}.`])
    .with({ status: 'failed' }, step => [
      `The install failed: ${step.error}. Run it by hand: ${formatCommand(step.command)}`,
    ])
    .with({ status: 'already_installed' }, () => [`${PACKAGE_NAME} is already installed.`])
    .with({ status: 'skipped' }, () => [])
    .exhaustive();
  return [
    ...formatFiles(result, folderArg ?? 'the current folder'),
    ...install,
    '',
    'Next:',
    ...formatNextSteps(getNextSteps(result, folderArg)),
  ].join('\n');
}

export function runInit(folderArg: string | undefined, shouldInstall: boolean): boolean {
  const result = initFolder(path.resolve(folderArg ?? '.'), {
    install: shouldInstall,
    version: config.version,
    userAgentManager: detectPackageManager(process.env['npm_config_user_agent']),
    runInstall,
    log: line => console.log(line),
  });
  console.log(formatInitSummary(result));
  return !isMatching({ status: 'failed' }, result.install);
}

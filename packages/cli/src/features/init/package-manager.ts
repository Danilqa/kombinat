import { spawnSync } from 'node:child_process';

export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface PackageManager {
  name: PackageManagerName;
  add: string;
  exec: string;
}

export interface ShellCommand {
  command: string;
  args: string[];
}

export type Installer = (command: ShellCommand, cwd: string) => string | null;

const NPM: PackageManager = { name: 'npm', add: 'install', exec: 'npx' };

const PACKAGE_MANAGERS: PackageManager[] = [
  NPM,
  { name: 'pnpm', add: 'add', exec: 'pnpm' },
  { name: 'yarn', add: 'add', exec: 'yarn' },
  { name: 'bun', add: 'add', exec: 'bunx' },
];

export function findPackageManager(name: string | undefined): PackageManager | null {
  return PACKAGE_MANAGERS.find(manager => manager.name === name) ?? null;
}

export function detectPackageManager(userAgent: string | undefined): PackageManager {
  return findPackageManager(userAgent?.split('/')[0]) ?? NPM;
}

export function getInstallCommand(
  manager: PackageManager,
  packageSpec: string | null,
): ShellCommand {
  return {
    command: manager.name,
    args: packageSpec === null ? ['install'] : [manager.add, packageSpec],
  };
}

export const getKombinatCommand = (manager: PackageManager): string => `${manager.exec} kombinat`;

export function quoteShellArg(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", String.raw`'\''`)}'`;
}

export const formatCommand = ({ command, args }: ShellCommand): string =>
  [command, ...args].map(quoteShellArg).join(' ');

export function runInstall(shellCommand: ShellCommand, cwd: string): string | null {
  const result = spawnSync(shellCommand.command, shellCommand.args, { cwd, stdio: 'inherit' });
  if (result.error !== undefined) return result.error.message;
  if (result.status === 0) return null;
  const reason =
    result.signal === null ? `exit code ${String(result.status)}` : `signal ${result.signal}`;
  return `${formatCommand(shellCommand)} stopped with ${reason}`;
}

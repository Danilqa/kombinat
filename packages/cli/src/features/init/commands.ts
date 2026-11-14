import { spawnSync } from 'node:child_process';

import type { PackageManager } from '../../utils/package-manager';

export interface ShellCommand {
  command: string;
  args: string[];
}

export type Installer = (command: ShellCommand, cwd: string) => string | null;

export function getInstallCommand(
  manager: PackageManager,
  packageSpec: string | null,
): ShellCommand {
  return {
    command: manager.command,
    args: packageSpec === null ? ['install'] : [manager.add, packageSpec],
  };
}

export const getKombinatCommand = (manager: PackageManager): string => `${manager.runner} kombinat`;

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

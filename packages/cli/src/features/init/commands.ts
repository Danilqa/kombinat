import { spawnSync } from 'node:child_process';

import type { PackageManager } from '../../utils/package-manager';

export interface InstallCommand {
  command: string;
  args: string[];
}

export type Installer = (command: InstallCommand, cwd: string) => string | null;

export function getInstallCommand(
  manager: PackageManager,
  packageSpec: string | null,
): InstallCommand {
  return {
    command: manager.command,
    args: packageSpec === null ? ['install'] : [manager.add, manager.exact, packageSpec],
  };
}

export const getKombinatCommand = (manager: PackageManager): string => `${manager.runner} kombinat`;

export function quoteShellArg(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", String.raw`'\''`)}'`;
}

export const formatCommand = ({ command, args }: InstallCommand): string =>
  [command, ...args].map(quoteShellArg).join(' ');

export function runInstall(installCommand: InstallCommand, cwd: string): string | null {
  const result = spawnSync(installCommand.command, installCommand.args, { cwd, stdio: 'inherit' });
  if (result.error !== undefined) return result.error.message;
  if (result.status === 0) return null;
  const reason =
    result.signal === null ? `exit code ${String(result.status)}` : `signal ${result.signal}`;
  return `${formatCommand(installCommand)} stopped with ${reason}`;
}

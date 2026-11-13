import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { isMatching } from 'ts-pattern';

import { getErrorMessage } from 'utils/error';

import { config, getCliArgs } from '../../config';
import { buildDaemonEnv, ensureInstallable } from '../service/daemon';

const UNIT_NAME = 'kombinat.service';
const RUNNING_STATES = ['active', 'activating', 'reloading', 'deactivating'];
const LINUX_DOC = 'https://github.com/Danilqa/kombinat/blob/main/docs/linux.md';

export function getUnitPath(source: NodeJS.ProcessEnv = process.env): string {
  const configHome = source['XDG_CONFIG_HOME'];
  const base =
    configHome !== undefined && path.isAbsolute(configHome)
      ? configHome
      : path.join(os.homedir(), '.config');
  return path.join(base, 'systemd', 'user', UNIT_NAME);
}

const escapeSpecifiers = (value: string): string => value.replaceAll('%', '%%');

const escapeQuoted = (value: string): string =>
  value.replace(/[\\"]/g, '\\$&').replaceAll('\n', '\\n');

export function quoteExecArg(value: string): string {
  return `"${escapeSpecifiers(escapeQuoted(value)).replaceAll('$', () => '$$')}"`;
}

// Environment= does not expand $, so only ExecStart escapes it.
export function quoteEnvAssignment(key: string, value: string): string {
  return `"${escapeSpecifiers(escapeQuoted(`${key}=${value}`))}"`;
}

export function escapeUnitPath(value: string): string {
  if (value.includes('\n')) throw new Error(`${value} has a line break, which a unit cannot hold`);
  return escapeSpecifiers(value);
}

export function renderUnit(env: Record<string, string> = buildDaemonEnv()): string {
  const exec = [process.execPath, ...getCliArgs('serve')].map(quoteExecArg).join(' ');
  const environment = Object.entries(env)
    .map(([key, value]) => `Environment=${quoteEnvAssignment(key, value)}`)
    .join('\n');
  return `[Unit]
Description=Kombinat daemon

[Service]
ExecStart=${exec}
WorkingDirectory=${escapeUnitPath(config.projectRoot)}
${environment}
Restart=always
RestartSec=10
KillMode=process
StandardOutput=append:${escapeUnitPath(path.join(config.stateDir, 'daemon.log'))}
StandardError=append:${escapeUnitPath(path.join(config.stateDir, 'daemon.err'))}

[Install]
WantedBy=default.target
`;
}

export function readWorkingDirectory(unit: string): string | null {
  const folder = /^WorkingDirectory=(?<folder>.*)$/m.exec(unit)?.groups?.['folder'];
  return folder === undefined ? null : folder.replaceAll('%%', '%');
}

function parseProperties(output: string): Record<string, string> {
  return Object.fromEntries(
    output
      .split('\n')
      .filter(line => line.includes('='))
      .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

export function formatSystemdStatus(show: string): string {
  const properties = parseProperties(show);
  if (properties['LoadState'] !== 'loaded') return 'not loaded';
  const pid = properties['MainPID'] ?? '0';
  return [
    `active state = ${properties['ActiveState'] ?? '-'}`,
    `sub state = ${properties['SubState'] ?? '-'}`,
    ...(pid === '0' ? [] : [`main pid = ${pid}`]),
    `restarts = ${properties['NRestarts'] ?? '-'}`,
  ].join('\n');
}

export function checkIsLingerEnabled(showUser: string): boolean {
  return parseProperties(showUser)['Linger'] === 'yes';
}

function runSystemctl(args: string[]): string {
  return execFileSync('systemctl', ['--user', ...args], { stdio: 'pipe', encoding: 'utf8' });
}

function runSystemctlQuietly(args: string[]): void {
  try {
    runSystemctl(args);
  } catch {
    // A unit that is not loaded or not enabled has nothing to stop or disable.
  }
}

function showUnit(): string {
  try {
    return runSystemctl([
      'show',
      UNIT_NAME,
      '--property=LoadState,ActiveState,SubState,MainPID,NRestarts',
    ]);
  } catch {
    return '';
  }
}

function findSystemdProblem(): string | null {
  try {
    runSystemctl(['show-environment']);
    return null;
  } catch (err) {
    if (isMatching({ code: 'ENOENT' }, err)) return 'systemctl is not installed';
    const lines = getErrorMessage(err)
      .split('\n')
      .filter(line => line.trim());
    return lines.at(-1) ?? 'systemctl --user failed';
  }
}

export function checkIsSystemdLoaded(): boolean {
  const properties = parseProperties(showUnit());
  return (
    properties['LoadState'] === 'loaded' && RUNNING_STATES.includes(properties['ActiveState'] ?? '')
  );
}

export function stopSystemd(): void {
  runSystemctlQuietly(['stop', UNIT_NAME]);
}

export function startSystemd(): void {
  if (!fs.existsSync(getUnitPath()))
    throw new Error(`${getUnitPath()} is missing, run install first`);
  runSystemctl(['start', UNIT_NAME]);
}

export function install(): string {
  ensureInstallable();
  const problem = findSystemdProblem();
  if (problem !== null) {
    throw new Error(
      `install needs systemd user services, which are not available here (${problem}). Run kombinat serve under your own supervisor instead, see ${LINUX_DOC}`,
    );
  }
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.mkdirSync(path.dirname(getUnitPath()), { recursive: true });
  fs.writeFileSync(getUnitPath(), renderUnit());
  runSystemctl(['daemon-reload']);
  runSystemctl(['enable', UNIT_NAME]);
  runSystemctl(['restart', UNIT_NAME]);
  return getUnitPath();
}

export function getLingerHint(): string | null {
  const user = os.userInfo().username;
  let showUser = '';
  try {
    showUser = execFileSync('loginctl', ['show-user', user, '--property=Linger'], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch {
    // loginctl fails for a user with no session and no lingering.
  }
  if (checkIsLingerEnabled(showUser)) return null;
  return `lingering is off, so the daemon stops when you log out. To keep it running after you log out and start it at boot, run: sudo loginctl enable-linger ${user}`;
}

export function getDaemonFolder(): string | null {
  if (!fs.existsSync(getUnitPath())) return null;
  return readWorkingDirectory(fs.readFileSync(getUnitPath(), 'utf8'));
}

export function uninstall(): string {
  runSystemctlQuietly(['disable', '--now', UNIT_NAME]);
  if (fs.existsSync(getUnitPath())) fs.unlinkSync(getUnitPath());
  runSystemctlQuietly(['daemon-reload']);
  return getUnitPath();
}

export function getSystemdStatus(): string {
  return formatSystemdStatus(showUnit());
}

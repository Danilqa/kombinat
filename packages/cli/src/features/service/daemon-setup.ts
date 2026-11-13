import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { config, PACKAGE_NAME } from '../../config';

export interface InstallResult {
  file: string;
  hint: string | null;
}

const PASSED_ENV = [/^KOMBINAT_/, /^CLAUDE_BIN$/, /^CODEX_BIN$/];

export function buildDaemonPath(current = process.env['PATH'] ?? ''): string {
  const base = [
    path.dirname(process.execPath),
    path.join(os.homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const inherited = current
    .split(':')
    .filter(entry => entry && !entry.includes('/.claude/plugins/') && !entry.includes('cryptexd'));
  return [...new Set([...base, ...inherited])].join(':');
}

export function buildDaemonEnv(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const passed = Object.entries(source).filter(
    (entry): entry is [string, string] =>
      PASSED_ENV.some(pattern => pattern.test(entry[0])) && entry[1] !== undefined,
  );
  return {
    PATH: buildDaemonPath(source['PATH'] ?? ''),
    HOME: os.homedir(),
    LANG: source['LANG'] ?? 'en_US.UTF-8',
    ...Object.fromEntries(passed),
    KOMBINAT_MANAGED: '1',
  };
}

export function ensureInstallable(): void {
  if (!config.fromSource && !config.installedInProject) {
    throw new Error(
      config.projectHasCopy
        ? `this project has its own ${PACKAGE_NAME}, install with it: pnpm kombinat install or npx kombinat install`
        : `add ${PACKAGE_NAME} to this project first: pnpm add ${PACKAGE_NAME} or npm install ${PACKAGE_NAME}`,
    );
  }
  if (!fs.existsSync(config.routinesDir)) {
    throw new Error(
      `${config.routinesDir} is missing, run install from the folder that holds routines/`,
    );
  }
}

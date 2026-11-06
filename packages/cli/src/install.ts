import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { config, getCliArgs, PACKAGE_NAME } from './config';

const plistPath = () =>
  path.join(os.homedir(), 'Library', 'LaunchAgents', `${config.launchdLabel}.plist`);
const domain = () => `gui/${os.userInfo().uid}`;

const PASSED_ENV = [/^KOMBINAT_/, /^CLAUDE_BIN$/, /^CODEX_BIN$/];

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unescapeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

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

export function renderPlist(): string {
  const passed = Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      PASSED_ENV.some(pattern => pattern.test(entry[0])) && entry[1] !== undefined,
  );
  const env: Record<string, string> = {
    PATH: buildDaemonPath(),
    HOME: os.homedir(),
    LANG: process.env['LANG'] ?? 'en_US.UTF-8',
    ...Object.fromEntries(passed),
    KOMBINAT_MANAGED: '1',
  };
  const envXml = Object.entries(env)
    .map(
      ([key, value]) =>
        `      <key>${escapeXml(key)}</key>\n      <string>${escapeXml(value)}</string>`,
    )
    .join('\n');
  const programArguments = [process.execPath, ...getCliArgs('serve')]
    .map(arg => `      <string>${escapeXml(arg)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${config.launchdLabel}</string>
    <key>ProgramArguments</key>
    <array>
${programArguments}
    </array>
    <key>WorkingDirectory</key>
    <string>${escapeXml(config.projectRoot)}</string>
    <key>EnvironmentVariables</key>
    <dict>
${envXml}
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>AbandonProcessGroup</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>${escapeXml(path.join(config.stateDir, 'daemon.log'))}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(path.join(config.stateDir, 'daemon.err'))}</string>
  </dict>
</plist>
`;
}

function runLaunchctl(args: string[], ignoreFailure = false): void {
  try {
    execFileSync('launchctl', args, { stdio: 'pipe' });
  } catch (err) {
    if (!ignoreFailure) throw err;
  }
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitUntilUnloaded(timeoutMs = 10_000): void {
  const deadline = Date.now() + timeoutMs;
  while (isLaunchdLoaded() && Date.now() < deadline) sleep(250);
}

function bootstrapWithRetry(attempts = 5): void {
  for (let i = 1; i <= attempts; i++) {
    try {
      execFileSync('launchctl', ['bootstrap', domain(), plistPath()], { stdio: 'pipe' });
      return;
    } catch (err) {
      if (i === attempts) throw err;
      sleep(1000);
    }
  }
}

export function isLaunchdLoaded(): boolean {
  try {
    execFileSync('launchctl', ['print', `${domain()}/${config.launchdLabel}`], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function stopLaunchd(): void {
  runLaunchctl(['bootout', `${domain()}/${config.launchdLabel}`], true);
  waitUntilUnloaded();
}

export function startLaunchd(): void {
  if (!fs.existsSync(plistPath())) throw new Error(`${plistPath()} is missing, run install first`);
  bootstrapWithRetry();
}

export function install(): string {
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
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.mkdirSync(path.dirname(plistPath()), { recursive: true });
  fs.writeFileSync(plistPath(), renderPlist());
  stopLaunchd();
  startLaunchd();
  return plistPath();
}

export function getDaemonFolder(): string | null {
  if (!fs.existsSync(plistPath())) return null;
  const found = /<key>WorkingDirectory<\/key>\s*<string>(?<folder>[^<]*)<\/string>/.exec(
    fs.readFileSync(plistPath(), 'utf8'),
  );
  const folder = found?.groups?.['folder'];
  return folder === undefined ? null : unescapeXml(folder);
}

export function uninstall(): string {
  stopLaunchd();
  if (fs.existsSync(plistPath())) fs.unlinkSync(plistPath());
  return plistPath();
}

export function getLaunchdStatus(): string {
  try {
    return execFileSync('launchctl', ['print', `${domain()}/${config.launchdLabel}`], {
      stdio: 'pipe',
    }).toString();
  } catch {
    return 'not loaded';
  }
}

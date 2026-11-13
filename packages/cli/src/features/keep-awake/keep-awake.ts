import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

import { match } from 'ts-pattern';

import { config } from '../../config';

type Log = (line: string) => void;

const CAFFEINATE_PATH = '/usr/bin/caffeinate';

interface KeepAwakeSettings {
  platform: NodeJS.Platform;
  managed: boolean;
  keepAwake: string | undefined;
}

export function checkIsKeepAwakeOn({ platform, managed, keepAwake }: KeepAwakeSettings): boolean {
  if (platform !== 'darwin') return false;
  return match(keepAwake)
    .with('1', () => true)
    .with('0', () => false)
    .otherwise(() => managed);
}

// -s holds only on AC power, -w ends caffeinate however the daemon exits.
export const buildCaffeinateArgs = (daemonPid: number): string[] => ['-s', '-w', String(daemonPid)];

function describeExit(code: number | null, signal: NodeJS.Signals | null): string {
  return signal === null ? `exited with code ${code}` : `was stopped by ${signal}`;
}

export function startCaffeinate(log: Log, caffeinatePath = CAFFEINATE_PATH): ChildProcess {
  let hasFailed = false;
  const fail = (reason: string): void => {
    if (hasFailed) return;
    hasFailed = true;
    log(reason);
  };
  // Its own process group, so a Ctrl-C meant for the daemon does not stop it first.
  const caffeinate = spawn(caffeinatePath, buildCaffeinateArgs(process.pid), {
    detached: true,
    stdio: 'ignore',
  });
  caffeinate.unref();
  if (caffeinate.pid !== undefined) {
    log(`keeping the Mac awake while on power, caffeinate pid ${caffeinate.pid}`);
  }
  caffeinate.on('error', error =>
    fail(`could not start caffeinate, the Mac may sleep: ${error.message}`),
  );
  caffeinate.on('exit', (code, signal) =>
    fail(`caffeinate ${describeExit(code, signal)}, the Mac may sleep`),
  );
  return caffeinate;
}

export function startKeepAwake(log: Log): void {
  const settings = {
    platform: process.platform,
    managed: config.managed,
    keepAwake: config.keepAwake,
  };
  if (checkIsKeepAwakeOn(settings)) startCaffeinate(log);
}

import { match } from 'ts-pattern';

import type { InstallResult } from './daemon-setup';
import * as launchd from './launchd';
import * as systemd from './systemd';

export interface DaemonService {
  install: () => InstallResult;
  uninstall: () => string;
  getStatus: () => string;
  checkIsLoaded: () => boolean;
  stop: () => void;
  start: () => void;
  getDaemonFolder: () => string | null;
}

function buildUnsupportedService(platform: string): DaemonService {
  const fail = (): never => {
    throw new Error(
      `install and uninstall work on macOS and Linux, not on ${platform}. Run kombinat serve under your own supervisor instead`,
    );
  };
  return {
    install: fail,
    uninstall: fail,
    getStatus: () => 'not loaded',
    checkIsLoaded: () => false,
    stop: () => undefined,
    start: fail,
    getDaemonFolder: () => null,
  };
}

export function getDaemonService(platform: NodeJS.Platform = process.platform): DaemonService {
  return match<NodeJS.Platform, DaemonService>(platform)
    .with('darwin', () => launchd)
    .with('linux', () => systemd)
    .otherwise(buildUnsupportedService);
}

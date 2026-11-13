import { match } from 'ts-pattern';

import * as launchd from '../launchd/install';
import * as systemd from '../systemd/install';

export interface InstallResult {
  file: string;
  hint: string | null;
}

export interface DaemonService {
  manager: string;
  install: () => InstallResult;
  uninstall: () => string;
  getStatus: () => string;
  checkIsLoaded: () => boolean;
  stop: () => void;
  start: () => void;
  getDaemonFolder: () => string | null;
}

const launchdService: DaemonService = {
  manager: 'launchd',
  install: () => ({ file: launchd.install(), hint: null }),
  uninstall: launchd.uninstall,
  getStatus: () =>
    launchd
      .getLaunchdStatus()
      .split('\n')
      .filter(line => /state|pid|last exit|runs/.test(line))
      .join('\n') || 'not loaded',
  checkIsLoaded: launchd.checkIsLaunchdLoaded,
  stop: launchd.stopLaunchd,
  start: launchd.startLaunchd,
  getDaemonFolder: launchd.getDaemonFolder,
};

const systemdService: DaemonService = {
  manager: 'systemd',
  install: () => ({ file: systemd.install(), hint: systemd.getLingerHint() }),
  uninstall: systemd.uninstall,
  getStatus: systemd.getSystemdStatus,
  checkIsLoaded: systemd.checkIsSystemdLoaded,
  stop: systemd.stopSystemd,
  start: systemd.startSystemd,
  getDaemonFolder: systemd.getDaemonFolder,
};

function buildUnsupportedService(platform: string): DaemonService {
  const fail = (): never => {
    throw new Error(
      `install and uninstall work on macOS and Linux, not on ${platform}. Run kombinat serve under your own supervisor instead`,
    );
  };
  return {
    manager: 'its supervisor',
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
  return match(platform)
    .with('darwin', () => launchdService)
    .with('linux', () => systemdService)
    .otherwise(buildUnsupportedService);
}

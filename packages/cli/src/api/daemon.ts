import { isMatching } from 'ts-pattern';

import { checkHasAccount, listAccounts } from 'domains/agent/utils';
import type { AccountStatus, DaemonStatus } from 'domains/daemon/types';
import { checkIsRunAtWork } from 'domains/run/utils';

import { config } from '../config';
import { readPlanUsage } from '../domains/agent/storage';
import { loadRoutines } from '../domains/routine/storage';
import type { Routine } from '../domains/routine/types';
import { countStartingRuns } from '../domains/run/launcher';
import { getRunningRuns } from '../domains/run/storage';
import { readSchedulerState } from '../domains/scheduler/storage';
import { readCpuLoad, readDiskSpace } from '../features/machine-usage/machine-usage';

function getAccountStatuses(routines: Routine[]): AccountStatus[] {
  return listAccounts(routines).map(account => {
    const users = routines.filter(
      routine => checkHasAccount(routine.agent) && routine.account === account,
    );
    return {
      name: account,
      routines: users.length,
      claudeUsage: users.some(isMatching({ agent: 'claude' }))
        ? readPlanUsage('claude', account)
        : null,
    };
  });
}

export function getStatus(startedAt: Date): DaemonStatus {
  const routines = loadRoutines();
  return {
    version: config.version,
    pid: process.pid,
    startedAt: startedAt.toISOString(),
    lastTickAt: readSchedulerState()?.lastTickAt ?? null,
    routinesDir: config.routinesDir,
    stateDir: config.stateDir,
    claudeBin: config.claudeBin,
    codexBin: config.codexBin,
    maxConcurrentRuns: config.maxConcurrentRuns,
    running:
      getRunningRuns().filter(checkIsRunAtWork).length +
      routines.reduce((sum, routine) => sum + countStartingRuns(routine.name), 0),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date().toISOString(),
    disk: readDiskSpace(config.stateDir),
    cpuLoad: readCpuLoad(),
    claudeUsage: readPlanUsage('claude', null),
    accounts: getAccountStatuses(routines),
  };
}

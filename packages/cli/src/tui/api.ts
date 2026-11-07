import { getDaemonStatus } from 'domains/daemon/requests';
import type { DaemonStatus } from 'domains/daemon/types';
import { getRoutine, getRoutines, startRoutineRun } from 'domains/routine/requests';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { RECENT_RUNS_LIMIT } from 'domains/run/constants';
import { getRuns, getRunWithTranscript } from 'domains/run/requests';
import type { RunRecord, RunWithTranscript } from 'domains/run/types';
import { createHttpClient } from 'utils/http';

import { config } from '../config';

export interface Overview {
  status: DaemonStatus;
  routines: RoutineSummary[];
  runs: RunRecord[];
}

// Same API as the web dashboard, so "run now" starts in the launchd daemon (unlocked keychain), not over ssh.
export interface DaemonClient {
  baseUrl: string;
  getOverview(): Promise<Overview>;
  getRoutine(name: string): Promise<RoutineDetail>;
  getRun(routine: string, id: string): Promise<RunWithTranscript>;
  startRun(name: string): Promise<void>;
}

export function createDaemonClient(baseUrl = `http://127.0.0.1:${config.port}`): DaemonClient {
  const http = createHttpClient({
    baseUrl,
    timeoutMs: 30_000,
    networkErrorMessage: `daemon not reachable at ${baseUrl}`,
  });

  return {
    baseUrl,
    async getOverview() {
      const [status, routines, runs] = await Promise.all([
        getDaemonStatus(http),
        getRoutines(http),
        getRuns(http, RECENT_RUNS_LIMIT),
      ]);
      return { status, routines, runs };
    },
    getRoutine: async name => getRoutine(http, name),
    getRun: async (routine, id) => getRunWithTranscript(http, routine, id),
    async startRun(name) {
      await startRoutineRun(http, name);
    },
  };
}

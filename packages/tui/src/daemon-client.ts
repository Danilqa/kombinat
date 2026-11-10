import { getDaemonStatus } from 'domains/daemon/requests';
import type { DaemonStatus } from 'domains/daemon/types';
import type { RoutineId, RunId } from 'domains/id/types';
import { getRoutine, getRoutines, startRoutineRun } from 'domains/routine/requests';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { RECENT_RUNS_LIMIT } from 'domains/run/constants';
import { getRuns, getRunWithTranscript } from 'domains/run/requests';
import type { RunRecord, RunWithTranscript } from 'domains/run/types';
import { createHttpClient } from 'utils/http';

export interface Overview {
  status: DaemonStatus;
  routines: RoutineSummary[];
  runs: RunRecord[];
}

// Same API as the web dashboard, so "run now" starts in the launchd daemon (unlocked keychain), not over ssh.
export interface DaemonClient {
  getOverview(): Promise<Overview>;
  getRoutine(name: RoutineId): Promise<RoutineDetail>;
  getRun(routine: RoutineId, id: RunId): Promise<RunWithTranscript>;
  startRun(name: RoutineId): Promise<void>;
}

export function createDaemonClient(baseUrl: string): DaemonClient {
  const http = createHttpClient({
    baseUrl,
    timeoutMs: 30_000,
    networkErrorMessage: `daemon not reachable at ${baseUrl}`,
  });

  return {
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

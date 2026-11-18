import { getDaemonStatus } from 'domains/daemon/requests';
import type { DaemonStatus } from 'domains/daemon/types';
import { getReleaseUpdate } from 'domains/release/requests';
import type { ReleaseUpdate } from 'domains/release/types';
import type { RoutineName } from 'domains/routine/ids';
import { getRoutine, getRoutines, startRoutineRun } from 'domains/routine/requests';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import type { RunId } from 'domains/run/ids';
import { getRunsPage, getRunWithTranscript } from 'domains/run/requests';
import type { RunRecord, RunsCursor, RunsPage, RunWithTranscript } from 'domains/run/types';
import { DEFAULT_SETTINGS } from 'domains/settings/constants';
import { getSettings, updateSettings } from 'domains/settings/requests';
import type { Settings } from 'domains/settings/types';
import { createHttpClient } from 'utils/http';

export interface Overview {
  status: DaemonStatus;
  routines: RoutineSummary[];
  runs: RunRecord[];
  settings: Settings;
  releaseUpdate: ReleaseUpdate | null;
}

// Same API as the web dashboard, so "run now" starts in the launchd daemon (unlocked keychain), not over ssh.
export interface DaemonClient {
  getOverview(): Promise<Overview>;
  getRoutine(name: RoutineName): Promise<RoutineDetail>;
  getRuns(routine: RoutineName, cursor: RunsCursor | null): Promise<RunsPage>;
  getRun(routine: RoutineName, id: RunId): Promise<RunWithTranscript>;
  startRun(name: RoutineName): Promise<void>;
  updateSettings(settings: Settings): Promise<void>;
}

export function createDaemonClient(baseUrl: string): DaemonClient {
  const http = createHttpClient({
    baseUrl,
    timeoutMs: 30_000,
    networkErrorMessage: `daemon not reachable at ${baseUrl}`,
  });

  return {
    async getOverview() {
      const [status, routines, { runs }, settings, releaseUpdate] = await Promise.all([
        getDaemonStatus(http),
        getRoutines(http),
        getRunsPage(http, null, null),
        // Older daemons, which tui --url and connect may talk to, have no settings or releases endpoint.
        getSettings(http).catch(() => DEFAULT_SETTINGS),
        getReleaseUpdate(http).catch(() => null),
      ]);
      return { status, routines, runs, settings, releaseUpdate };
    },
    getRoutine: async name => getRoutine(http, name),
    getRuns: async (routine, cursor) => getRunsPage(http, routine, cursor),
    getRun: async (routine, id) => getRunWithTranscript(http, routine, id),
    async startRun(name) {
      await startRoutineRun(http, name);
    },
    async updateSettings(settings) {
      await updateSettings(http, settings);
    },
  };
}

import { getDaemonStatus, watchDaemonChanges } from 'domains/daemon/requests';
import type { DaemonStatus } from 'domains/daemon/types';
import { markRunsRead } from 'domains/inbox/requests';
import { getReleaseUpdate } from 'domains/release/requests';
import type { ReleaseUpdate } from 'domains/release/types';
import type { RoutineName } from 'domains/routine/ids';
import {
  getRoutine,
  getRoutines,
  scheduleOneTimeRun,
  startRoutineRun,
} from 'domains/routine/requests';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import type { RunId } from 'domains/run/ids';
import { getRunsPage, getRunWithTranscript } from 'domains/run/requests';
import type { RunRecord, RunsCursor, RunsPage, RunWithTranscript } from 'domains/run/types';
import { DEFAULT_SETTINGS } from 'domains/settings/constants';
import { getSettings, updateSettings } from 'domains/settings/requests';
import type { Settings } from 'domains/settings/types';
import { createApi } from 'utils/api';

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
  markRunRead(routine: RoutineName, id: RunId): Promise<void>;
  startRun(name: RoutineName): Promise<void>;
  scheduleOneTimeRun(name: RoutineName, at: Date): Promise<void>;
  updateSettings(settings: Settings): Promise<void>;
  watchChanges(onChange: () => void, signal: AbortSignal): Promise<void>;
}

export function createDaemonClient(baseUrl: string): DaemonClient {
  const api = createApi({
    baseUrl,
    timeoutMs: 30_000,
    networkErrorMessage: `daemon not reachable at ${baseUrl}`,
  });

  return {
    async getOverview() {
      const [status, routines, { runs }, settings, releaseUpdate] = await Promise.all([
        getDaemonStatus(api),
        getRoutines(api),
        getRunsPage(api, null, null),
        // Older daemons, which tui --url and connect may talk to, have no settings or releases endpoint.
        getSettings(api).catch(() => DEFAULT_SETTINGS),
        getReleaseUpdate(api).catch(() => null),
      ]);
      return { status, routines, runs, settings, releaseUpdate };
    },
    getRoutine: async name => getRoutine(api, name),
    getRuns: async (routine, cursor) => getRunsPage(api, routine, cursor),
    getRun: async (routine, id) => getRunWithTranscript(api, routine, id),
    markRunRead: async (routine, id) => markRunsRead(api, [{ routine, id }]),
    async startRun(name) {
      await startRoutineRun(api, name);
    },
    scheduleOneTimeRun: async (name, at) => scheduleOneTimeRun(api, name, at.toISOString()),
    async updateSettings(settings) {
      await updateSettings(api, settings);
    },
    watchChanges: async (onChange, signal) => watchDaemonChanges(api, onChange, signal),
  };
}

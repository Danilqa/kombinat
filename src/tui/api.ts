import { config } from '../config';
import type { DaemonStatus, RoutineDetail, RoutineSummary } from '../server';
import type { RunRecord } from '../state';
import type { Transcript } from '../transcript';

export type { RoutineDetail, RoutineSummary } from '../server';

export interface Overview {
  status: DaemonStatus;
  routines: RoutineSummary[];
  runs: RunRecord[];
}

export interface RunWithTranscript {
  run: RunRecord;
  transcript: Transcript;
}

interface ErrorBody {
  error?: string;
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
  async function request<T>(pathname: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${pathname}`, {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(`daemon not reachable at ${baseUrl}`);
    }
    const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
    if (!response.ok) throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
    return body as T;
  }
  const encode = encodeURIComponent;

  return {
    baseUrl,
    async getOverview() {
      const [status, routines, runs] = await Promise.all([
        request<DaemonStatus>('/api/status'),
        request<RoutineSummary[]>('/api/routines'),
        request<RunRecord[]>('/api/runs?limit=50'),
      ]);
      return { status, routines, runs };
    },
    getRoutine: async name => request(`/api/routines/${encode(name)}`),
    async getRun(routine, id) {
      const runPath = `/api/runs/${encode(routine)}/${encode(id)}`;
      const [run, transcript] = await Promise.all([
        request<RunRecord>(runPath),
        request<Transcript>(`${runPath}/transcript`),
      ]);
      return { run, transcript };
    },
    async startRun(name) {
      await request(`/api/routines/${encode(name)}/run`, { method: 'POST' });
    },
  };
}

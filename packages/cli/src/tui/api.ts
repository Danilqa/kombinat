import { z } from 'zod';

import { readResponse } from 'utils/http';

import { config } from '../config';
import {
  daemonStatusSchema,
  routineDetailSchema,
  routineSummarySchema,
  runRecordSchema,
  startedRunSchema,
  transcriptSchema,
} from '../shared/contract';
import type {
  DaemonStatus,
  RoutineDetail,
  RoutineSummary,
  RunRecord,
  Transcript,
} from '../shared/contract';

export interface Overview {
  status: DaemonStatus;
  routines: RoutineSummary[];
  runs: RunRecord[];
}

export interface RunWithTranscript {
  run: RunRecord;
  transcript: Transcript;
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
  async function request<T>(
    pathname: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${pathname}`, {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(`daemon not reachable at ${baseUrl}`);
    }
    return readResponse(response, schema);
  }
  const encode = encodeURIComponent;

  return {
    baseUrl,
    async getOverview() {
      const [status, routines, runs] = await Promise.all([
        request('/api/status', daemonStatusSchema),
        request('/api/routines', z.array(routineSummarySchema)),
        request('/api/runs?limit=50', z.array(runRecordSchema)),
      ]);
      return { status, routines, runs };
    },
    getRoutine: async name => request(`/api/routines/${encode(name)}`, routineDetailSchema),
    async getRun(routine, id) {
      const runPath = `/api/runs/${encode(routine)}/${encode(id)}`;
      const [run, transcript] = await Promise.all([
        request(runPath, runRecordSchema),
        request(`${runPath}/transcript`, transcriptSchema),
      ]);
      return { run, transcript };
    },
    async startRun(name) {
      await request(`/api/routines/${encode(name)}/run`, startedRunSchema, { method: 'POST' });
    },
  };
}

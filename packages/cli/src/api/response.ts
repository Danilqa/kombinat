import type { IncomingHttpHeaders } from 'node:http';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { RunRecord } from 'domains/run/types';

import { loadRoutines } from '../domains/routine/storage';
import type { Routine } from '../domains/routine/types';
import { readRunRecord } from '../domains/run/storage';

export interface ApiResponse {
  status: number;
  body: unknown;
}

export type ApiRequest = [method: string, segments: string[]];

interface RequestContent {
  body: Buffer;
  headers: IncomingHttpHeaders;
}

export interface ApiContext {
  url: URL;
  startedAt: Date;
  request: RequestContent;
  log: (line: string) => void;
}

export const ok = (body: unknown): ApiResponse => ({ status: 200, body });
export const fail = (status: number, error: string): ApiResponse => ({ status, body: { error } });

export function withRoutine<T extends ApiResponse | Promise<ApiResponse>>(
  name: RoutineName,
  respond: (routine: Routine) => T,
): T | ApiResponse {
  const routine = loadRoutines().find(candidate => candidate.name === name);
  return routine === undefined ? fail(404, `Unknown routine ${name}`) : respond(routine);
}

export function withRun<T extends ApiResponse | Promise<ApiResponse>>(
  routine: RoutineName,
  id: RunId,
  respond: (record: RunRecord) => T,
): T | ApiResponse {
  const record = readRunRecord(routine, id);
  return record === null ? fail(404, 'Run not found') : respond(record);
}

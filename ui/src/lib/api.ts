import { z } from 'zod';

import {
  calendarEntrySchema,
  daemonStatusSchema,
  routineDetailSchema,
  routineSummarySchema,
  runRecordSchema,
  startedRunSchema,
  transcriptSchema,
} from '@shared/contract';
import type {
  CalendarEntry,
  DaemonStatus,
  RoutineDetail,
  RoutineSummary,
  RunRecord,
  Transcript,
} from '@shared/contract';
import { readResponse } from '@shared/http';

export type {
  CalendarEntry,
  DaemonStatus,
  RoutineDetail,
  RoutineSummary,
  RunRecord,
  RunStatus,
  RunTrigger,
  Skip,
  SkipReason,
  Transcript,
  TranscriptItem,
} from '@shared/contract';

async function fetchJson<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  return readResponse(await fetch(url, init), schema);
}

function encode(segment: string): string {
  return encodeURIComponent(segment);
}

export async function getStatus(): Promise<DaemonStatus> {
  return fetchJson('/api/status', daemonStatusSchema);
}

export async function getRoutines(): Promise<RoutineSummary[]> {
  return fetchJson('/api/routines', z.array(routineSummarySchema));
}

export async function getRoutine(name: string): Promise<RoutineDetail> {
  return fetchJson(`/api/routines/${encode(name)}`, routineDetailSchema);
}

export async function getRuns(limit: number): Promise<RunRecord[]> {
  return fetchJson(`/api/runs?limit=${limit}`, z.array(runRecordSchema));
}

export async function getRun(routine: string, id: string): Promise<RunRecord> {
  return fetchJson(`/api/runs/${encode(routine)}/${encode(id)}`, runRecordSchema);
}

export async function getRunTranscript(routine: string, id: string): Promise<Transcript> {
  return fetchJson(`/api/runs/${encode(routine)}/${encode(id)}/transcript`, transcriptSchema);
}

export async function startRoutineRun(name: string): Promise<void> {
  await fetchJson(`/api/routines/${encode(name)}/run`, startedRunSchema, { method: 'POST' });
}

export async function fetchCalendar(from: Date, to: Date): Promise<CalendarEntry[]> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return fetchJson(`/api/calendar?${params.toString()}`, z.array(calendarEntrySchema));
}

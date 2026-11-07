import { z } from 'zod';

import type { HttpClient } from 'utils/http';

import { routineDetailSchema, routineSummarySchema, startedRunSchema } from './schemas';
import type { RoutineDetail, RoutineSummary } from './types';

export async function getRoutines(http: HttpClient): Promise<RoutineSummary[]> {
  return http.request('/api/routines', z.array(routineSummarySchema));
}

export async function getRoutine(http: HttpClient, name: string): Promise<RoutineDetail> {
  return http.request(`/api/routines/${encodeURIComponent(name)}`, routineDetailSchema);
}

export async function startRoutineRun(http: HttpClient, name: string): Promise<void> {
  await http.request(`/api/routines/${encodeURIComponent(name)}/run`, startedRunSchema, {
    method: 'POST',
  });
}

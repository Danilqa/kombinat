import type { RoutineId, RunId } from 'domains/id/types';

export const ROUTINES_PATH = '/';
export const ROUTINE_PATH = '/routines/:name';
export const CALENDAR_PATH = '/calendar';
export const RUNS_PATH = '/runs';
export const RUN_PATH = '/runs/:routine/:id';

export function getRoutinePath(name: RoutineId): string {
  return `/routines/${encodeURIComponent(name)}`;
}

export function getRunPath(routine: RoutineId, id: RunId): string {
  return `/runs/${encodeURIComponent(routine)}/${encodeURIComponent(id)}`;
}

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';

export const ROUTINES_PATH = '/';
export const ROUTINE_PATH = '/routines/:name';
export const ROUTINE_RUN_PATH = '/routines/:name/run';
export const CALENDAR_PATH = '/calendar';
export const RUNS_PATH = '/runs';
export const RUN_PATH = '/runs/:routine/:id';

export function getRoutinePath(name: RoutineName): string {
  return `/routines/${encodeURIComponent(name)}`;
}

export function getRoutineRunPath(name: RoutineName): string {
  return `${getRoutinePath(name)}/run`;
}

export function getRunPath(routine: RoutineName, id: RunId): string {
  return `/runs/${encodeURIComponent(routine)}/${encodeURIComponent(id)}`;
}

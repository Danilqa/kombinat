import type { QueryClient } from '@tanstack/react-query';

export const AGENTS_QUERY_KEY = ['agents'];
export const CALENDAR_QUERY_KEY = ['calendar'];
export const INBOX_QUERY_KEY = ['inbox'];
export const INSIGHTS_QUERY_KEY = ['insights'];
export const RELEASES_QUERY_KEY = ['releases'];
export const ROUTINES_QUERY_KEY = ['routines'];
export const RUNS_QUERY_KEY = ['runs'];
export const SETTINGS_QUERY_KEY = ['settings'];
export const STATUS_QUERY_KEY = ['status'];

export const QUERY_KEYS_CHANGED_BY_RUN = [
  ROUTINES_QUERY_KEY,
  RUNS_QUERY_KEY,
  CALENDAR_QUERY_KEY,
  STATUS_QUERY_KEY,
];
export const QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS = [ROUTINES_QUERY_KEY, CALENDAR_QUERY_KEY];
export const QUERY_KEYS_CHANGED_BY_ADDING = [ROUTINES_QUERY_KEY, CALENDAR_QUERY_KEY];
export const QUERY_KEYS_CHANGED_BY_MESSAGE = [RUNS_QUERY_KEY, ROUTINES_QUERY_KEY, STATUS_QUERY_KEY];
export const QUERY_KEYS_CHANGED_BY_ALLOW = [
  RUNS_QUERY_KEY,
  ROUTINES_QUERY_KEY,
  STATUS_QUERY_KEY,
  INBOX_QUERY_KEY,
];
export const QUERY_KEYS_CHANGED_BY_WAIT_ACTION = [
  RUNS_QUERY_KEY,
  ROUTINES_QUERY_KEY,
  STATUS_QUERY_KEY,
  CALENDAR_QUERY_KEY,
  INBOX_QUERY_KEY,
];
export const QUERY_KEYS_CHANGED_BY_WORKTREE = [RUNS_QUERY_KEY];
export const QUERY_KEYS_CHANGED_BY_CLEANUP = [
  RUNS_QUERY_KEY,
  ROUTINES_QUERY_KEY,
  CALENDAR_QUERY_KEY,
];

export function invalidateQueryKeys(queryClient: QueryClient, queryKeys: string[][]) {
  return Promise.all(queryKeys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
}

export const RUNS_PAGE_SIZE = 50;
export const TOKEN_USAGE_DAYS = 7;
export const RETRY_DELAY_MINUTES = 5;
export const MAX_RETRIES = 10;
// 20 runs of the default 55 minutes, one after another, take most of a day.
export const MAX_RUNS = 20;
export const RUNS_CURSOR_ERROR = 'cursor must be one that /api/runs returned';
export const QUERY_KEYS_CHANGED_BY_MESSAGE = [['runs'], ['routines'], ['status']];
export const QUERY_KEYS_CHANGED_BY_ALLOW = [['runs'], ['routines'], ['status'], ['inbox']];
export const QUERY_KEYS_CHANGED_BY_WAIT_ACTION = [
  ['runs'],
  ['routines'],
  ['status'],
  ['calendar'],
  ['inbox'],
];
export const QUERY_KEYS_CHANGED_BY_WORKTREE = [['runs']];

export const QUERY_KEYS_CHANGED_BY_RUN = [['routines'], ['runs'], ['calendar'], ['status']];

export const QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS = [['routines'], ['calendar']];

// About 5,000 tokens, which every run of the routine reads.
export const MEMORY_MAX_LENGTH = 20_000;

export const ROUTINE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const AGENT_KIND_ERROR =
  'A template that runs a command keeps it, and a template for an agent takes claude or codex';

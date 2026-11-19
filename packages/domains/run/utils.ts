import { isMatching, match, P } from 'ts-pattern';

import { checkMatchesSearch } from 'utils/search';

import { routineNameSchema, type RoutineName } from '../routine/ids';
import { RUNS_PAGE_SIZE } from './constants';
import { runIdSchema, type RunId } from './ids';
import { runsCursorKeySchema, runsCursorSchema } from './schemas';
import type {
  RunRecord,
  RunsCursor,
  RunsCursorKey,
  RunsPage,
  RunsPageQuery,
  RunStatus,
  RunTrigger,
} from './types';

export function createRunId(now = new Date()): RunId {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const suffix = Math.random().toString(36).slice(2, 6);
  return runIdSchema.parse(`${stamp}-${suffix}`);
}

export function getRunDurationMs(
  run: Pick<RunRecord, 'startedAt' | 'endedAt'>,
  now: number = Date.now(),
): number {
  const end = run.endedAt ? new Date(run.endedAt).getTime() : now;
  // A clock that ticks once a second can read a moment before a run that has just started.
  return Math.max(0, end - new Date(run.startedAt).getTime());
}

// A run is active while its agent is at work, waits out a usage limit or replies to a message.
export function checkIsRunActive(run: Pick<RunRecord, 'status' | 'replyPid'>): boolean {
  return isMatching({ status: P.union('running', 'waiting') }, run) || run.replyPid !== null;
}

// Only an agent that resumes sessions gives a run a resume command, and it needs the session.
export function checkCanContinueRun(run: Pick<RunRecord, 'resumeCommand'>): boolean {
  return run.resumeCommand !== null;
}

export function getRunStatusLabel(status: RunStatus): string {
  return match(status)
    .with('running', () => 'Running')
    .with('waiting', () => 'Waiting for limit')
    .with('succeeded', () => 'Succeeded')
    .with('failed', () => 'Failed')
    .with('timed_out', () => 'Timed out')
    .with('aborted', () => 'Aborted')
    .exhaustive();
}

export function getTriggerLabel(trigger: RunTrigger): string {
  return match(trigger)
    .with('schedule', () => 'Scheduled')
    .with('manual', () => 'Manual')
    .with('catch_up', () => 'Catch-up')
    .with('webhook', () => 'Webhook')
    .exhaustive();
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function compareRunsByNewest(a: RunsCursorKey, b: RunsCursorKey): number {
  return (
    compareText(b.startedAt, a.startedAt) ||
    compareText(b.routine, a.routine) ||
    compareText(b.id, a.id)
  );
}

export function encodeRunsCursor({ startedAt, routine, id }: RunsCursorKey): RunsCursor {
  return runsCursorSchema.parse(JSON.stringify({ startedAt, routine, id }));
}

export function decodeRunsCursor(cursor: string): RunsCursorKey | null {
  try {
    const key = runsCursorKeySchema.safeParse(JSON.parse(cursor));
    return key.success ? key.data : null;
  } catch {
    return null;
  }
}

export function parseRunsPageQuery(params: URLSearchParams): RunsPageQuery | null {
  const routine = params.get('routine');
  const cursor = params.get('cursor');
  const search = params.get('q')?.trim() ?? '';
  const cursorKey = cursor === null ? null : decodeRunsCursor(cursor);
  if (cursor !== null && cursorKey === null) return null;
  return {
    routine: routine === null ? null : routineNameSchema.parse(routine),
    cursor: cursorKey,
    search: search === '' ? null : search,
  };
}

export function filterRuns(runs: RunRecord[], search: string | null): RunRecord[] {
  if (search === null) return runs;
  return runs.filter(run =>
    checkMatchesSearch(search, [
      run.routine,
      run.id,
      getRunStatusLabel(run.status),
      getTriggerLabel(run.trigger),
      run.agent,
      run.model,
      run.resultText,
      run.error,
    ]),
  );
}

export function paginateRuns(
  newestFirstRuns: RunRecord[],
  cursor: RunsCursorKey | null,
  pageSize = RUNS_PAGE_SIZE,
): RunsPage {
  const start =
    cursor === null ? 0 : newestFirstRuns.findIndex(run => compareRunsByNewest(run, cursor) > 0);
  const page = start === -1 ? [] : newestFirstRuns.slice(start, start + pageSize);
  const last = page.at(-1);
  const hasMore = start !== -1 && start + pageSize < newestFirstRuns.length;
  return {
    runs: page,
    nextCursor: hasMore && last !== undefined ? encodeRunsCursor(last) : null,
    total: newestFirstRuns.length,
  };
}

// The newest run of each routine stays, so its last outcome never disappears.
export function findExpiredRuns(runs: RunRecord[], retentionDays: number, now: Date): RunRecord[] {
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  const newest = new Map<RoutineName, RunRecord>();
  for (const run of runs) {
    const current = newest.get(run.routine);
    if (current === undefined || compareRunsByNewest(run, current) < 0)
      newest.set(run.routine, run);
  }
  return runs.filter(
    run =>
      !checkIsRunActive(run) &&
      new Date(run.startedAt).getTime() < cutoff &&
      newest.get(run.routine) !== run,
  );
}

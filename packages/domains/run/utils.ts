import { match } from 'ts-pattern';

import { routineNameSchema, runIdSchema } from '../id/schemas';
import type { RunId } from '../id/types';
import { MAX_RUNS_PAGE_SIZE, RUNS_PAGE_SIZE } from './constants';
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
  return end - new Date(run.startedAt).getTime();
}

export function getRunStatusLabel(status: RunStatus): string {
  return match(status)
    .with('running', () => 'Running')
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

function encodeBase64Url(text: string): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(text));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(encoded: string): string {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

export function encodeRunsCursor({ startedAt, routine, id }: RunsCursorKey): RunsCursor {
  return runsCursorSchema.parse(encodeBase64Url(JSON.stringify({ startedAt, routine, id })));
}

export function decodeRunsCursor(cursor: string): RunsCursorKey | null {
  try {
    const key = runsCursorKeySchema.safeParse(JSON.parse(decodeBase64Url(cursor)));
    return key.success ? key.data : null;
  } catch {
    return null;
  }
}

export function parseRunsPageQuery(params: URLSearchParams): RunsPageQuery | null {
  const limit = Number(params.get('limit') ?? RUNS_PAGE_SIZE);
  const routine = params.get('routine');
  const cursor = params.get('cursor');
  const cursorKey = cursor === null ? null : decodeRunsCursor(cursor);
  const isValid =
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= MAX_RUNS_PAGE_SIZE &&
    (cursor === null || cursorKey !== null);
  if (!isValid) return null;
  return {
    routine: routine === null ? null : routineNameSchema.parse(routine),
    cursor: cursorKey,
    limit,
  };
}

export function paginateRuns(runs: RunRecord[], { cursor, limit }: RunsPageQuery): RunsPage {
  const sorted = runs.toSorted(compareRunsByNewest);
  const start = cursor === null ? 0 : sorted.findIndex(run => compareRunsByNewest(run, cursor) > 0);
  const page = start === -1 ? [] : sorted.slice(start, start + limit);
  const last = page.at(-1);
  const hasMore = start !== -1 && start + limit < sorted.length;
  return {
    runs: page,
    nextCursor: hasMore && last !== undefined ? encodeRunsCursor(last) : null,
    total: sorted.length,
  };
}

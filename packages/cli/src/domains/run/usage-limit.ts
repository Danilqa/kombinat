import fs from 'node:fs';
import path from 'node:path';

import { match, P } from 'ts-pattern';

import { usageLimitWaitActionSchema } from 'domains/run/schemas';
import type { RunRecord, UsageLimitWait, UsageLimitWaitAction } from 'domains/run/types';

import { config } from '../../config';
import type { UsageLimitStop } from '../agent/types';
import { getRunsDir } from './storage';

// A limit resets on the server's clock, so a session continued on the second could be refused again.
const RESET_GRACE_MS = 60_000;
// The longest limit is the weekly one. A later reset, such as a monthly spend cap, fails the run.
const MAX_WAIT_MS = 8 * 86_400_000;
const POLL_MS = 1000;

function getActionFile(record: Pick<RunRecord, 'routine' | 'id'>): string {
  return path.join(getRunsDir(record.routine), `${record.id}.wait`);
}

export function planUsageLimitWait(
  stop: UsageLimitStop,
  now: Date = new Date(),
): UsageLimitWait | null {
  const resetsAt = new Date(stop.resetsAt).getTime();
  const waitMs = resetsAt - now.getTime();
  if (Number.isNaN(resetsAt) || waitMs <= 0 || waitMs > MAX_WAIT_MS) return null;
  return {
    limit: stop.limit,
    stoppedAt: now.toISOString(),
    continuesAt: new Date(resetsAt + RESET_GRACE_MS).toISOString(),
  };
}

export function requestWaitAction(record: RunRecord, action: UsageLimitWaitAction): void {
  fs.writeFileSync(getActionFile(record), action);
}

function takeWaitAction(record: RunRecord): UsageLimitWaitAction | null {
  const file = getActionFile(record);
  if (!fs.existsSync(file)) return null;
  const action = usageLimitWaitActionSchema.safeParse(fs.readFileSync(file, 'utf8').trim());
  fs.rmSync(file, { force: true });
  return action.success ? action.data : null;
}

// The scheduler sits a level above runs, so a run watches the state file that each of its ticks rewrites.
function getLastTickMark(): number | null {
  const file = path.join(config.stateDir, 'scheduler.json');
  return fs.statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? null;
}

function getContinuesAt(run: RunRecord): string | null {
  return match(run)
    .with(
      { status: 'waiting', usageLimit: P.nonNullable },
      ({ usageLimit }) => usageLimit.continuesAt,
    )
    .with({ status: 'retrying', retry: P.nonNullable }, ({ retry }) => retry.continuesAt)
    .otherwise(() => null);
}

// Only the daemon knows the runs that started and have no record yet, so its scheduler continues a run.
export function checkIsWaitOver(run: RunRecord, now: Date): boolean {
  const continuesAt = getContinuesAt(run);
  return continuesAt !== null && now.getTime() >= new Date(continuesAt).getTime();
}

// Waits out a usage limit or the time until a retry. Without a ticking scheduler, such as for a run
// started in a terminal, the run continues by itself.
export function waitForAction(
  record: RunRecord,
  continuesAtIso: string,
): Promise<UsageLimitWaitAction> {
  // A click that came as an earlier wait ended must not end this one.
  takeWaitAction(record);
  const continuesAt = new Date(continuesAtIso).getTime();
  // Polls, not clock time, so a scheduler that slept with the computer is not taken for gone.
  const idlePolls = (2 * config.tickSeconds * 1000) / POLL_MS;
  let tickMark = getLastTickMark();
  let pollsSinceTick = 0;
  return new Promise(resolve => {
    const timer = setInterval(() => {
      const mark = getLastTickMark();
      pollsSinceTick = mark === tickMark ? pollsSinceTick + 1 : 0;
      tickMark = mark;
      const isSchedulerIdle = pollsSinceTick > idlePolls;
      const action =
        takeWaitAction(record) ??
        (isSchedulerIdle && Date.now() >= continuesAt ? 'continue' : null);
      if (action === null) return;
      clearInterval(timer);
      resolve(action);
    }, POLL_MS);
  });
}

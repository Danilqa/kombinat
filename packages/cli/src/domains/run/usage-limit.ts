import fs from 'node:fs';
import path from 'node:path';

import { isMatching, match } from 'ts-pattern';

import { usageLimitWaitActionSchema } from 'domains/run/schemas';
import type { RunRecord, UsageLimitWait, UsageLimitWaitAction } from 'domains/run/types';
import type { UsageLimitOutcome } from 'domains/transcript/types';

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

// Only the daemon knows the runs that started and have no record yet, so its scheduler continues a run.
export function checkIsWaitOver(run: RunRecord, now: Date): boolean {
  return (
    isMatching('waiting', run.status) &&
    run.usageLimit !== null &&
    now.getTime() >= new Date(run.usageLimit.continuesAt).getTime()
  );
}

export function waitOutUsageLimit(record: RunRecord): Promise<UsageLimitOutcome> {
  // A click that came as an earlier wait ended must not end this one.
  takeWaitAction(record);
  return new Promise(resolve => {
    const timer = setInterval(() => {
      const action = takeWaitAction(record);
      if (action === null) return;
      clearInterval(timer);
      resolve(
        match(action)
          .with('stop', (): UsageLimitOutcome => 'stopped')
          .with('continue', (): UsageLimitOutcome => 'continued')
          .exhaustive(),
      );
    }, POLL_MS);
  });
}

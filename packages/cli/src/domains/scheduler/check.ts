import fs from 'node:fs';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import { createRunId } from 'domains/run/utils';

import type { Routine } from '../routine/types';
import type { HookEvent } from '../run/event-log';
import { appendHookEvent, getHookError, HOOK_TIMEOUT_MS, runHookCommand } from '../run/hooks';
import { writeCheckError } from '../run/payload';
import { getRunLogFile, getRunsDir } from '../run/storage';

// EX_CONFIG, as for the webhook gate: crashes exit with 1 or 2, never with this.
const CHECK_SKIP_EXIT_CODE = 78;
const SKIP_OUTPUT_LENGTH = 500;

interface StartDecision {
  outcome: 'start';
  event: HookEvent | null;
  error: string | null;
}

interface SkipDecision {
  outcome: 'skip';
  output: string | null;
}

type CheckDecision = StartDecision | SkipDecision;

const checkingRoutines = new Set<RoutineName>();

export function checkIsChecking(routineName: RoutineName): boolean {
  return checkingRoutines.has(routineName);
}

export async function runCheck(
  routine: Routine,
  check: string,
  timeoutMs = HOOK_TIMEOUT_MS,
): Promise<CheckDecision> {
  // The run's preflight reports a missing cwd better than a shell that fails to start.
  if (!fs.existsSync(routine.cwd)) return { outcome: 'start', event: null, error: null };
  checkingRoutines.add(routine.name);
  try {
    const result = await runHookCommand({
      type: 'check',
      command: check,
      cwd: routine.cwd,
      env: { ...process.env, KOMBINAT_ROUTINE: routine.name },
      input: '',
      timeoutMs,
    });
    if (result.exitCode === CHECK_SKIP_EXIT_CODE && !result.isTimedOut) {
      return { outcome: 'skip', output: result.output.slice(0, SKIP_OUTPUT_LENGTH) || null };
    }
    return {
      outcome: 'start',
      event: result.event,
      error: getHookError('check', result, timeoutMs),
    };
  } finally {
    checkingRoutines.delete(routine.name);
  }
}

// The check goes first in the run's log, and a failed one fails the run before its agent starts.
export function prepareCheckedRun(routineName: RoutineName, decision: StartDecision): RunId {
  const runId = createRunId();
  if (decision.event === null) return runId;
  fs.mkdirSync(getRunsDir(routineName), { recursive: true });
  appendHookEvent(getRunLogFile(routineName, runId), decision.event);
  if (decision.error !== null) writeCheckError(routineName, runId, decision.error);
  return runId;
}

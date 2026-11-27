import { isMatching, match } from 'ts-pattern';

import { RUNS_CURSOR_ERROR } from 'domains/run/constants';
import { runMessageSchema, usageLimitWaitActionSchema } from 'domains/run/schemas';
import type { RunRecord } from 'domains/run/types';
import {
  buildAllowMessage,
  checkCanContinueRun,
  checkIsRunActive,
  checkIsRunWaiting,
  filterRuns,
  listBlockedRules,
  paginateRuns,
  parseRunsPageQuery,
} from 'domains/run/utils';

import type { Routine } from '../domains/routine/types';
import { readRunEvents } from '../domains/run/event-log';
import { checkIsRunning, startDetachedReply } from '../domains/run/launcher';
import {
  checkIsProcessAlive,
  listAllRuns,
  listRuns,
  readRunRecord,
  writeRunRecord,
} from '../domains/run/storage';
import { buildRunTranscript } from '../domains/run/transcript';
import { requestWaitAction } from '../domains/run/usage-limit';
import { reconcileWorktree, removeWorktree } from '../domains/run/worktree';
import { parseJson } from '../utils/json';
import { fail, ok, withRoutine } from './response';
import type { ApiResponse } from './response';

export function getRunsPage(url: URL): ApiResponse {
  const query = parseRunsPageQuery(url.searchParams);
  if (query === null) return fail(400, RUNS_CURSOR_ERROR);
  const toPage = (runs: RunRecord[]) =>
    ok(paginateRuns(filterRuns(runs, query.search), query.cursor));
  if (query.routine === null) return toPage(listAllRuns());
  return withRoutine(query.routine, routine => toPage(listRuns(routine.name)));
}

export function getRun(run: RunRecord): ApiResponse {
  return ok(reconcileWorktree(run));
}

export async function removeRunWorktree(run: RunRecord): Promise<ApiResponse> {
  const { worktree } = run;
  if (worktree === null) return fail(404, 'This run has no worktree');
  if (checkIsRunActive(run)) {
    return fail(409, 'The run is still working in its worktree. Remove it once the run is done');
  }
  if (!isMatching({ state: 'present' }, worktree)) return ok({ ok: true });
  return match(await removeWorktree(worktree))
    .with({ outcome: 'has_changes' }, () =>
      fail(
        409,
        `The worktree has changes that aren't committed. Commit them, or delete them with git worktree remove --force ${worktree.path}`,
      ),
    )
    .with({ outcome: 'removed' }, removal => {
      // Read again, so a reply that started meanwhile keeps its pid.
      const latest = readRunRecord(run.routine, run.id) ?? run;
      writeRunRecord({ ...latest, worktree: removal.worktree });
      return ok({ ok: true });
    })
    .exhaustive();
}

export function sendMessage(routine: Routine, run: RunRecord, body: Buffer): ApiResponse {
  const message = runMessageSchema.safeParse(parseJson(body.toString('utf8')));
  if (!message.success) return fail(400, 'The message needs text');
  if (!checkCanContinueRun(run)) {
    return fail(409, `This ${run.agent} run has no session to continue`);
  }
  if (checkIsRunning(routine.name)) {
    return fail(409, `${routine.name} is running, send the message once it is done`);
  }
  startDetachedReply(run, { text: message.data.text, source: 'dashboard' });
  return { status: 202, body: { ok: true } };
}

// The reply gets the rules for this session only. The routine's own settings stay as they are.
export function allowBlockedActions(routine: Routine, run: RunRecord): ApiResponse {
  const rules = listBlockedRules(run.blockedActions);
  if (rules.length === 0) return fail(409, 'This run has no blocked actions to allow');
  if (!checkCanContinueRun(run)) {
    return fail(409, `This ${run.agent} run has no session to continue`);
  }
  if (checkIsRunning(routine.name)) {
    return fail(409, `${routine.name} is running, try again once it is done`);
  }
  startDetachedReply(run, {
    text: buildAllowMessage(rules),
    source: 'dashboard',
    allowedTools: rules,
  });
  return { status: 202, body: { ok: true } };
}

export function sendWaitAction(run: RunRecord, action: string): ApiResponse {
  const parsed = usageLimitWaitActionSchema.safeParse(action);
  if (!parsed.success) return fail(404, 'Not found');
  if (!checkIsRunWaiting(run) || !checkIsProcessAlive(run.pid)) {
    return fail(409, 'This run is not waiting for a usage limit or a retry');
  }
  requestWaitAction(run, parsed.data);
  return { status: 202, body: { ok: true } };
}

export function getRunTranscript(run: RunRecord): ApiResponse {
  return ok(buildRunTranscript(run.agent, readRunEvents(run)));
}

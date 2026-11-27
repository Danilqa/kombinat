import path from 'node:path';

import { match } from 'ts-pattern';

import { MEMORY_MAX_LENGTH } from 'domains/routine/constants';
import { routineNameSchema } from 'domains/routine/ids';
import {
  addRoutineRequestSchema,
  memoryRequestSchema,
  oneTimeRunRequestSchema,
  startRunRequestSchema,
} from 'domains/routine/schemas';
import { findRoutineTemplate } from 'domains/routine/templates';
import type { ChainLink, RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { listChain } from 'domains/routine/utils';
import { MAX_RUNS } from 'domains/run/constants';
import type { RunRecord, TokenUsage } from 'domains/run/types';
import { buildTokenUsages, checkIsRunActive, getTokenUsageStart } from 'domains/run/utils';
import type { OneTimeRun } from 'domains/scheduler/types';
import {
  addOneTimeRun,
  checkHasOneTimeRun,
  getNextRunAt,
  getOneTimeRunError,
  listRoutineOneTimeRuns,
  removeOneTimeRun,
} from 'domains/scheduler/utils';

import { config } from '../config';
import { readRoutineMemory, writeMemory } from '../domains/routine/memory';
import { loadRoutines } from '../domains/routine/storage';
import { addRoutineFromTemplate } from '../domains/routine/templates';
import type { Routine } from '../domains/routine/types';
import { describeSchedule, getNextRun } from '../domains/routine/utils';
import { checkIsRunning, checkIsStarting, startDetachedRuns } from '../domains/run/launcher';
import {
  cancelQueuedRuns,
  listRoutineQueuedRuns,
  readQueuedRuns,
} from '../domains/run/queued-runs';
import { listRuns, listRunsSince } from '../domains/run/storage';
import { getSkips, readOneTimeRuns, writeOneTimeRuns } from '../domains/scheduler/storage';
import { startQueuedRuns } from '../domains/scheduler/tick';
import { listWebhookCalls } from '../domains/webhook/call-log';
import { countQueuedWebhooks, listQueuedWebhooks } from '../domains/webhook/queue';
import { parseJson } from '../utils/json';
import { fail, ok } from './response';
import type { ApiResponse } from './response';

function toRoutineSummary(
  routine: Routine,
  runs: RunRecord[],
  oneTimeRuns: OneTimeRun[],
  tokenUsage: TokenUsage | null,
  hasQueuedRuns: boolean,
): RoutineSummary {
  return {
    name: routine.name,
    description: routine.description,
    schedule: routine.schedule,
    scheduleHuman: describeSchedule(routine),
    nextRunAt: getNextRunAt(getNextRun(routine), routine.enabled ? oneTimeRuns : []),
    enabled: routine.enabled,
    webhook: routine.webhook,
    webhookGate: routine.webhookGate,
    check: routine.check,
    queuedWebhooks: countQueuedWebhooks(routine.name),
    agent: routine.agent,
    account: routine.account,
    model: routine.model,
    fallbackModel: routine.fallbackModel,
    effort: routine.effort,
    permissionMode: routine.permissionMode,
    command: routine.command,
    cwd: routine.cwd,
    timeoutMinutes: routine.timeoutMinutes,
    retries: routine.retries,
    runs: routine.runs,
    maxParallel: routine.maxParallel,
    worktree: routine.worktree,
    maxBudgetUsd: routine.maxBudgetUsd,
    maxBudgetTokens: routine.maxBudgetTokens,
    file: path.relative(config.projectRoot, routine.file),
    running: checkIsStarting(routine.name) || hasQueuedRuns || runs.some(checkIsRunActive),
    lastRun: runs[0] ?? null,
    lastSkip: getSkips(routine.name).at(-1) ?? null,
    tokenUsage,
    memory: routine.memory,
    startsAfter: routine.startsAfter,
    startsWhen: routine.startsWhen,
  };
}

function getChain(routine: Routine, routines: Routine[]): ChainLink[] {
  return listChain(routines, routine.name).map(link => ({
    name: link.name,
    scheduleHuman: describeSchedule(link),
    startsAfter: link.startsAfter,
    startsWhen: link.startsWhen,
    lastRun: listRuns(link.name)[0] ?? null,
  }));
}

export function getRoutineSummaries(): RoutineSummary[] {
  const oneTimeRuns = readOneTimeRuns();
  const queuedRoutines = new Set(readQueuedRuns().map(queued => queued.routine));
  const routines = loadRoutines();
  const runsByRoutine = routines.map(routine => listRuns(routine.name));
  const tokenUsages = buildTokenUsages(runsByRoutine, new Date());
  return routines.map((routine, index) =>
    toRoutineSummary(
      routine,
      runsByRoutine[index] ?? [],
      listRoutineOneTimeRuns(oneTimeRuns, routine.name),
      tokenUsages[index] ?? null,
      queuedRoutines.has(routine.name),
    ),
  );
}

export function getRoutineDetail(routine: Routine): ApiResponse {
  const oneTimeRuns = listRoutineOneTimeRuns(readOneTimeRuns(), routine.name);
  const runs = listRuns(routine.name);
  const now = new Date();
  const since = getTokenUsageStart(now);
  const routines = loadRoutines();
  // The share needs the tokens of every other routine too.
  const otherRuns = routines
    .filter(other => other.name !== routine.name)
    .map(other => listRunsSince(other.name, since));
  const [tokenUsage = null] = buildTokenUsages([runs, ...otherRuns], now);
  const queuedRuns = listRoutineQueuedRuns(routine.name);
  const detail: RoutineDetail = {
    ...toRoutineSummary(routine, runs, oneTimeRuns, tokenUsage, queuedRuns.length > 0),
    prompt: routine.prompt,
    skips: getSkips(routine.name),
    queue: listQueuedWebhooks(routine.name),
    webhookCalls: listWebhookCalls(routine.name),
    oneTimeRuns,
    queuedRuns,
    memoryNotes: routine.memory ? readRoutineMemory(routine.name) : null,
    chain: getChain(routine, routines),
  };
  return ok(detail);
}

export function addRoutine(body: Buffer): ApiResponse {
  const request = addRoutineRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) {
    return fail(
      400,
      'The body must be JSON with a template, a lowercase kebab-case name, a folder, a schedule, an agent, a model or null and a prompt',
    );
  }
  const { template: id, name, ...choices } = request.data;
  const template = findRoutineTemplate(id);
  if (template === null) return fail(404, `Unknown template ${id}`);
  const added = addRoutineFromTemplate(template, {
    ...choices,
    name: routineNameSchema.parse(name),
  });
  return match(added)
    .with({ outcome: 'invalid' }, ({ error }) => fail(400, error))
    .with({ outcome: 'exists' }, () =>
      fail(409, `A routine named ${name} already exists. Choose another name`),
    )
    .with({ outcome: 'added' }, ({ file }) => ({
      status: 201,
      body: { ok: true, name, file: path.relative(config.projectRoot, file) },
    }))
    .exhaustive();
}

function parseOneTimeRun(routine: Routine, body: Buffer): OneTimeRun | null {
  const request = oneTimeRunRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) return null;
  return { routine: routine.name, at: new Date(request.data.at).toISOString() };
}

export function scheduleOneTimeRun(routine: Routine, body: Buffer): ApiResponse {
  const oneTimeRun = parseOneTimeRun(routine, body);
  if (oneTimeRun === null) return fail(400, 'The body must be JSON with an ISO time in at');
  if (!routine.enabled) {
    return fail(409, `${routine.name} is disabled, set enabled: true in its frontmatter`);
  }
  const runs = readOneTimeRuns();
  const error = getOneTimeRunError(runs, oneTimeRun, new Date());
  if (error !== null) return fail(400, error);
  writeOneTimeRuns(addOneTimeRun(runs, oneTimeRun));
  return ok({ ok: true });
}

export function cancelOneTimeRun(routine: Routine, body: Buffer): ApiResponse {
  const oneTimeRun = parseOneTimeRun(routine, body);
  if (oneTimeRun === null) return fail(400, 'The body must be JSON with an ISO time in at');
  const runs = readOneTimeRuns();
  if (!checkHasOneTimeRun(runs, oneTimeRun)) {
    return fail(
      404,
      `${routine.name} has no run scheduled at that time, it may have started already`,
    );
  }
  writeOneTimeRuns(removeOneTimeRun(runs, oneTimeRun));
  return ok({ ok: true });
}

export function saveMemory(routine: Routine, body: Buffer): ApiResponse {
  if (!routine.memory) {
    return fail(
      409,
      `${routine.name} has no memory. It needs agent claude or codex and memory: true`,
    );
  }
  const request = memoryRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) {
    return fail(
      400,
      `The body must be JSON with notes of at most ${MEMORY_MAX_LENGTH} characters in text`,
    );
  }
  writeMemory(routine.name, request.data.text, { by: 'user' });
  return ok({ ok: true });
}

export function startRun(routine: Routine, body: Buffer): ApiResponse {
  const request =
    body.length === 0 ? null : startRunRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (request?.success === false) {
    return fail(
      400,
      `The body must be JSON, with a prompt that isn't blank and runs and maxParallel from 1 to ${MAX_RUNS}`,
    );
  }
  const runs = request?.data.runs ?? routine.runs;
  const maxParallel = request?.data.maxParallel ?? Math.min(routine.maxParallel, runs);
  if (maxParallel > runs) return fail(400, `maxParallel must be at most runs, which is ${runs}`);
  if (checkIsRunning(routine.name)) return fail(409, `${routine.name} is already running`);
  const runId = startDetachedRuns(
    routine.name,
    { trigger: 'manual' },
    { count: runs, maxParallel, prompt: request?.data.prompt ?? null },
  );
  startQueuedRuns();
  return { status: 202, body: { ok: true, runId } };
}

export function cancelRoutineQueuedRuns(routine: Routine): ApiResponse {
  cancelQueuedRuns(routine.name);
  return ok({ ok: true });
}

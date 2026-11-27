import { NOTIFY_LEVELS } from 'domains/inbox/constants';
import { markReadRequestSchema, notifyRequestSchema } from 'domains/inbox/schemas';
import {
  addReadRuns,
  changeNotifyLevel,
  keepNotifyLevelsOf,
  listUnreadRuns,
} from 'domains/inbox/utils';

import {
  readInboxState,
  readNotifyLevels,
  writeInboxState,
  writeNotifyLevels,
} from '../domains/inbox/storage';
import { loadRoutines } from '../domains/routine/storage';
import type { Routine } from '../domains/routine/types';
import { listAllRuns } from '../domains/run/storage';
import { parseJson } from '../utils/json';
import { fail, ok } from './response';
import type { ApiResponse } from './response';

export function getInbox(): ApiResponse {
  const routines = loadRoutines().map(routine => routine.name);
  return ok({
    runs: listUnreadRuns(listAllRuns(), readInboxState()),
    notify: keepNotifyLevelsOf(readNotifyLevels(), routines),
  });
}

export function markRunsRead(body: Buffer): ApiResponse {
  const request = markReadRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) return fail(400, 'The body must list runs with their routine and id');
  const state = readInboxState();
  const next = addReadRuns(state, request.data.runs, listAllRuns());
  if (JSON.stringify(next) !== JSON.stringify(state)) writeInboxState(next);
  return ok({ ok: true });
}

export function setNotifyLevel(routine: Routine, body: Buffer): ApiResponse {
  const request = notifyRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) {
    return fail(400, `level must be one of ${NOTIFY_LEVELS.join(', ')}`);
  }
  writeNotifyLevels(changeNotifyLevel(readNotifyLevels(), routine.name, request.data.level));
  return ok({ ok: true });
}

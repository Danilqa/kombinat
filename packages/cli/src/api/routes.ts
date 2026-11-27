import { match, P } from 'ts-pattern';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';

import { getAgentOptions } from './agent';
import { getCalendar } from './calendar';
import { getStatus } from './daemon';
import { getInbox, markRunsRead, setNotifyLevel } from './inbox';
import { getInsights } from './insights';
import { getReleases, skipReleaseVersion } from './release';
import { fail, ok, withRoutine, withRun } from './response';
import type { ApiContext, ApiRequest, ApiResponse } from './response';
import {
  addRoutine,
  cancelOneTimeRun,
  cancelRoutineQueuedRuns,
  getRoutineDetail,
  getRoutineSummaries,
  saveMemory,
  scheduleOneTimeRun,
  startRun,
} from './routine';
import {
  allowBlockedActions,
  getRun,
  getRunsPage,
  getRunTranscript,
  removeRunWorktree,
  sendMessage,
  sendWaitAction,
} from './run';
import { getSettings, updateSettings } from './settings';
import { handleWebhook } from './webhook';

export function routeApi(
  request: ApiRequest,
  context: ApiContext,
): ApiResponse | Promise<ApiResponse> {
  const { url, startedAt } = context;
  return match(request)
    .with(['GET', ['status']], () => ok(getStatus(startedAt)))
    .with(['GET', ['routines']], () => ok(getRoutineSummaries()))
    .with(['POST', ['routines']], () => addRoutine(context.request.body))
    .with(['GET', ['routines', P.string]], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), getRoutineDetail),
    )
    .with(['POST', ['routines', P.string, 'run']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        startRun(routine, context.request.body),
      ),
    )
    .with(['POST', ['routines', P.string, 'queued-runs', 'cancel']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), cancelRoutineQueuedRuns),
    )
    .with(['POST', ['routines', P.string, 'one-time-runs']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        scheduleOneTimeRun(routine, context.request.body),
      ),
    )
    .with(['POST', ['routines', P.string, 'one-time-runs', 'cancel']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        cancelOneTimeRun(routine, context.request.body),
      ),
    )
    .with(['PUT', ['routines', P.string, 'memory']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        saveMemory(routine, context.request.body),
      ),
    )
    .with(['POST', ['routines', P.string, 'webhook']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine => handleWebhook(routine, context)),
    )
    .with(['GET', ['calendar']], () => getCalendar(url))
    .with(['GET', ['inbox']], () => getInbox())
    .with(['GET', ['insights']], () => getInsights(url))
    .with(['POST', ['inbox', 'read']], () => markRunsRead(context.request.body))
    .with(['PUT', ['inbox', 'notify', P.string]], ([, [, , name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        setNotifyLevel(routine, context.request.body),
      ),
    )
    .with(['GET', ['agents']], () => ok(getAgentOptions()))
    .with(['GET', ['settings']], () => getSettings())
    .with(['PUT', ['settings']], () => updateSettings(context.request.body))
    .with(['GET', ['releases']], () => getReleases())
    .with(['POST', ['releases', P.string, 'skip']], ([, [, version]]) =>
      skipReleaseVersion(version),
    )
    .with(['GET', ['runs']], () => getRunsPage(url))
    .with(['GET', ['runs', P.string, P.string]], ([, [, routine, id]]) =>
      withRun(routineNameSchema.parse(routine), runIdSchema.parse(id), getRun),
    )
    .with(['POST', ['runs', P.string, P.string, 'worktree', 'remove']], ([, [, routine, id]]) =>
      withRun(routineNameSchema.parse(routine), runIdSchema.parse(id), removeRunWorktree),
    )
    .with(['POST', ['runs', P.string, P.string, 'messages']], ([, [, routine, id]]) =>
      withRoutine(routineNameSchema.parse(routine), found =>
        withRun(found.name, runIdSchema.parse(id), run =>
          sendMessage(found, run, context.request.body),
        ),
      ),
    )
    .with(['POST', ['runs', P.string, P.string, 'blocked', 'allow']], ([, [, routine, id]]) =>
      withRoutine(routineNameSchema.parse(routine), found =>
        withRun(found.name, runIdSchema.parse(id), run => allowBlockedActions(found, run)),
      ),
    )
    .with(
      ['POST', ['runs', P.string, P.string, 'wait', P.string]],
      ([, [, routine, id, , action]]) =>
        withRun(routineNameSchema.parse(routine), runIdSchema.parse(id), run =>
          sendWaitAction(run, action),
        ),
    )
    .with(['GET', ['runs', P.string, P.string, 'transcript']], ([, [, routine, id]]) =>
      withRun(routineNameSchema.parse(routine), runIdSchema.parse(id), getRunTranscript),
    )
    .otherwise(() => fail(404, 'Not found'));
}

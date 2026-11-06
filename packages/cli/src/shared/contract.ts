import { z } from 'zod';

export const agentNameSchema = z.enum(['claude', 'codex', 'command']);
export type AgentName = z.infer<typeof agentNameSchema>;

export const runStatusSchema = z.enum(['running', 'succeeded', 'failed', 'timed_out', 'aborted']);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runTriggerSchema = z.enum(['schedule', 'manual', 'catch_up']);
export type RunTrigger = z.infer<typeof runTriggerSchema>;

export const skipReasonSchema = z.enum(['already_running', 'concurrency_limit', 'disabled']);
export type SkipReason = z.infer<typeof skipReasonSchema>;

export const runRecordSchema = z.object({
  id: z.string(),
  routine: z.string(),
  agent: agentNameSchema,
  trigger: runTriggerSchema,
  scheduledFor: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: runStatusSchema,
  pid: z.number().nullable(),
  exitCode: z.number().nullable(),
  sessionId: z.string().nullable(),
  resumeCommand: z.string().nullable(),
  model: z.string().nullable(),
  costUsd: z.number().nullable(),
  numTurns: z.number().nullable(),
  durationMs: z.number().nullable(),
  resultText: z.string().nullable(),
  error: z.string().nullable(),
  logFile: z.string(),
});
export type RunRecord = z.infer<typeof runRecordSchema>;

export const skipSchema = z.object({
  at: z.string(),
  scheduledFor: z.string(),
  reason: skipReasonSchema,
});
export type Skip = z.infer<typeof skipSchema>;

export const schedulerStateSchema = z.object({
  startedAt: z.string(),
  lastTickAt: z.string(),
  routines: z.record(
    z.string(),
    z.object({ lastScheduledFor: z.string().nullable(), skips: z.array(skipSchema) }),
  ),
});
export type SchedulerState = z.infer<typeof schedulerStateSchema>;

export const routineSummarySchema = z.object({
  name: z.string(),
  description: z.string(),
  schedule: z.string().nullable(),
  scheduleHuman: z.string(),
  nextRunAt: z.string().nullable(),
  enabled: z.boolean(),
  agent: agentNameSchema,
  model: z.string().nullable(),
  effort: z.string().nullable(),
  permissionMode: z.string().nullable(),
  command: z.string().nullable(),
  cwd: z.string(),
  timeoutMinutes: z.number(),
  maxBudgetUsd: z.number().nullable(),
  file: z.string(),
  running: z.boolean(),
  lastRun: runRecordSchema.nullable(),
  lastSkip: skipSchema.nullable(),
});
export type RoutineSummary = z.infer<typeof routineSummarySchema>;

export const routineDetailSchema = routineSummarySchema.extend({
  prompt: z.string(),
  runs: z.array(runRecordSchema),
  skips: z.array(skipSchema),
});
export type RoutineDetail = z.infer<typeof routineDetailSchema>;

export const daemonStatusSchema = z.object({
  pid: z.number(),
  startedAt: z.string(),
  lastTickAt: z.string().nullable(),
  routinesDir: z.string(),
  stateDir: z.string(),
  claudeBin: z.string(),
  codexBin: z.string(),
  maxConcurrentRuns: z.number(),
  running: z.number(),
  timezone: z.string(),
  now: z.string(),
});
export type DaemonStatus = z.infer<typeof daemonStatusSchema>;

export const toolResultSchema = z.object({ content: z.string(), isError: z.boolean() });
export type ToolResult = z.infer<typeof toolResultSchema>;

const hookItemSchema = z.object({
  kind: z.literal('hook'),
  key: z.string(),
  command: z.string(),
  exitCode: z.number().nullable(),
  output: z.string(),
});

const initItemSchema = z.object({
  kind: z.literal('init'),
  key: z.string(),
  model: z.string().nullable(),
  cwd: z.string().nullable(),
  toolCount: z.number().nullable(),
  permissionMode: z.string().nullable(),
});

const textItemSchema = z.object({
  kind: z.literal('text'),
  key: z.string(),
  text: z.string(),
  isSubagent: z.boolean(),
});

const toolItemSchema = z.object({
  kind: z.literal('tool'),
  key: z.string(),
  id: z.string(),
  name: z.string(),
  input: z.unknown().optional(),
  preview: z.string(),
  result: toolResultSchema.nullable(),
  isSubagent: z.boolean(),
});

const resultItemSchema = z.object({
  kind: z.literal('result'),
  key: z.string(),
  text: z.string(),
  isError: z.boolean(),
  costUsd: z.number().nullable(),
  numTurns: z.number().nullable(),
  durationMs: z.number().nullable(),
});

export const transcriptItemSchema = z.discriminatedUnion('kind', [
  hookItemSchema,
  initItemSchema,
  textItemSchema,
  toolItemSchema,
  resultItemSchema,
]);
export type TranscriptItem = z.infer<typeof transcriptItemSchema>;
export type HookItem = z.infer<typeof hookItemSchema>;
export type InitItem = z.infer<typeof initItemSchema>;
export type TextItem = z.infer<typeof textItemSchema>;
export type ToolItem = z.infer<typeof toolItemSchema>;
export type ResultItem = z.infer<typeof resultItemSchema>;

export const transcriptSchema = z.object({
  eventCount: z.number(),
  items: z.array(transcriptItemSchema),
});
export type Transcript = z.infer<typeof transcriptSchema>;

const calendarEntryBase = {
  id: z.string(),
  routine: z.string(),
  start: z.string(),
  end: z.string(),
  estimated: z.boolean(),
  overlaps: z.array(z.string()),
};

const runCalendarEntrySchema = z.object({
  ...calendarEntryBase,
  kind: z.literal('run'),
  status: runStatusSchema,
  runId: z.string(),
  trigger: runTriggerSchema,
});

const plannedCalendarEntrySchema = z.object({
  ...calendarEntryBase,
  kind: z.literal('planned'),
  status: z.null(),
  runId: z.null(),
  trigger: z.null(),
});

export const calendarEntrySchema = z.discriminatedUnion('kind', [
  runCalendarEntrySchema,
  plannedCalendarEntrySchema,
]);
export type CalendarEntry = z.infer<typeof calendarEntrySchema>;
export type RunCalendarEntry = z.infer<typeof runCalendarEntrySchema>;
export type PlannedCalendarEntry = z.infer<typeof plannedCalendarEntrySchema>;

export const startedRunSchema = z.object({ ok: z.literal(true) });

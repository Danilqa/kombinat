import { z } from 'zod';

import { accountNameSchema, sessionIdSchema } from '../agent/ids';
import { agentNameSchema } from '../agent/schemas';
import { routineNameSchema } from '../routine/ids';
import { usageLimitKindSchema } from '../transcript/schemas';
import { runIdSchema } from './ids';

export const runStatusSchema = z.enum([
  'running',
  'waiting',
  'retrying',
  'succeeded',
  'failed',
  'timed_out',
  'aborted',
]);

export const usageLimitWaitSchema = z.object({
  limit: usageLimitKindSchema,
  stoppedAt: z.string(),
  continuesAt: z.string(),
});

// The attempt that runs or comes next after an error, with why the one before it stopped.
export const runRetrySchema = z.object({
  attempt: z.number(),
  attempts: z.number(),
  error: z.string(),
  stoppedAt: z.string(),
  continuesAt: z.string(),
  // false when the next attempt starts over, without a session to continue.
  continuesSession: z.boolean(),
});

export const tokenCountsSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheWrite: z.number(),
  cacheRead: z.number(),
});

// An action the agent wanted to take but nobody was there to approve, with the rules that allow it.
export const blockedActionSchema = z.object({
  tool: z.string(),
  preview: z.string(),
  rules: z.array(z.string()),
});

export const runTriggerSchema = z.enum(['schedule', 'manual', 'catch_up', 'webhook', 'chain']);

// How the run of a routine ended for the routine that starts after it to start.
export const chainConditionSchema = z.enum(['finishes', 'succeeds', 'fails', 'has-findings']);

// A run of a start that makes several, waiting for a slot of its own.
export const queuedRunSchema = z.object({
  routine: routineNameSchema,
  id: runIdSchema,
  trigger: runTriggerSchema,
  scheduledFor: z.string().nullable(),
  // How many runs of the routine may work at once while this one waits.
  maxParallel: z.number(),
  queuedAt: z.string(),
});

export const queuedRunsFileSchema = z.object({ runs: z.array(queuedRunSchema) });

// removed: the folder is gone and the branch stays. discarded: nothing changed, so both are gone.
export const worktreeStateSchema = z.enum(['present', 'removed', 'discarded']);

export const changedFileSchema = z.object({
  path: z.string(),
  // null for a binary file and for a new file that is not committed.
  added: z.number().nullable(),
  removed: z.number().nullable(),
});

export const worktreeChangesSchema = z.object({
  // The first files by path, while the counts cover them all.
  files: z.array(changedFileSchema),
  fileCount: z.number(),
  added: z.number(),
  removed: z.number(),
  commits: z.number(),
  uncommitted: z.number(),
});

export const runWorktreeSchema = z.object({
  branch: z.string(),
  path: z.string(),
  // Where the agent starts: the folder of the routine's cwd inside the worktree.
  cwd: z.string(),
  checkout: z.string(),
  base: z.string(),
  baseCommit: z.string(),
  changes: worktreeChangesSchema.nullable(),
  state: worktreeStateSchema,
});

export const runRecordSchema = z.object({
  id: runIdSchema,
  routine: routineNameSchema,
  agent: agentNameSchema,
  // The login the run works on, null for the primary one, which older records ran on.
  account: accountNameSchema.nullable().default(null),
  trigger: runTriggerSchema,
  scheduledFor: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: runStatusSchema,
  pid: z.number().nullable(),
  exitCode: z.number().nullable(),
  sessionId: sessionIdSchema.nullable(),
  resumeCommand: z.string().nullable(),
  model: z.string().nullable(),
  costUsd: z.number().nullable(),
  numTurns: z.number().nullable(),
  durationMs: z.number().nullable(),
  resultText: z.string().nullable(),
  error: z.string().nullable(),
  logFile: z.string(),
  // Records written before runs could be continued have no replyPid.
  replyPid: z.number().nullable().default(null),
  // Records written before webhooks could continue runs have no conversation.
  conversation: z.string().nullable().default(null),
  // Set while the run waits for a usage limit to reset. Older records have none.
  usageLimit: usageLimitWaitSchema.nullable().default(null),
  // Set from the first retry after an error. Older records have none.
  retry: runRetrySchema.nullable().default(null),
  // Records written before runs saved their tokens have none.
  tokens: tokenCountsSchema.nullable().default(null),
  // Records written before runs saved what was blocked have none.
  blockedActions: z.array(blockedActionSchema).default([]),
  // When a reply last sent the routine's memory notes to the session. Until then, it has none.
  memorySentAt: z.string().nullable().default(null),
  // Records written before runs could have a worktree have none.
  worktree: runWorktreeSchema.nullable().default(null),
});

export const tokenDaySchema = z.object({ date: z.string(), total: z.number() });

export const tokenUsageSchema = z.object({
  runs: z.number(),
  counts: tokenCountsSchema,
  days: z.array(tokenDaySchema),
  share: z.number(),
});

export const runMessageSchema = z.object({ text: z.string().trim().min(1) });

export const sentRunMessageSchema = z.object({ ok: z.literal(true) });

export const removedWorktreeSchema = z.object({ ok: z.literal(true) });

export const usageLimitWaitActionSchema = z.enum(['continue', 'stop']);

export const sentWaitActionSchema = z.object({ ok: z.literal(true) });

export const runsCursorSchema = z.string().brand<'RunsCursor'>();

export const runsCursorKeySchema = z.object({
  startedAt: z.string(),
  routine: routineNameSchema,
  id: runIdSchema,
});

export const runsPageSchema = z.object({
  runs: z.array(runRecordSchema),
  nextCursor: runsCursorSchema.nullable(),
  total: z.number(),
});

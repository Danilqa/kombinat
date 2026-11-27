import type { z } from 'zod';

import type { RoutineName } from '../routine/ids';
import type { Transcript } from '../transcript/types';
import type {
  blockedActionSchema,
  chainConditionSchema,
  changedFileSchema,
  queuedRunSchema,
  runRecordSchema,
  runRetrySchema,
  runsCursorKeySchema,
  runsCursorSchema,
  runsPageSchema,
  runStatusSchema,
  runTriggerSchema,
  runWorktreeSchema,
  tokenCountsSchema,
  tokenDaySchema,
  tokenUsageSchema,
  usageLimitWaitActionSchema,
  usageLimitWaitSchema,
  worktreeChangesSchema,
} from './schemas';

export type BlockedAction = z.infer<typeof blockedActionSchema>;
export type ChainCondition = z.infer<typeof chainConditionSchema>;
export type QueuedRun = z.infer<typeof queuedRunSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
// The names are the variants of the design-system Badge, which draws a status in its tone.
export type RunStatusTone = 'positive' | 'negative' | 'warning' | 'info' | 'ghost';
export type RunTrigger = z.infer<typeof runTriggerSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type RunRetry = z.infer<typeof runRetrySchema>;
export type RunsCursor = z.infer<typeof runsCursorSchema>;
export type RunsCursorKey = z.infer<typeof runsCursorKeySchema>;
export type RunsPage = z.infer<typeof runsPageSchema>;
export type TokenCounts = z.infer<typeof tokenCountsSchema>;
export type TokenDay = z.infer<typeof tokenDaySchema>;
export type TokenUsage = z.infer<typeof tokenUsageSchema>;
export type UsageLimitWait = z.infer<typeof usageLimitWaitSchema>;
export type UsageLimitWaitAction = z.infer<typeof usageLimitWaitActionSchema>;
export type ChangedFile = z.infer<typeof changedFileSchema>;
export type WorktreeChanges = z.infer<typeof worktreeChangesSchema>;
export type RunWorktree = z.infer<typeof runWorktreeSchema>;

export interface RunsPageQuery {
  routine: RoutineName | null;
  cursor: RunsCursorKey | null;
  search: string | null;
}

export interface WorktreeBaseStep {
  verb: 'push' | 'commit';
  // null when the worktree started from a commit that no branch named.
  branch: string | null;
}

export interface RunWithTranscript {
  run: RunRecord;
  transcript: Transcript;
}

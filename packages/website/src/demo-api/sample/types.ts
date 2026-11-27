import type { AccountName } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';
import type { RoutineName } from 'domains/routine/ids';
import type { BlockedAction, ChangedFile, RunStatus } from 'domains/run/types';
import type { SkipReason } from 'domains/scheduler/types';
import type { UsageLimitKind } from 'domains/transcript/types';
import type { WebhookCallOutcome } from 'domains/webhook/types';

import type { TranscriptStep } from './steps';

export type FinishedStatus = Exclude<RunStatus, 'running' | 'waiting' | 'retrying'>;

// The agent stops at a usage limit after this many steps and continues once it resets.
export interface DemoUsageLimit {
  limit: UsageLimitKind;
  afterStep: number;
  waitMinutes: number;
}

// The first attempt stops with this error after this many steps, and the second continues its session.
export interface DemoRetry {
  error: string;
  afterStep: number;
}

export interface DemoOutcome {
  id: string;
  // How often a scheduled run ends this way. Outcomes that only pins use have 0.
  weight: number;
  status: FinishedStatus;
  minutes: number;
  costUsd?: number;
  numTurns?: number;
  resultText?: string;
  error?: string;
  exitCode?: number | null;
  model?: string;
  usageLimit?: DemoUsageLimit;
  retry?: DemoRetry;
  blockedActions?: BlockedAction[];
  // What the routine's check printed before a scheduled run of this outcome started.
  checkOutput?: string;
  // The files a worktree run committed. A worktree run without them changed nothing.
  changedFiles?: ChangedFile[];
  steps: TranscriptStep[];
}

export interface DemoPin {
  // 0 is the latest scheduled time before the page loaded.
  slotsAgo: number;
  outcome?: string;
  lateMinutes?: number;
  skip?: SkipReason;
}

export interface DemoCheck {
  command: string;
  // A scheduled time that would end with this outcome is skipped instead, since the check found nothing to do.
  skipsOutcome: string;
  skipOutput: string;
}

export interface DemoOneTimeRun {
  minutesAhead: number;
}

export interface DemoStartedRun {
  minutesAgo: number;
  outcome: string;
  // The body of the webhook that started it.
  payload?: string;
}

export interface DemoQueuedWebhook {
  minutesAgo: number;
  payload: string;
}

// A webhook call that started no run.
export interface DemoWebhookCall {
  minutesAgo: number;
  outcome: WebhookCallOutcome;
  status: number;
  reason?: string;
  payload: string;
}

// Notes that the routine's last finished run left, with the lines it changed.
export interface DemoMemory {
  text: string;
  added: number;
  removed: number;
}

export interface DemoRoutine {
  name: RoutineName;
  description: string;
  schedule: string | null;
  enabled: boolean;
  webhook?: boolean;
  webhookGate?: string;
  check?: DemoCheck;
  agent: AgentName;
  account?: AccountName;
  model: string | null;
  fallbackModel?: string;
  effort: string | null;
  permissionMode: string | null;
  command: string | null;
  cwd: string;
  timeoutMinutes: number;
  retries?: number;
  runs?: number;
  maxParallel?: number;
  worktree?: boolean;
  maxBudgetUsd: number | null;
  maxBudgetTokens?: number;
  prompt: string;
  runModel: string | null;
  disabledDaysAgo?: number;
  outcomes: DemoOutcome[];
  pins?: DemoPin[];
  manualRuns?: DemoStartedRun[];
  webhookRuns?: DemoStartedRun[];
  queuedWebhooks?: DemoQueuedWebhook[];
  webhookCalls?: DemoWebhookCall[];
  oneTimeRuns?: DemoOneTimeRun[];
  memory?: DemoMemory;
}

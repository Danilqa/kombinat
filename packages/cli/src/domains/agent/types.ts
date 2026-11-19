import type { z } from 'zod';

import type { SessionId } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';
import type { PlanLimits } from 'domains/daemon/types';
import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { RunRecord, RunTrigger } from 'domains/run/types';
import type { MessageSource, TranscriptItem, UsageLimitKind } from 'domains/transcript/types';

import type { outputEventSchema } from './schemas';

export type OutputEvent = z.infer<typeof outputEventSchema>;

export interface AgentSettings {
  model: string | null;
  fallbackModel: string | null;
  effort: string | null;
  permissionMode: string | null;
  command: string | null;
  maxBudgetUsd: number | null;
  onUsageLimit: string | null;
}

export interface AgentTask extends AgentSettings {
  name: RoutineName;
  prompt: string;
}

export interface RunContext {
  routine: AgentTask;
  runId: RunId;
  trigger: RunTrigger;
}

// A run that waited out a usage limit continues its session without a message.
export type ReplySource = MessageSource | 'usage_limit';

export interface ReplyMessage {
  text: string;
  source: ReplySource;
}

export interface UsageLimitStop {
  limit: UsageLimitKind;
  resetsAt: string;
}

export interface Invocation {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  input: string;
}

export type RunUpdate = Partial<
  Pick<
    RunRecord,
    'sessionId' | 'model' | 'resultText' | 'costUsd' | 'numTurns' | 'durationMs' | 'error'
  >
>;

// jsonl: stdout is an event stream written to the log as is. text: plain output, one event per line.
export type OutputFormat = 'jsonl' | 'text';

export interface Agent {
  readonly name: AgentName;
  readonly output: OutputFormat;
  readonly binaryEnv: string | null;
  resolveSettings(raw: AgentSettings): AgentSettings;
  buildInvocation(context: RunContext): Invocation;
  buildReplyInvocation(
    context: RunContext,
    sessionId: SessionId,
    message: ReplyMessage,
  ): Invocation | null;
  readEvent(event: unknown, record: Readonly<RunRecord>): RunUpdate;
  readPlanLimits(event: unknown): PlanLimits | null;
  findUsageLimitStop(events: unknown[]): UsageLimitStop | null;
  buildTranscript(events: unknown[]): TranscriptItem[];
  getResumeCommand(sessionId: SessionId): string | null;
}

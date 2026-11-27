import type { z } from 'zod';

import type { AccountName, SessionId } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';
import type { PlanLimits } from 'domains/daemon/types';
import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { BlockedAction, RunRecord, RunTrigger, TokenCounts } from 'domains/run/types';
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
  maxBudgetTokens: number | null;
  onUsageLimit: string | null;
  account: AccountName | null;
  agentCanFail: boolean;
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

// A run that waited out a usage limit or retries after an error continues its session without a message.
export type ReplySource = MessageSource | 'usage_limit' | 'retry';

interface ReplyMessage {
  text: string;
  source: ReplySource;
  // Permission rules that let the reply do what the run was blocked from.
  allowedTools?: string[] | undefined;
}

export interface UsageLimitStop {
  limit: UsageLimitKind;
  resetsAt: string;
}

// The tokens of one model call, which the agent may report again as its message streams.
interface CallTokens {
  id: string;
  tokens: TokenCounts;
}

// Where an agent keeps a login: the variable that points to its folder and the folder's name in the home folder.
export interface AccountHome {
  env: string;
  folder: string;
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
    | 'sessionId'
    | 'model'
    | 'resultText'
    | 'costUsd'
    | 'numTurns'
    | 'durationMs'
    | 'tokens'
    | 'error'
  >
>;

// jsonl: stdout is an event stream written to the log as is. text: plain output, one event per line.
type OutputFormat = 'jsonl' | 'text';

export interface Agent {
  readonly name: AgentName;
  readonly output: OutputFormat;
  readonly binaryEnv: string | null;
  readonly accountHome: AccountHome | null;
  resolveSettings(raw: AgentSettings): AgentSettings;
  buildInvocation(context: RunContext): Invocation;
  buildLoginInvocation(account: AccountName | null): Invocation | null;
  buildLoginStatusInvocation(account: AccountName | null): Invocation | null;
  buildReplyInvocation(
    context: RunContext,
    sessionId: SessionId,
    message: ReplyMessage,
  ): Invocation | null;
  readEvent(event: unknown, record: Readonly<RunRecord>): RunUpdate;
  readPlanLimits(event: unknown): PlanLimits | null;
  readCallTokens(event: unknown): CallTokens | null;
  findUsageLimitStop(events: unknown[]): UsageLimitStop | null;
  checkIsStoppedByBudget(events: unknown[]): boolean;
  checkIsFailedByAgent(events: unknown[]): boolean;
  readBlockedActions(events: unknown[]): BlockedAction[];
  buildTranscript(events: unknown[]): TranscriptItem[];
  getResumeCommand(sessionId: SessionId, account: AccountName | null): string | null;
}

import type { Routine } from '../routines';
import type { AgentName, RunRecord, RunTrigger, TranscriptItem } from '../shared/contract';

export type { AgentName } from '../shared/contract';

export interface AgentSettings {
  model: string | null;
  effort: string | null;
  permissionMode: string | null;
  command: string | null;
  maxBudgetUsd: number | null;
}

export interface RunContext {
  routine: Routine;
  runId: string;
  trigger: RunTrigger;
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
  readEvent(event: unknown, record: Readonly<RunRecord>): RunUpdate;
  buildTranscript(events: unknown[]): TranscriptItem[];
  getResumeCommand(sessionId: string): string | null;
}

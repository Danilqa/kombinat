export type RunStatus = 'running' | 'succeeded' | 'failed' | 'timed_out' | 'aborted';
export type RunTrigger = 'schedule' | 'manual' | 'catch_up';
export type SkipReason = 'already_running' | 'concurrency_limit' | 'disabled';
export type AgentName = 'claude' | 'codex' | 'command';

export interface RunRecord {
  id: string;
  routine: string;
  agent: AgentName;
  trigger: RunTrigger;
  scheduledFor: string | null;
  startedAt: string;
  endedAt: string | null;
  status: RunStatus;
  pid: number | null;
  exitCode: number | null;
  sessionId: string | null;
  resumeCommand: string | null;
  model: string | null;
  costUsd: number | null;
  numTurns: number | null;
  durationMs: number | null;
  resultText: string | null;
  error: string | null;
  logFile: string;
}

export interface Skip {
  at: string;
  scheduledFor: string;
  reason: SkipReason;
}

export interface RoutineSummary {
  name: string;
  description: string;
  schedule: string | null;
  scheduleHuman: string;
  nextRunAt: string | null;
  enabled: boolean;
  agent: AgentName;
  model: string | null;
  effort: string | null;
  permissionMode: string | null;
  command: string | null;
  cwd: string;
  timeoutMinutes: number;
  maxBudgetUsd: number | null;
  file: string;
  running: boolean;
  lastRun: RunRecord | null;
  lastSkip: Skip | null;
}

export interface RoutineDetail extends RoutineSummary {
  prompt: string;
  runs: RunRecord[];
  skips: Skip[];
}

export interface DaemonStatus {
  pid: number;
  startedAt: string;
  lastTickAt: string | null;
  routinesDir: string;
  stateDir: string;
  claudeBin: string;
  codexBin: string;
  maxConcurrentRuns: number;
  running: number;
  timezone: string;
  now: string;
}

export interface ToolResult {
  content: string;
  isError: boolean;
}

export interface HookItem {
  kind: 'hook';
  key: string;
  command: string;
  exitCode: number | null;
  output: string;
}

export interface InitItem {
  kind: 'init';
  key: string;
  model: string | null;
  cwd: string | null;
  toolCount: number | null;
  permissionMode: string | null;
}

export interface TextItem {
  kind: 'text';
  key: string;
  text: string;
  isSubagent: boolean;
}

export interface ToolItem {
  kind: 'tool';
  key: string;
  id: string;
  name: string;
  input: unknown;
  preview: string;
  result: ToolResult | null;
  isSubagent: boolean;
}

export interface ResultItem {
  kind: 'result';
  key: string;
  text: string;
  isError: boolean;
  costUsd: number | null;
  numTurns: number | null;
  durationMs: number | null;
}

export type TranscriptItem = HookItem | InitItem | TextItem | ToolItem | ResultItem;

export interface Transcript {
  eventCount: number;
  items: TranscriptItem[];
}

interface CalendarEntryBase {
  id: string;
  routine: string;
  start: string;
  end: string;
  estimated: boolean;
  overlaps: string[];
}

export interface RunCalendarEntry extends CalendarEntryBase {
  kind: 'run';
  status: RunStatus;
  runId: string;
  trigger: RunTrigger;
}

export interface PlannedCalendarEntry extends CalendarEntryBase {
  kind: 'planned';
  status: null;
  runId: null;
  trigger: null;
}

export type CalendarEntry = RunCalendarEntry | PlannedCalendarEntry;

interface ErrorBody {
  error?: string;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return body?.error ?? `${response.status} ${response.statusText}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as T;
}

function encode(segment: string): string {
  return encodeURIComponent(segment);
}

export function getStatus(): Promise<DaemonStatus> {
  return fetchJson('/api/status');
}

export function getRoutines(): Promise<RoutineSummary[]> {
  return fetchJson('/api/routines');
}

export function getRoutine(name: string): Promise<RoutineDetail> {
  return fetchJson(`/api/routines/${encode(name)}`);
}

export function getRuns(limit: number): Promise<RunRecord[]> {
  return fetchJson(`/api/runs?limit=${limit}`);
}

export function getRun(routine: string, id: string): Promise<RunRecord> {
  return fetchJson(`/api/runs/${encode(routine)}/${encode(id)}`);
}

export function getRunTranscript(routine: string, id: string): Promise<Transcript> {
  return fetchJson(`/api/runs/${encode(routine)}/${encode(id)}/transcript`);
}

export async function startRoutineRun(name: string): Promise<void> {
  await fetchJson<{ ok: true }>(`/api/routines/${encode(name)}/run`, { method: 'POST' });
}

export function fetchCalendar(from: Date, to: Date): Promise<CalendarEntry[]> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return fetchJson(`/api/calendar?${params.toString()}`);
}

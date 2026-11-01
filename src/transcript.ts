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

export interface BeforeHookEvent {
  type: 'before_hook';
  command: string;
  exitCode: number | null;
  output: string;
}

export interface OutputEvent {
  type: 'output';
  text: string;
}

const PREVIEW_LENGTH = 160;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBeforeHookEvent(event: unknown): event is BeforeHookEvent {
  return isRecord(event) && event['type'] === 'before_hook';
}

export function isOutputEvent(event: unknown): event is OutputEvent {
  return isRecord(event) && event['type'] === 'output' && typeof event['text'] === 'string';
}

export function toPreview(value: string): string {
  const firstLine = value.split('\n')[0] ?? '';
  return firstLine.length > PREVIEW_LENGTH
    ? `${firstLine.slice(0, PREVIEW_LENGTH - 1)}…`
    : firstLine;
}

export function toHookItem(event: BeforeHookEvent, index: number): HookItem {
  return {
    kind: 'hook',
    key: `hook-${index}`,
    command: event.command,
    exitCode: event.exitCode,
    output: event.output,
  };
}

export function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return undefined;
  }
}

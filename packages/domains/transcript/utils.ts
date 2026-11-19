import { match } from 'ts-pattern';

import { countSearchMatches } from 'utils/search';

import type { HookPhase, MessageSource, ToolItem, TranscriptItem } from './types';

const PREVIEW_LENGTH = 160;

export function toPreview(value: string): string {
  const firstLine = value.split('\n')[0] ?? '';
  return firstLine.length > PREVIEW_LENGTH
    ? `${firstLine.slice(0, PREVIEW_LENGTH - 1)}…`
    : firstLine;
}

export function checkIsSubagent(item: TranscriptItem): boolean {
  return 'isSubagent' in item && item.isSubagent;
}

export function formatToolInput(item: ToolItem): string {
  return item.input === undefined ? '' : JSON.stringify(item.input, null, 2);
}

export function getToolResultText(item: ToolItem): string {
  return item.result ? item.result.content || '(empty)' : 'No result yet';
}

// The collapsed row shows the name, so only the input and result hold matches that it hides.
export function countToolSearchMatches(item: ToolItem, search: string): number {
  return (
    countSearchMatches(formatToolInput(item), search) +
    countSearchMatches(getToolResultText(item), search)
  );
}

export function getTranscriptEmptyLabel(isRunning: boolean): string {
  return isRunning ? 'Waiting for the first events…' : 'No transcript events.';
}

export function getTranscriptResultLabel(isError: boolean): string {
  return isError ? 'Finished with error' : 'Finished';
}

export function getTurnsLabel(numTurns: number | null): string {
  return numTurns === 1 ? 'turn' : 'turns';
}

export function getModelFallbackReasonLabel(reason: string | null): string | null {
  if (reason === null) return null;
  return match(reason)
    .with('model_not_found', () => 'the model is not available')
    .with('permission_denied', () => 'the account has no access to the model')
    .with('overloaded', () => 'the model is overloaded')
    .with('server_error', () => 'the server returned errors')
    .with('model_blocked', () => 'the model is turned off')
    .with('last_resort', () => 'the model failed')
    .otherwise(() => reason);
}

export function getHookLabel(phase: HookPhase): string {
  return match(phase)
    .with('before', () => 'Before hook')
    .with('after', () => 'After hook')
    .exhaustive();
}

// Messages from the dashboard are the reader's own, so only other senders get a label.
export function getMessageSourceLabel(source: MessageSource): string | null {
  return match(source)
    .with('dashboard', () => null)
    .with('webhook', () => 'From a webhook')
    .exhaustive();
}

import { match } from 'ts-pattern';

import type { TranscriptItem } from './types';

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

export function getTranscriptEmptyLabel(isRunning: boolean): string {
  return isRunning ? 'Waiting for the first events…' : 'No transcript events.';
}

export function getTranscriptResultLabel(isError: boolean): string {
  return isError ? 'Finished with error' : 'Finished';
}

export function getModelFallbackReasonLabel(reason: string | null): string | null {
  if (reason === null) return null;
  return match(reason)
    .with('model_not_found', () => 'the model is not available')
    .with('permission_denied', () => 'no access to the model')
    .with('overloaded', () => 'the model is overloaded')
    .with('server_error', () => 'server errors')
    .with('model_blocked', () => 'the model is turned off')
    .with('last_resort', () => 'the model failed')
    .otherwise(() => reason);
}

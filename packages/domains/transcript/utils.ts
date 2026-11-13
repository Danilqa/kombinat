import { match } from 'ts-pattern';

import type { HookPhase, TranscriptItem } from './types';

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

export function getHookLabel(phase: HookPhase): string {
  return match(phase)
    .with('before', () => 'Before hook')
    .with('after', () => 'After hook')
    .exhaustive();
}

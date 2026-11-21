import { match } from 'ts-pattern';

import type { RunId } from '../run/ids';
import type { MemoryChange, RoutineMemory } from './types';

interface ChangedLines {
  added: number;
  removed: number;
}

export function getMemoryChangeVerb(memory: RoutineMemory): string {
  return memory.text === '' ? 'Cleared' : 'Updated';
}

export function getMemoryAuthorLabel(change: MemoryChange, lastRunId: RunId | null): string {
  return match(change.by)
    .with('user', () => 'you')
    .with('run', () => (change.runId === lastRunId ? 'the last run' : 'an earlier run'))
    .exhaustive();
}

function toLines(text: string): string[] {
  return text.split('\n').filter(line => line.trim() !== '');
}

function countNewLines(text: string, comparedTo: string): number {
  const old = new Map<string, number>();
  for (const line of toLines(comparedTo)) old.set(line, (old.get(line) ?? 0) + 1);
  let count = 0;
  for (const line of toLines(text)) {
    const left = old.get(line) ?? 0;
    if (left === 0) count += 1;
    else old.set(line, left - 1);
  }
  return count;
}

// Blank lines do not count, and a moved line counts as kept.
export function countChangedLines(before: string, after: string): ChangedLines {
  return { added: countNewLines(after, before), removed: countNewLines(before, after) };
}

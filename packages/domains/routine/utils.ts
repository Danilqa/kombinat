import { match } from 'ts-pattern';

import { describeCron, parseCron } from 'utils/cron';

import type { RunId } from '../run/ids';
import type {
  MemoryChange,
  RoutineMemory,
  RoutineTemplateCategory,
  RoutineTemplateNeed,
} from './types';

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

export function getTemplateCategoryLabel(category: RoutineTemplateCategory): string {
  return match(category)
    .with('code', () => 'Code')
    .with('watch', () => 'Watch')
    .with('reports', () => 'Reports')
    .with('home', () => 'Home')
    .exhaustive();
}

export function getTemplateNeedLabel(need: RoutineTemplateNeed): string {
  return match(need)
    .with('git-repository', () => 'Git repository')
    .with('github-cli', () => 'GitHub CLI')
    .exhaustive();
}

// A schedule as a routine file writes it: a cron, or manual. null when it is neither.
export function describeScheduleValue(schedule: string): string | null {
  const value = schedule.trim();
  if (value === 'manual') return 'Manual';
  try {
    parseCron(value);
  } catch {
    return null;
  }
  return describeCron(value);
}

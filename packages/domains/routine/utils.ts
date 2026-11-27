import { match } from 'ts-pattern';

import { describeCron, parseCron } from 'utils/cron';

import type { AgentName } from '../agent/types';
import type { RunId } from '../run/ids';
import type { RoutineName } from './ids';
import type {
  ChainedRoutine,
  MemoryChange,
  RoutineMemory,
  RoutineTemplate,
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
    .with('product', () => 'Product')
    .with('watch', () => 'Watch')
    .with('reports', () => 'Reports')
    .with('home', () => 'Home')
    .exhaustive();
}

export function getTemplateNeedLabel(need: RoutineTemplateNeed): string {
  return match(need)
    .with('git-repository', () => 'Git repository')
    .with('github-cli', () => 'GitHub CLI')
    .with('macos', () => 'macOS')
    .exhaustive();
}

// A command takes no prompt, model or memory, so a template never changes to one or from one.
export function checkCanUseAgent(template: RoutineTemplate, agent: AgentName): boolean {
  if (agent === template.agent) return true;
  return match(agent)
    .with('claude', 'codex', () => template.command === null)
    .with('command', () => false)
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

function findChainStart(routines: ChainedRoutine[], name: RoutineName): RoutineName {
  const parents = new Map(routines.map(routine => [routine.name, routine.startsAfter]));
  const visited = new Set<RoutineName>();
  let start = name;
  let parent = parents.get(start);
  while (parent !== undefined && parent !== null && parents.has(parent) && !visited.has(parent)) {
    visited.add(start);
    start = parent;
    parent = parents.get(start);
  }
  return start;
}

// From the first routine of the chain, each one before the routines that start after it. Empty
// when no routine starts after this one or before it.
export function listChain<T extends ChainedRoutine>(routines: T[], name: RoutineName): T[] {
  const chain: T[] = [];
  const visit = (current: RoutineName) => {
    const routine = routines.find(candidate => candidate.name === current);
    if (routine === undefined || chain.includes(routine)) return;
    chain.push(routine);
    for (const next of routines) if (next.startsAfter === current) visit(next.name);
  };
  visit(findChainStart(routines, name));
  return chain.length > 1 ? chain : [];
}

// Each loop once, in the order its routines would start: [b, a] when a starts after b and b after a.
export function listChainLoops(routines: ChainedRoutine[]): RoutineName[][] {
  const parents = new Map(routines.map(routine => [routine.name, routine.startsAfter]));
  const looped = new Set<RoutineName>();
  const loops: RoutineName[][] = [];
  for (const routine of routines) {
    const path: RoutineName[] = [];
    let current: RoutineName | null | undefined = routine.name;
    while (current !== undefined && current !== null && !path.includes(current)) {
      if (looped.has(current)) break;
      path.push(current);
      current = parents.get(current);
    }
    if (current === undefined || current === null || looped.has(current)) continue;
    const loop = path.slice(path.indexOf(current)).toReversed();
    for (const name of loop) looped.add(name);
    loops.push(loop);
  }
  return loops;
}

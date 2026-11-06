import fs from 'node:fs';
import path from 'node:path';

import type {
  AgentName,
  RunRecord,
  SchedulerState,
  SkipReason,
} from '../../../cli/src/shared/contract';
import { createRunId } from '../../../cli/src/state';
import { makeRunRecord } from '../../../cli/src/testing';
import { minutesAgo } from './time';

export interface RoutineFile {
  name: string;
  description?: string;
  schedule?: string;
  agent?: AgentName;
  model?: string;
  effort?: string;
  permissionMode?: string;
  command?: string;
  enabled?: boolean;
  timeoutMinutes?: number;
  maxBudgetUsd?: number;
  prompt?: string;
}

export interface RunFile extends Partial<Omit<RunRecord, 'routine' | 'logFile'>> {
  routine: string;
  events?: unknown[];
}

export interface Kombinat {
  addRoutine: (routine: RoutineFile) => void;
  addRun: (run: RunFile) => RunRecord;
  addSkip: (routine: string, reason: SkipReason) => void;
  stallScheduler: () => void;
}

function toRoutineSource({ prompt = 'Do the routine.', ...settings }: RoutineFile, cwd: string) {
  const lines = Object.entries({ schedule: 'manual', cwd, ...settings }).map(
    ([key, value]) => `${key}: ${String(value)}`,
  );
  return `---\n${lines.join('\n')}\n---\n\n${prompt}\n`;
}

export function createKombinat(root: string): Kombinat {
  const routinesDir = path.join(root, 'routines');
  const stateDir = path.join(root, 'state');
  for (const dir of [routinesDir, stateDir]) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(routinesDir, { recursive: true });
  fs.mkdirSync(path.join(stateDir, 'runs'), { recursive: true });

  const now = new Date().toISOString();
  const scheduler: SchedulerState = { startedAt: now, lastTickAt: now, routines: {} };
  const saveScheduler = () =>
    fs.writeFileSync(path.join(stateDir, 'scheduler.json'), JSON.stringify(scheduler));
  saveScheduler();

  return {
    addRoutine: routine => {
      fs.writeFileSync(
        path.join(routinesDir, `${routine.name}.md`),
        toRoutineSource(routine, root),
      );
    },
    addRun: ({ events = [], ...run }) => {
      const startedAt = run.startedAt ?? minutesAgo(60);
      const id = run.id ?? createRunId(new Date(startedAt));
      const runsDir = path.join(stateDir, 'runs', run.routine);
      const record = makeRunRecord({
        status: 'succeeded',
        trigger: 'schedule',
        endedAt: new Date(new Date(startedAt).getTime() + 5 * 60_000).toISOString(),
        exitCode: 0,
        ...run,
        id,
        startedAt,
        logFile: path.join(runsDir, `${id}.jsonl`),
      });
      fs.mkdirSync(runsDir, { recursive: true });
      fs.writeFileSync(path.join(runsDir, `${id}.json`), JSON.stringify(record));
      fs.writeFileSync(record.logFile, events.map(event => `${JSON.stringify(event)}\n`).join(''));
      return record;
    },
    addSkip: (routine, reason) => {
      const entry = (scheduler.routines[routine] ??= { lastScheduledFor: null, skips: [] });
      entry.skips.push({ at: minutesAgo(30), scheduledFor: minutesAgo(30), reason });
      saveScheduler();
    },
    stallScheduler: () => {
      scheduler.lastTickAt = minutesAgo(10);
      saveScheduler();
    },
  };
}

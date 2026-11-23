import fs from 'node:fs';
import path from 'node:path';

import { sessionIdSchema } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';
import type { InboxState } from 'domains/inbox/types';
import { routineNameSchema } from 'domains/routine/ids';
import type { MemoryChange } from 'domains/routine/types';
import { makeRunRecord } from 'domains/run/mocks';
import type { RunRecord, RunWorktree } from 'domains/run/types';
import { createRunId } from 'domains/run/utils';
import type { SchedulerState, SkipReason } from 'domains/scheduler/types';

import { createWorktree, inspectWorktree } from './git';
import type { WorktreeFile, WorktreeOnDisk } from './git';
import { minutesAgo } from './time';

export interface RoutineFile {
  name: string;
  description?: string;
  schedule?: string;
  agent?: AgentName;
  model?: string;
  fallbackModel?: string;
  effort?: string;
  permissionMode?: string;
  command?: string;
  enabled?: boolean;
  webhook?: boolean;
  webhookGate?: string;
  check?: string;
  timeoutMinutes?: number;
  runs?: number;
  maxParallel?: number;
  worktree?: boolean;
  maxBudgetUsd?: number;
  memory?: boolean;
  prompt?: string;
}

export interface RunFile extends Partial<Omit<RunRecord, 'routine' | 'sessionId' | 'logFile'>> {
  routine: string;
  sessionId?: string;
  events?: unknown[];
}

export interface QueuedWebhookFile {
  routine: string;
  payload: string;
  minutesAgo: number;
}

export interface Kombinat {
  addRoutine: (routine: RoutineFile) => void;
  addRun: (run: RunFile) => RunRecord;
  addSkip: (routine: string, reason: SkipReason, checkOutput?: string) => void;
  addQueuedWebhook: (webhook: QueuedWebhookFile) => void;
  addMemory: (routine: string, text: string, change: MemoryChange) => void;
  readMemory: (routine: string) => string | null;
  addWorktree: (worktree: WorktreeFile) => RunWorktree;
  inspectWorktree: (worktree: RunWorktree) => WorktreeOnDisk;
  lookAtInbox: (at: string) => void;
  stallScheduler: () => void;
}

function toRoutineSource({ prompt = 'Do the routine.', ...settings }: RoutineFile, cwd: string) {
  const lines = Object.entries({ schedule: 'manual', cwd, ...settings }).map(
    ([key, value]) => `${key}: ${String(value)}`,
  );
  return `---\n${lines.join('\n')}\n---\n\n${prompt}\n`;
}

// Folders stay, so the daemon keeps watching them: on Linux a folder removed and made again
// at once stays watched on its old, deleted inode.
function removeFiles(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) removeFiles(file);
    else fs.rmSync(file);
  }
}

export function createKombinat(root: string): Kombinat {
  const routinesDir = path.join(root, 'routines');
  const stateDir = path.join(root, 'state');
  fs.mkdirSync(routinesDir, { recursive: true });
  fs.mkdirSync(path.join(stateDir, 'runs'), { recursive: true });
  for (const dir of [routinesDir, stateDir]) removeFiles(dir);

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
    addRun: ({ events = [], routine, sessionId, ...run }) => {
      const startedAt = run.startedAt ?? minutesAgo(60);
      const id = run.id ?? createRunId(new Date(startedAt));
      const runsDir = path.join(stateDir, 'runs', routine);
      const record = makeRunRecord({
        status: 'succeeded',
        trigger: 'schedule',
        endedAt: new Date(new Date(startedAt).getTime() + 5 * 60_000).toISOString(),
        exitCode: 0,
        ...run,
        id,
        routine: routineNameSchema.parse(routine),
        sessionId: sessionId === undefined ? null : sessionIdSchema.parse(sessionId),
        startedAt,
        logFile: path.join(runsDir, `${id}.jsonl`),
      });
      fs.mkdirSync(runsDir, { recursive: true });
      fs.writeFileSync(path.join(runsDir, `${id}.json`), JSON.stringify(record));
      fs.writeFileSync(record.logFile, events.map(event => `${JSON.stringify(event)}\n`).join(''));
      return record;
    },
    addSkip: (routine, reason, checkOutput) => {
      const entry = (scheduler.routines[routineNameSchema.parse(routine)] ??= {
        lastScheduledFor: null,
        skips: [],
      });
      entry.skips.push({
        at: minutesAgo(30),
        scheduledFor: minutesAgo(30),
        reason,
        checkOutput: checkOutput ?? null,
      });
      saveScheduler();
    },
    addQueuedWebhook: ({ routine, payload, minutesAgo: minutes }) => {
      const queuedAt = new Date(minutesAgo(minutes));
      const queueDir = path.join(stateDir, 'queue', routine);
      const file = `${String(queuedAt.getTime()).padStart(15, '0')}-${createRunId(queuedAt)}.payload`;
      fs.mkdirSync(queueDir, { recursive: true });
      fs.writeFileSync(path.join(queueDir, file), payload);
    },
    addMemory: (routine, text, change) => {
      const memoryDir = path.join(stateDir, 'memory');
      fs.mkdirSync(memoryDir, { recursive: true });
      const file = path.join(memoryDir, `${routine}.md`);
      fs.writeFileSync(file, `${text}\n`);
      // A file newer than its change counts as edited by hand.
      fs.utimesSync(file, new Date(change.at), new Date(change.at));
      fs.writeFileSync(path.join(memoryDir, `${routine}.json`), JSON.stringify(change));
    },
    readMemory: routine => {
      const file = path.join(stateDir, 'memory', `${routine}.md`);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    },
    addWorktree: worktree => createWorktree(root, worktree),
    inspectWorktree,
    lookAtInbox: at => {
      const inbox: InboxState = { since: at, readRuns: [] };
      fs.writeFileSync(path.join(stateDir, 'inbox.json'), JSON.stringify(inbox));
    },
    stallScheduler: () => {
      scheduler.lastTickAt = minutesAgo(10);
      saveScheduler();
    },
  };
}

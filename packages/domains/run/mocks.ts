import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from './ids';
import type { RunRecord } from './types';

export function makeRunRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: runIdSchema.parse('run-1'),
    routine: routineNameSchema.parse('demo'),
    agent: 'claude',
    account: null,
    trigger: 'manual',
    scheduledFor: null,
    startedAt: '2026-10-06T11:00:00Z',
    endedAt: null,
    status: 'running',
    pid: null,
    exitCode: null,
    sessionId: null,
    resumeCommand: null,
    model: null,
    costUsd: null,
    numTurns: null,
    durationMs: null,
    resultText: null,
    error: null,
    logFile: '/tmp/run-1.jsonl',
    replyPid: null,
    conversation: null,
    usageLimit: null,
    retry: null,
    tokens: null,
    blockedActions: [],
    memorySentAt: null,
    worktree: null,
    ...overrides,
  };
}

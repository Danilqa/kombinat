import assert from 'node:assert/strict';

import { match } from 'ts-pattern';

import type {
  InitItem,
  ResultItem,
  RunRecord,
  TextItem,
  ToolItem,
  TranscriptItem,
} from './shared/contract';

export function makeRunRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: 'run-1',
    routine: 'demo',
    agent: 'claude',
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
    ...overrides,
  };
}

const fail = (expected: string, item: TranscriptItem | undefined): never =>
  assert.fail(`expected a ${expected} item, got ${JSON.stringify(item)}`);

export function expectInit(item: TranscriptItem | undefined): InitItem {
  return match(item)
    .with({ kind: 'init' }, init => init)
    .otherwise(() => fail('init', item));
}

export function expectText(item: TranscriptItem | undefined): TextItem {
  return match(item)
    .with({ kind: 'text' }, text => text)
    .otherwise(() => fail('text', item));
}

export function expectTool(item: TranscriptItem | undefined): ToolItem {
  return match(item)
    .with({ kind: 'tool' }, tool => tool)
    .otherwise(() => fail('tool', item));
}

export function expectResult(item: TranscriptItem | undefined): ResultItem {
  return match(item)
    .with({ kind: 'result' }, result => result)
    .otherwise(() => fail('result', item));
}

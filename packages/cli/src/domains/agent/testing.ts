import assert from 'node:assert/strict';

import { match } from 'ts-pattern';

import type {
  InitItem,
  ResultItem,
  TextItem,
  ToolItem,
  TranscriptItem,
} from 'domains/transcript/types';

import type { AgentTask } from './types';

export function makeAgentTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    name: 'demo',
    prompt: 'Hello',
    model: null,
    effort: null,
    permissionMode: null,
    command: null,
    maxBudgetUsd: null,
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

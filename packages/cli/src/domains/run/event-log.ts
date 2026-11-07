import fs from 'node:fs';

import { z } from 'zod';

import type { AgentName } from 'domains/agent/types';
import type { RunRecord } from 'domains/run/types';
import type { HookItem, Transcript } from 'domains/transcript/types';

import { parseJson } from '../../utils/json';
import { getAgent } from '../agent/registry';

const beforeHookEventSchema = z.object({
  type: z.literal('before_hook'),
  command: z.string(),
  exitCode: z.number().nullable(),
  output: z.string(),
});
export type BeforeHookEvent = z.infer<typeof beforeHookEventSchema>;

function toHookItem(event: BeforeHookEvent, index: number): HookItem {
  return {
    kind: 'hook',
    key: `hook-${index}`,
    command: event.command,
    exitCode: event.exitCode,
    output: event.output,
  };
}

export function readRunEvents(record: RunRecord): unknown[] {
  if (!fs.existsSync(record.logFile)) return [];
  return fs
    .readFileSync(record.logFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(parseJson)
    .filter(event => event !== undefined);
}

export function buildRunTranscript(agent: AgentName, events: unknown[]): Transcript {
  const hooks: HookItem[] = [];
  const agentEvents: unknown[] = [];
  for (const event of events) {
    const hook = beforeHookEventSchema.safeParse(event);
    if (hook.success) hooks.push(toHookItem(hook.data, hooks.length));
    else agentEvents.push(event);
  }
  return {
    eventCount: events.length,
    items: [...hooks, ...getAgent(agent).buildTranscript(agentEvents)],
  };
}

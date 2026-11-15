import fs from 'node:fs';

import { isMatching, match } from 'ts-pattern';
import { z } from 'zod';

import type { AgentName } from 'domains/agent/types';
import type { RunRecord } from 'domains/run/types';
import type { HookItem, HookPhase, Transcript } from 'domains/transcript/types';

import { parseJson } from '../../utils/json';
import { getAgent } from '../agent/registry';

const hookEventSchema = z.object({
  type: z.enum(['before_hook', 'after_hook']),
  command: z.string(),
  exitCode: z.number().nullable(),
  output: z.string(),
});
export type HookEvent = z.infer<typeof hookEventSchema>;

function toHookItem(event: HookEvent, index: number): HookItem {
  return {
    kind: 'hook',
    key: `hook-${index}`,
    command: event.command,
    exitCode: event.exitCode,
    output: event.output,
    phase: match(event.type)
      .with('before_hook', (): HookPhase => 'before')
      .with('after_hook', (): HookPhase => 'after')
      .exhaustive(),
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
    const hook = hookEventSchema.safeParse(event);
    if (hook.success) hooks.push(toHookItem(hook.data, hooks.length));
    else agentEvents.push(event);
  }
  return {
    eventCount: events.length,
    items: [
      ...hooks.filter(isMatching({ phase: 'before' })),
      ...getAgent(agent).buildTranscript(agentEvents),
      ...hooks.filter(isMatching({ phase: 'after' })),
    ],
  };
}

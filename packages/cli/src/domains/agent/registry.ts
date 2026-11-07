import { match } from 'ts-pattern';

import { agentNameSchema } from 'domains/agent/schemas';
import type { HookItem, Transcript } from 'domains/transcript/types';

import { beforeHookEventSchema, toHookItem } from '../run/event-log';
import { claudeAgent } from './claude';
import { codexAgent } from './codex';
import { commandAgent } from './command';
import type { Agent, AgentName } from './types';

export function getAgent(name: AgentName): Agent {
  return match(name)
    .with('claude', () => claudeAgent)
    .with('codex', () => codexAgent)
    .with('command', () => commandAgent)
    .exhaustive();
}

export function parseAgentName(value: string): AgentName {
  const parsed = agentNameSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`agent must be one of ${agentNameSchema.options.join(', ')}`);
  }
  return parsed.data;
}

export function buildTranscript(agent: AgentName, events: unknown[]): Transcript {
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

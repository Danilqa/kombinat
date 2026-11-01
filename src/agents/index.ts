import { match, P } from 'ts-pattern';

import { isBeforeHookEvent, toHookItem } from '../transcript';
import type { Transcript } from '../transcript';
import { claudeAgent } from './claude';
import { codexAgent } from './codex';
import { commandAgent } from './command';
import type { Agent, AgentName } from './types';

export const AGENT_NAMES: readonly AgentName[] = ['claude', 'codex', 'command'];

export function getAgent(name: AgentName): Agent {
  return match(name)
    .with('claude', () => claudeAgent)
    .with('codex', () => codexAgent)
    .with('command', () => commandAgent)
    .exhaustive();
}

export function parseAgentName(value: string): AgentName {
  return match(value)
    .with(P.union('claude', 'codex', 'command'), name => name)
    .otherwise(() => {
      throw new Error(`agent must be one of ${AGENT_NAMES.join(', ')}`);
    });
}

export function buildTranscript(agent: AgentName, events: unknown[]): Transcript {
  const hooks = events.filter(isBeforeHookEvent).map(toHookItem);
  const agentEvents = events.filter(event => !isBeforeHookEvent(event));
  return {
    eventCount: events.length,
    items: [...hooks, ...getAgent(agent).buildTranscript(agentEvents)],
  };
}

import { match } from 'ts-pattern';

import { agentNameSchema } from 'domains/agent/schemas';
import type { AgentName } from 'domains/agent/types';

import { claudeAgent } from './claude';
import { codexAgent } from './codex';
import { commandAgent } from './command';
import type { Agent } from './types';

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

import { match } from 'ts-pattern';

import { accountNameSchema, PRIMARY_ACCOUNT } from 'domains/agent/ids';
import type { AccountName } from 'domains/agent/ids';
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

// primary names the machine's own login, the one a routine without an account runs on.
export function parseAccountName(value: string): AccountName | null {
  if (value === PRIMARY_ACCOUNT) return null;
  const parsed = accountNameSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      'account must start with a letter or digit and hold only letters, digits, ., _, @, + and -, at most 64 characters',
    );
  }
  return parsed.data;
}

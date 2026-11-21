import { match } from 'ts-pattern';

import type { AgentName } from './types';

export function getAgentLabel(agent: AgentName): string {
  return match(agent)
    .with('claude', () => 'Claude')
    .with('codex', () => 'Codex')
    .with('command', () => 'Command')
    .exhaustive();
}

// A command's output is its result, so it has no way to hand notes back.
export function checkCanKeepMemory(agent: AgentName): boolean {
  return match(agent)
    .with('claude', 'codex', () => true)
    .with('command', () => false)
    .exhaustive();
}

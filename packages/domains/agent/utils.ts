import { match } from 'ts-pattern';

import type { AgentName } from './types';

export function getAgentLabel(agent: AgentName): string {
  return match(agent)
    .with('claude', () => 'Claude')
    .with('codex', () => 'Codex')
    .with('command', () => 'Command')
    .exhaustive();
}

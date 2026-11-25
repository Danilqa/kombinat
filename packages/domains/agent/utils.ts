import { match } from 'ts-pattern';

import { PRIMARY_ACCOUNT } from './ids';
import type { AccountName } from './ids';
import type { AgentName } from './types';

export interface AccountUser {
  agent: AgentName;
  account: AccountName | null;
}

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

// A command runs no agent, so it signs in to nothing.
export function checkHasAccount(agent: AgentName): boolean {
  return match(agent)
    .with('claude', 'codex', () => true)
    .with('command', () => false)
    .exhaustive();
}

export function getAccountLabel(account: AccountName | null): string {
  return account ?? PRIMARY_ACCOUNT;
}

// The logins that routines run on, the primary one first and then by name. null is the primary one.
export function listAccounts(users: AccountUser[]): Array<AccountName | null> {
  const accounts = new Set(
    users.filter(user => checkHasAccount(user.agent)).map(user => user.account),
  );
  return [...accounts].sort((a, b) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b)));
}

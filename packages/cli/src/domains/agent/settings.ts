import os from 'node:os';
import path from 'node:path';

import { match } from 'ts-pattern';

import type { AccountName } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';

import type { AccountHome, AgentSettings, ReplySource, RunContext } from './types';

export function pickOne<T extends string>(
  value: string | null,
  allowed: readonly T[],
  field: string,
  agent: AgentName,
): T | null {
  if (value === null) return null;
  const found = allowed.find(candidate => candidate === value);
  if (found === undefined) {
    throw new Error(`${field} must be one of ${allowed.join(', ')} for agent ${agent}`);
  }
  return found;
}

export function splitModels(model: string | null): string[] {
  return (model ?? '')
    .split(',')
    .map(name => name.trim())
    .filter(name => name !== '');
}

export function rejectUnsupported(
  raw: AgentSettings,
  fields: ReadonlyArray<keyof AgentSettings>,
  agent: AgentName,
): void {
  const used = fields.filter(field => raw[field] !== null);
  if (used.length > 0) throw new Error(`agent ${agent} does not support ${used.join(', ')}`);
}

export function withoutEnv(names: readonly string[]): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !names.includes(name)));
}

// The primary login stays wherever the agent keeps it, so it needs no folder of its own.
export function getAccountFolder(
  home: AccountHome | null,
  account: AccountName | null,
): string | null {
  if (home === null || account === null) return null;
  return path.join(os.homedir(), `${home.folder}-${account}`);
}

export function withAccount(
  env: NodeJS.ProcessEnv,
  home: AccountHome | null,
  account: AccountName | null,
): NodeJS.ProcessEnv {
  const folder = getAccountFolder(home, account);
  return home === null || folder === null ? env : { ...env, [home.env]: folder };
}

// What a command needs in front to use the account's login, such as CLAUDE_CONFIG_DIR=~/.claude-work.
export function getAccountPrefix(home: AccountHome | null, account: AccountName | null): string {
  return home === null || account === null ? '' : `${home.env}=~/${home.folder}-${account} `;
}

export function getUnattendedNote({ routine, runId, trigger }: RunContext): string {
  return [
    `This session was started unattended by the kombinat scheduler for routine "${routine.name}" (run ${runId}, trigger ${trigger}).`,
    'Nobody is watching and nobody can answer questions, so make sensible calls, record them, and finish on your own.',
  ].join(' ');
}

export function getReplyNote({ routine, runId }: RunContext, source: ReplySource): string {
  const reason = match(source)
    .with('dashboard', () => 'with a message from the dashboard')
    .with('webhook', () => 'with a message from a webhook')
    .with('usage_limit', () => 'after your usage limit reset')
    .with('retry', () => 'after an error stopped your last attempt')
    .exhaustive();
  return [
    `This session continues run ${runId} of the kombinat routine "${routine.name}" ${reason}.`,
    'Nobody can answer questions while you work, so make sensible calls, record them, and finish on your own.',
  ].join(' ');
}

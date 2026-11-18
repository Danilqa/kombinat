import { match } from 'ts-pattern';

import type { AgentName } from 'domains/agent/types';
import type { MessageSource } from 'domains/transcript/types';

import type { AgentSettings, RunContext } from './types';

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

export function getUnattendedNote({ routine, runId, trigger }: RunContext): string {
  return [
    `This session was started unattended by the kombinat scheduler for routine "${routine.name}" (run ${runId}, trigger ${trigger}).`,
    'Nobody is watching and nobody can answer questions, so make sensible calls, record them, and finish on your own.',
  ].join(' ');
}

export function getReplyNote({ routine, runId }: RunContext, source: MessageSource): string {
  const sender = match(source)
    .with('dashboard', () => 'the dashboard')
    .with('webhook', () => 'a webhook')
    .exhaustive();
  return [
    `This session continues run ${runId} of the kombinat routine "${routine.name}" with a message from ${sender}.`,
    'Nobody can answer questions while you work, so make sensible calls, record them, and finish on your own.',
  ].join(' ');
}

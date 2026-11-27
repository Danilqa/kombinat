import fs from 'node:fs';

import type { HookEvent } from './event-log';
import { withHookEnv } from './hook-env';
import { runShell } from './shell';
import type { ShellResult } from './shell';

export const HOOK_TIMEOUT_MS = 3 * 60_000;

interface HookCommand {
  type: HookEvent['type'];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  input: string;
  timeoutMs: number;
}

interface Hook extends HookCommand {
  logFile: string;
}

interface HookResult extends ShellResult {
  output: string;
  event: HookEvent;
}

function formatLimit(timeoutMs: number): string {
  return `${timeoutMs / 60_000} minutes`;
}

export async function runHookCommand({
  type,
  command,
  cwd,
  env,
  input,
  timeoutMs,
}: HookCommand): Promise<HookResult> {
  const result = await runShell({ command, cwd, env: withHookEnv(env), input, timeoutMs });
  const printed = `${result.stdout}${result.stderr}`.trim();
  const notes = [
    result.startError === null ? null : `Failed to start: ${result.startError}`,
    result.isTimedOut ? `Killed after ${formatLimit(timeoutMs)}` : null,
  ];
  const event: HookEvent = {
    type,
    command,
    exitCode: result.exitCode,
    output: [printed, ...notes].filter(Boolean).join('\n'),
  };
  return { ...result, output: printed, event };
}

export function appendHookEvent(logFile: string, event: HookEvent): void {
  fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`);
}

export async function runHook({ logFile, ...hook }: Hook): Promise<HookResult> {
  const result = await runHookCommand(hook);
  appendHookEvent(logFile, result.event);
  return result;
}

export function getHookError(name: string, result: HookResult, timeoutMs: number): string | null {
  if (result.startError !== null) return `${name} failed to start: ${result.startError}`;
  if (result.isTimedOut) return `${name} was killed after ${formatLimit(timeoutMs)}`;
  if (result.exitCode !== 0) {
    return `${name} exited with ${result.exitCode}: ${result.output.slice(-1500)}`;
  }
  return null;
}

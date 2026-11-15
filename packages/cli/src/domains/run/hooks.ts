import fs from 'node:fs';

import type { HookEvent } from './event-log';
import { withHookEnv } from './hook-env';
import { runShell } from './shell';
import type { ShellResult } from './shell';

export const HOOK_TIMEOUT_MS = 3 * 60_000;

export interface Hook {
  type: HookEvent['type'];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  input: string;
  timeoutMs: number;
  logFile: string;
}

export interface HookResult extends ShellResult {
  output: string;
}

function formatLimit(timeoutMs: number): string {
  return `${timeoutMs / 60_000} minutes`;
}

export async function runHook({
  type,
  command,
  cwd,
  env,
  input,
  timeoutMs,
  logFile,
}: Hook): Promise<HookResult> {
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
  fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`);
  return { ...result, output: printed };
}

export function getBeforeHookError(result: HookResult, timeoutMs: number): string | null {
  if (result.startError !== null) return `before hook failed to start: ${result.startError}`;
  if (result.isTimedOut) return `before hook was killed after ${formatLimit(timeoutMs)}`;
  if (result.exitCode !== 0) {
    return `before hook exited with ${result.exitCode}: ${result.output.slice(-1500)}`;
  }
  return null;
}

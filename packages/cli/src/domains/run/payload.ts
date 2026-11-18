import fs from 'node:fs';
import path from 'node:path';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';

import { getRunsDir } from './storage';

type RunInput = 'payload' | 'prompt';

function getInputFile(routine: RoutineName, runId: RunId, input: RunInput): string {
  return path.join(getRunsDir(routine), `${runId}.${input}`);
}

function writeInput(routine: RoutineName, runId: RunId, input: RunInput, text: string): void {
  fs.mkdirSync(getRunsDir(routine), { recursive: true });
  fs.writeFileSync(getInputFile(routine, runId, input), text);
}

function takeInput(routine: RoutineName, runId: RunId, input: RunInput): string | null {
  const file = getInputFile(routine, runId, input);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  fs.rmSync(file);
  return text;
}

export function writePayload(routine: RoutineName, runId: RunId, payload: string): void {
  writeInput(routine, runId, 'payload', payload);
}

export function takePayload(routine: RoutineName, runId: RunId): string | null {
  return takeInput(routine, runId, 'payload');
}

export function writePrompt(routine: RoutineName, runId: RunId, prompt: string): void {
  writeInput(routine, runId, 'prompt', prompt);
}

export function takePrompt(routine: RoutineName, runId: RunId): string | null {
  return takeInput(routine, runId, 'prompt');
}

// Longer than any backtick run in the payload, so the payload cannot close the fence.
export function appendPayload(prompt: string, payload: string): string {
  const longestRun = (payload.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  const body = payload.endsWith('\n') ? payload : `${payload}\n`;
  return `${prompt}\n\nThis run was started by a webhook. Its request body:\n\n${fence}\n${body}${fence}\n`;
}

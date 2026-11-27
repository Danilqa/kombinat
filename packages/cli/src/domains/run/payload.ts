import fs from 'node:fs';
import path from 'node:path';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { RunRecord } from 'domains/run/types';
import { getRunStatusLabel } from 'domains/run/utils';

import { getRunsDir } from './storage';

type RunInput = 'payload' | 'prompt' | 'check-error';

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

export function writeCheckError(routine: RoutineName, runId: RunId, error: string): void {
  writeInput(routine, runId, 'check-error', error);
}

export function takeCheckError(routine: RoutineName, runId: RunId): string | null {
  return takeInput(routine, runId, 'check-error');
}

// Longer than any backtick run in the text. The text cannot close the fence.
function fence(text: string): string {
  const longestRun = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const marks = '`'.repeat(Math.max(3, longestRun + 1));
  return `${marks}\n${text.endsWith('\n') ? text : `${text}\n`}${marks}\n`;
}

export function appendPayload(prompt: string, payload: string): string {
  return `${prompt}\n\nThis run was started by a webhook. Its request body:\n\n${fence(payload)}`;
}

export function appendChainedRun(prompt: string, run: RunRecord): string {
  const status = getRunStatusLabel(run.status).toLowerCase();
  const intro = `${prompt}\n\nThis run started after run ${run.id} of ${run.routine} ended as ${status}.`;
  const result = run.resultText ?? run.error;
  return result === null || result.trim() === ''
    ? `${intro} That run left no result.\n`
    : `${intro} Its result:\n\n${fence(result)}`;
}

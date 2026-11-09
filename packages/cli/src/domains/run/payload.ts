import fs from 'node:fs';
import path from 'node:path';

import { getRunsDir } from './storage';

export function getPayloadFile(routine: string, runId: string): string {
  return path.join(getRunsDir(routine), `${runId}.payload`);
}

export function writePayload(routine: string, runId: string, payload: string): void {
  fs.mkdirSync(getRunsDir(routine), { recursive: true });
  fs.writeFileSync(getPayloadFile(routine, runId), payload);
}

export function readPayload(routine: string, runId: string): string | null {
  const file = getPayloadFile(routine, runId);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

// The fence is longer than any run of backticks in the payload, so the payload cannot close it.
export function appendPayload(prompt: string, payload: string): string {
  const longestRun = (payload.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  const body = payload.endsWith('\n') ? payload : `${payload}\n`;
  return `${prompt}\n\nThis run was started by a webhook. Its request body:\n\n${fence}\n${body}${fence}\n`;
}

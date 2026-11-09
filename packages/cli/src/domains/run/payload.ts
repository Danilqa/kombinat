import fs from 'node:fs';
import path from 'node:path';

import { getRunsDir } from './storage';

function getPayloadFile(routine: string, runId: string): string {
  return path.join(getRunsDir(routine), `${runId}.payload`);
}

export function writePayload(routine: string, runId: string, payload: string): void {
  fs.mkdirSync(getRunsDir(routine), { recursive: true });
  fs.writeFileSync(getPayloadFile(routine, runId), payload);
}

export function takePayload(routine: string, runId: string): string | null {
  const file = getPayloadFile(routine, runId);
  if (!fs.existsSync(file)) return null;
  const payload = fs.readFileSync(file, 'utf8');
  fs.rmSync(file);
  return payload;
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

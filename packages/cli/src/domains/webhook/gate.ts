import type { IncomingHttpHeaders } from 'node:http';

import { match } from 'ts-pattern';

import { config } from '../../config';
import { parseJson } from '../../utils/json';
import type { Routine } from '../routine/types';
import { withHookEnv } from '../run/hook-env';
import { runShell } from '../run/shell';

export const WEBHOOK_GATE_TIMEOUT_MS = 3_000;
// EX_CONFIG: crashes exit with 1 or 2, never with this.
export const WEBHOOK_GATE_IGNORE_EXIT_CODE = 78;

export interface WebhookRequest {
  body: Buffer;
  headers: IncomingHttpHeaders;
}

interface RunDecision {
  outcome: 'run';
  payload: string;
}

interface IgnoreDecision {
  outcome: 'ignore';
  response: unknown;
}

interface RejectDecision {
  outcome: 'reject';
  reason: string;
}

interface TimeoutDecision {
  outcome: 'timeout';
}

export type WebhookGateDecision = RunDecision | IgnoreDecision | RejectDecision | TimeoutDecision;

function toDecision(
  exitCode: number | null,
  stdout: string,
  stderr: string,
  body: string,
): WebhookGateDecision {
  return match(exitCode)
    .with(0, (): WebhookGateDecision => ({
      outcome: 'run',
      payload: stdout.trim() === '' ? body : stdout,
    }))
    .with(WEBHOOK_GATE_IGNORE_EXIT_CODE, (): WebhookGateDecision => ({
      outcome: 'ignore',
      response: parseJson(stdout) ?? null,
    }))
    .otherwise((): WebhookGateDecision => ({
      outcome: 'reject',
      reason: `exited with ${exitCode ?? 'a signal'}: ${stderr.trim().slice(-500)}`,
    }));
}

export async function decideWebhook(
  routine: Routine,
  request: WebhookRequest,
  timeoutMs = WEBHOOK_GATE_TIMEOUT_MS,
): Promise<WebhookGateDecision> {
  const body = request.body.toString('utf8');
  const gate = routine.webhookGate;
  if (gate === null) return { outcome: 'run', payload: body };
  const result = await runShell({
    command: gate,
    cwd: config.projectRoot,
    env: withHookEnv({
      ...process.env,
      KOMBINAT_ROUTINE: routine.name,
      KOMBINAT_WEBHOOK_HEADERS: JSON.stringify(request.headers),
    }),
    input: request.body,
    timeoutMs,
  });
  if (result.startError !== null) {
    return { outcome: 'reject', reason: `failed to start: ${result.startError}` };
  }
  if (result.isTimedOut) return { outcome: 'timeout' };
  return toDecision(result.exitCode, result.stdout, result.stderr, body);
}

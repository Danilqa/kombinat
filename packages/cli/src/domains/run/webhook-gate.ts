import { spawn } from 'node:child_process';
import type { IncomingHttpHeaders } from 'node:http';

import { match } from 'ts-pattern';

import { config } from '../../config';
import { parseJson } from '../../utils/json';
import type { Routine } from '../routine/types';
import { buildHookEnv } from './hook-env';

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

function buildDecision(
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

export function decideWebhook(
  routine: Routine,
  request: WebhookRequest,
  timeoutMs = WEBHOOK_GATE_TIMEOUT_MS,
): Promise<WebhookGateDecision> {
  const body = request.body.toString('utf8');
  const gate = routine.webhookGate;
  if (gate === null) return Promise.resolve({ outcome: 'run', payload: body });
  return new Promise(resolve => {
    const child = spawn('/bin/sh', ['-c', gate], {
      cwd: config.projectRoot,
      env: buildHookEnv({
        ...process.env,
        KOMBINAT_ROUTINE: routine.name,
        KOMBINAT_WEBHOOK_HEADERS: JSON.stringify(request.headers),
      }),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    let isTimedOut = false;
    const timer = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ outcome: 'reject', reason: `failed to start: ${error.message}` });
    });
    child.on('close', exitCode => {
      clearTimeout(timer);
      if (isTimedOut) {
        resolve({ outcome: 'timeout' });
        return;
      }
      resolve(
        buildDecision(
          exitCode,
          Buffer.concat(stdout).toString('utf8'),
          Buffer.concat(stderr).toString('utf8'),
          body,
        ),
      );
    });
    // The gate may exit before it reads the body.
    child.stdin.on('error', () => undefined);
    child.stdin.end(request.body);
  });
}

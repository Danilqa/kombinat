import { match } from 'ts-pattern';

import type { RunRecord, RunStatus, RunTrigger } from './types';

export function createRunId(now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${suffix}`;
}

export function getRunDurationMs(
  run: Pick<RunRecord, 'startedAt' | 'endedAt'>,
  now: number = Date.now(),
): number {
  const end = run.endedAt ? new Date(run.endedAt).getTime() : now;
  return end - new Date(run.startedAt).getTime();
}

export function getRunStatusLabel(status: RunStatus): string {
  return match(status)
    .with('running', () => 'Running')
    .with('succeeded', () => 'Succeeded')
    .with('failed', () => 'Failed')
    .with('timed_out', () => 'Timed out')
    .with('aborted', () => 'Aborted')
    .exhaustive();
}

export function getTriggerLabel(trigger: RunTrigger): string {
  return match(trigger)
    .with('schedule', () => 'Scheduled')
    .with('manual', () => 'Manual')
    .with('catch_up', () => 'Catch-up')
    .with('webhook', () => 'Webhook')
    .exhaustive();
}

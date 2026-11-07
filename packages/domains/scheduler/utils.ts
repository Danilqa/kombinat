import { match } from 'ts-pattern';

import type { SkipReason } from './types';

export function getSkipReasonLabel(reason: SkipReason): string {
  return match(reason)
    .with('already_running', () => 'already running')
    .with('concurrency_limit', () => 'concurrency limit')
    .with('disabled', () => 'disabled')
    .exhaustive();
}

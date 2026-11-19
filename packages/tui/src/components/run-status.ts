import { isMatching, match } from 'ts-pattern';

import type { RunStatus } from 'domains/run/types';
import { getRunStatusLabel } from 'domains/run/utils';

import { S, text } from '../terminal/text';
import type { Line, Span } from '../terminal/text';

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

interface StatusLook {
  icon: string;
  style: string;
}

function getStatusLook(status: RunStatus): StatusLook {
  return match(status)
    .with('running', () => ({ icon: '●', style: S.yellow }))
    .with('waiting', () => ({ icon: '‖', style: S.blue }))
    .with('succeeded', () => ({ icon: '✓', style: S.green }))
    .with('failed', () => ({ icon: '✗', style: S.red }))
    .with('timed_out', () => ({ icon: '✗', style: S.red }))
    .with('aborted', () => ({ icon: '⊘', style: S.dim }))
    .exhaustive();
}

export function spinner(now: number): string {
  return SPINNER.charAt(Math.floor(now / 100) % SPINNER.length);
}

export function statusIcon(status: RunStatus, now: number): Span {
  const look = getStatusLook(status);
  return text(isMatching('running', status) ? spinner(now) : look.icon, look.style);
}

export function statusBadge(status: RunStatus, now: number): Line {
  const look = getStatusLook(status);
  return [statusIcon(status, now), text(` ${getRunStatusLabel(status)}`, look.style)];
}

import type { CurrentUsageLimit, DaemonStatus } from 'domains/daemon/types';
import {
  checkHasSeveralAccounts,
  checkIsUsageLow,
  formatUsageLeft,
  getAccountLimits,
  getMostUsedLimit,
} from 'domains/daemon/utils';
import { formatRelativeCompact, formatSpan } from 'utils/date-time';

import type { Overview } from '../daemon-client';
import { S, text } from '../terminal/text';
import type { Line } from '../terminal/text';

function planUsageLines(status: DaemonStatus, now: number): Line[] {
  const hasSeveralAccounts = checkHasSeveralAccounts(status);
  return getAccountLimits(status).flatMap(({ label, limits }) => {
    const limit = getMostUsedLimit(limits);
    if (limit === undefined) return [];
    return [planUsageLine(hasSeveralAccounts ? label : 'claude', limit, now)];
  });
}

function planUsageLine(label: string, limit: CurrentUsageLimit, now: number): Line {
  return [
    text(`${label} `),
    text(`${formatUsageLeft(limit)} left`, checkIsUsageLow(limit) ? S.boldYellow : S.cyan),
    text(
      ` · ${limit.label.toLowerCase()} resets ${formatRelativeCompact(limit.resetsAt, now)}`,
      S.dim,
    ),
  ];
}

export function statusLines(
  overview: Overview | null,
  error: string | null,
  loadedAt: number | null,
  now: number,
): Line[] {
  if (error) {
    return [
      [text('✗ ', S.red), text('daemon not reachable', S.boldRed)],
      [
        text(
          loadedAt
            ? `showing data from ${formatRelativeCompact(new Date(loadedAt).toISOString(), now)}`
            : 'check it with kombinat status',
          S.dim,
        ),
      ],
    ];
  }
  if (!overview) return [[text('connecting…', S.dim)]];
  const { status } = overview;
  return [
    [
      text('● ', S.green),
      text('daemon', S.bold),
      text(` pid ${status.pid}`, S.dim),
      text(' · ', S.dim),
      text(`up ${formatSpan(now - new Date(status.startedAt).getTime())}`, S.dim),
    ],
    [
      text('tick '),
      text(formatRelativeCompact(status.lastTickAt, now), S.cyan),
      text(' · ', S.dim),
      text(
        `${status.running}/${status.maxConcurrentRuns} running`,
        status.running > 0 ? S.boldYellow : undefined,
      ),
      text(' · ', S.dim),
      text(status.timezone, S.magenta),
    ],
    ...planUsageLines(status, now),
  ];
}

export function formatCopyright(version: string | undefined, now: number): string {
  const copyright = `© ${new Date(now).getFullYear()}`;
  return version === undefined ? copyright : `v${version} · ${copyright}`;
}

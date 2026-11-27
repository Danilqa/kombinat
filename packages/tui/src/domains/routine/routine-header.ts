import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import type { TokenUsage } from 'domains/run/types';
import {
  formatTokens,
  formatTokenShare,
  getBudgetLabel,
  getQueuedRunsLabel,
  getRetriesLabel,
  getRunCountLabel,
  getTokenTotal,
} from 'domains/run/utils';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { formatDayTime, formatRelativeCompact } from 'utils/date-time';

import { detailRows, timeValue } from '../../terminal/detail-rows';
import type { DetailPair } from '../../terminal/detail-rows';
import { S, sanitize, text, wrapLine } from '../../terminal/text';
import type { Line } from '../../terminal/text';
import { spinner, statusBadge } from '../run/run-status';
import { formatQueueLabel } from '../webhook/queue-table';

function tokenUsageValue(usage: TokenUsage): Line {
  return [
    text(formatTokens(getTokenTotal(usage.counts)), S.magenta),
    text(
      ` in 7 days · ${usage.runs} ${usage.runs === 1 ? 'run' : 'runs'} · ${formatTokenShare(usage.share)} of all routines`,
      S.dim,
    ),
  ];
}

export function routineHeaderLines(
  summary: RoutineSummary,
  detail: RoutineDetail | undefined,
  width: number,
  now: number,
): Line[] {
  const routine = detail ?? summary;
  const dot = text(' · ', S.dim);
  const chips: Line = [
    text(routine.scheduleHuman, S.boldYellow),
    ...(routine.schedule ? [dot, text(routine.schedule, S.yellow)] : []),
    dot,
    text(routine.agent, S.boldCyan),
    ...[
      routine.model === null ? null : text(routine.model, S.blue),
      routine.effort === null ? null : text(`effort ${routine.effort}`),
      routine.permissionMode === null ? null : text(`permission ${routine.permissionMode}`),
    ].flatMap(chip => (chip === null ? [] : [dot, chip])),
    dot,
    routine.enabled ? text('● enabled', S.green) : text('○ disabled', S.dim),
  ];
  const lastRun = routine.lastRun;
  const pairs: DetailPair[] = [
    ...(routine.account === null
      ? []
      : [{ label: 'account', value: [text(routine.account, S.cyan)], isWide: true }]),
    { label: 'cwd', value: [text(routine.cwd)], isWide: true },
    ...(routine.worktree
      ? [{ label: 'worktree', value: [text('each run gets its own')], isWide: true }]
      : []),
    ...(routine.command === null
      ? []
      : [{ label: 'command', value: [text(routine.command, S.cyan)], isWide: true }]),
    { label: 'file', value: [text(routine.file)], isWide: true },
    ...(routine.check === null
      ? []
      : [{ label: 'check', value: [text(routine.check, S.cyan)], isWide: true }]),
    { label: 'next run', value: timeValue(routine.nextRunAt, now), isWide: true },
    ...(detail === undefined || detail.oneTimeRuns.length === 0
      ? []
      : [
          {
            label: 'run once',
            value: [text(detail.oneTimeRuns.map(({ at }) => formatDayTime(at)).join(' · '))],
            isWide: true,
          },
        ]),
    {
      label: 'last run',
      value: lastRun
        ? [
            ...statusBadge(lastRun.status, now),
            text(` · ${formatRelativeCompact(lastRun.startedAt, now)}`, S.cyan),
          ]
        : [text('never', S.dim)],
      isWide: true,
    },
    ...(routine.lastSkip
      ? [
          {
            label: 'last skip',
            value: [
              text(formatRelativeCompact(routine.lastSkip.at, now), S.cyan),
              text(` · ${getSkipReasonLabel(routine.lastSkip.reason)}`, S.yellow),
            ],
            isWide: true,
          },
        ]
      : []),
    ...(routine.tokenUsage === null
      ? []
      : [{ label: 'tokens', value: tokenUsageValue(routine.tokenUsage), isWide: true }]),
    { label: 'timeout', value: [text(`${routine.timeoutMinutes} min`)] },
    {
      label: 'budget',
      value: [text(getBudgetLabel(routine.maxBudgetUsd, routine.maxBudgetTokens) ?? 'none')],
    },
    ...(routine.retries === 0
      ? []
      : [{ label: 'retries', value: [text(getRetriesLabel(routine.retries))], isWide: true }]),
    ...(routine.runs === 1
      ? []
      : [
          {
            label: 'runs',
            value: [text(getRunCountLabel(routine.runs, routine.maxParallel))],
            isWide: true,
          },
        ]),
  ];
  return [
    [
      text(routine.name, S.boldMagenta),
      ...(routine.running ? [text(`  ${spinner(now)} running`, S.boldYellow)] : []),
      ...(detail === undefined || detail.queuedRuns.length === 0
        ? []
        : [text(`  · ${getQueuedRunsLabel(detail.queuedRuns.length)}`, S.yellow)]),
      ...(routine.queuedWebhooks > 0
        ? [text(`  · ${formatQueueLabel(routine.queuedWebhooks)}`, S.yellow)]
        : []),
    ],
    ...wrapLine([text(sanitize(routine.description))], width),
    [],
    ...wrapLine(chips, width),
    [],
    ...detailRows(pairs, width),
  ];
}

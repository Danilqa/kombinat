import { match } from 'ts-pattern';

import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import type { RunsPage, TokenUsage } from 'domains/run/types';
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

import { detailRows, timeValue } from '../../components/detail-rows';
import type { DetailPair } from '../../components/detail-rows';
import { spinner, statusBadge } from '../../components/run-status';
import { toContent } from '../../page-content';
import type { ContentLine, PageContent } from '../../page-content';
import { renderMarkdown } from '../../terminal/markdown';
import { S, sanitize, text, wrapLine } from '../../terminal/text';
import type { Line } from '../../terminal/text';
import { memoryNotes } from './memory-notes';
import { buildQueueTable, formatQueueLabel } from './queue-table';
import { runsTable } from './runs-table';
import { skipsTable } from './skips-table';
import { buildWebhookCallsTable } from './webhook-calls-table';

export type RoutineTab = 'runs' | 'prompt' | 'memory' | 'skips' | 'queue' | 'webhooks';

interface Tab {
  id: RoutineTab;
  label: string;
}

export function getRoutineTabs(routine: RoutineSummary): RoutineTab[] {
  return [
    'runs',
    'prompt',
    ...(routine.memory ? (['memory'] as const) : []),
    'skips',
    ...(routine.webhook ? (['queue', 'webhooks'] as const) : []),
  ];
}

function getTabLabel(
  tab: RoutineTab,
  detail: RoutineDetail | undefined,
  runs: RunsPage | undefined,
): string {
  const formatCount = (items: unknown[] | undefined) =>
    items === undefined ? '' : ` ${items.length}`;
  return match(tab)
    .with('runs', () => (runs === undefined ? 'Runs' : `Runs ${runs.total}`))
    .with('prompt', () => 'Prompt')
    .with('memory', () => 'Memory')
    .with('skips', () => `Skipped${formatCount(detail?.skips)}`)
    .with('queue', () => `Queue${formatCount(detail?.queue)}`)
    .with('webhooks', () => `Webhooks${formatCount(detail?.webhookCalls)}`)
    .exhaustive();
}

function tabBar(tabs: Tab[], active: RoutineTab): Line {
  return [
    ...tabs.flatMap(tab => [
      text(` ${tab.label} `, tab.id === active ? `${S.boldMagenta};${S.selected}` : S.dim),
      text(' '),
    ]),
    text('  [ ] switch', S.grey),
  ];
}

function tokenUsageValue(usage: TokenUsage): Line {
  return [
    text(formatTokens(getTokenTotal(usage.counts)), S.magenta),
    text(
      ` in 7 days · ${usage.runs} ${usage.runs === 1 ? 'run' : 'runs'} · ${formatTokenShare(usage.share)} of all routines`,
      S.dim,
    ),
  ];
}

interface RoutinePageInput {
  summary: RoutineSummary;
  detail: RoutineDetail | undefined;
  runs: RunsPage | undefined;
  tab: RoutineTab;
  width: number;
  now: number;
  error: string | undefined;
}

export function routinePage({
  summary,
  detail,
  runs,
  tab,
  width,
  now,
  error,
}: RoutinePageInput): PageContent {
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
  const header: ContentLine[] = toContent([
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
    [],
    tabBar(
      getRoutineTabs(routine).map((id): Tab => ({ id, label: getTabLabel(id, detail, runs) })),
      tab,
    ),
    [text('─'.repeat(width), S.grey)],
  ]);
  if (!detail) {
    return {
      mode: 'scroll',
      lines: [...header, { line: [text(error ?? 'loading…', error ? S.red : S.dim)] }],
    };
  }
  return match(tab)
    .with('runs', (): PageContent => ({
      mode: 'select',
      lines: [
        ...header,
        ...(runs === undefined
          ? [{ line: [text('loading…', S.dim)] }]
          : runsTable(routine.name, runs, width, now)),
      ],
    }))
    .with('prompt', (): PageContent => ({
      mode: 'scroll',
      lines: [...header, ...toContent(renderMarkdown(detail.prompt, width))],
    }))
    .with('memory', (): PageContent => ({
      mode: 'scroll',
      lines: [
        ...header,
        ...(detail.memoryNotes === null
          ? [{ line: [text('This routine has no memory.', S.dim)] }]
          : toContent(memoryNotes(detail.memoryNotes, routine.lastRun?.id ?? null, width, now))),
      ],
    }))
    .with('skips', (): PageContent => ({
      mode: 'scroll',
      lines: [...header, ...skipsTable(detail.skips, now, width)],
    }))
    .with('queue', (): PageContent => ({
      mode: 'scroll',
      lines: [...header, ...buildQueueTable(detail.queue, width, now)],
    }))
    .with('webhooks', (): PageContent => ({
      mode: 'scroll',
      lines: [...header, ...buildWebhookCallsTable(routine.name, detail.webhookCalls, width, now)],
    }))
    .exhaustive();
}

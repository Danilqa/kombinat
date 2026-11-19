import { match } from 'ts-pattern';

import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import type { RunsPage } from 'domains/run/types';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { formatRelativeCompact } from 'utils/date-time';

import { detailRows, timeValue } from '../../components/detail-rows';
import type { DetailPair } from '../../components/detail-rows';
import { spinner, statusBadge } from '../../components/run-status';
import { toContent } from '../../page-content';
import type { ContentLine, PageContent } from '../../page-content';
import { renderMarkdown } from '../../terminal/markdown';
import { S, sanitize, text, wrapLine } from '../../terminal/text';
import type { Line } from '../../terminal/text';
import { buildQueueTable, formatQueueLabel } from './queue-table';
import { runsTable } from './runs-table';
import { skipsTable } from './skips-table';
import { buildWebhookCallsTable } from './webhook-calls-table';

export type RoutineTab = 'runs' | 'prompt' | 'skips' | 'queue' | 'webhooks';

interface Tab {
  id: RoutineTab;
  label: string;
}

export function getRoutineTabs(routine: RoutineSummary): RoutineTab[] {
  return routine.webhook
    ? ['runs', 'prompt', 'skips', 'queue', 'webhooks']
    : ['runs', 'prompt', 'skips'];
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
    { label: 'cwd', value: [text(routine.cwd)], isWide: true },
    ...(routine.command === null
      ? []
      : [{ label: 'command', value: [text(routine.command, S.cyan)], isWide: true }]),
    { label: 'file', value: [text(routine.file)], isWide: true },
    { label: 'next run', value: timeValue(routine.nextRunAt, now), isWide: true },
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
    { label: 'timeout', value: [text(`${routine.timeoutMinutes} min`)] },
    {
      label: 'budget',
      value: [text(routine.maxBudgetUsd === null ? 'none' : `$${routine.maxBudgetUsd.toFixed(2)}`)],
    },
  ];
  const header: ContentLine[] = toContent([
    [
      text(routine.name, S.boldMagenta),
      ...(routine.running ? [text(`  ${spinner(now)} running`, S.boldYellow)] : []),
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
    .with('skips', (): PageContent => ({
      mode: 'scroll',
      lines: [...header, ...skipsTable(detail.skips, now)],
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

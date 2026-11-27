import { match } from 'ts-pattern';

import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import type { RunsPage } from 'domains/run/types';

import { memoryNotes } from '../domains/routine/memory-notes';
import { routineHeaderLines } from '../domains/routine/routine-header';
import { runsTable } from '../domains/run/runs-table';
import { skipsTable } from '../domains/scheduler/skips-table';
import { buildQueueTable } from '../domains/webhook/queue-table';
import { buildWebhookCallsTable } from '../domains/webhook/webhook-calls-table';
import { toContent } from '../page-content';
import type { ContentLine, PageContent } from '../page-content';
import { renderMarkdown } from '../terminal/markdown';
import { S, text } from '../terminal/text';
import type { Line } from '../terminal/text';

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
  const header: ContentLine[] = toContent([
    ...routineHeaderLines(summary, detail, width, now),
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
      lines: [...header, ...skipsTable(detail.skips, width, now)],
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

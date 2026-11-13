import { isMatching, match, P } from 'ts-pattern';

import type { RoutineName, RunId } from 'domains/id/types';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import type { RunRecord, RunsPage, RunStatus } from 'domains/run/types';
import { getRunDurationMs, getRunStatusLabel, getTriggerLabel } from 'domains/run/utils';
import type { Skip } from 'domains/scheduler/types';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import type { ToolItem, TranscriptItem } from 'domains/transcript/types';
import {
  checkIsSubagent,
  getModelFallbackReasonLabel,
  getTranscriptEmptyLabel,
  getTranscriptResultLabel,
} from 'domains/transcript/utils';
import type { QueuedWebhook } from 'domains/webhook/types';
import { formatPayloadSize, getQueuePositionLabel } from 'domains/webhook/utils';
import {
  formatDuration,
  formatRelativeCompact,
  formatSpan,
  formatTimestamp,
} from 'utils/date-time';

import type { Overview } from './daemon-client';
import { renderMarkdown } from './terminal/markdown';
import { fitLine, lineWidth, S, sanitize, sliceLine, textWidth, wrapLine } from './terminal/text';
import type { Line, Span } from './terminal/text';

export interface OpenRunAction {
  kind: 'open-run';
  routine: RoutineName;
  id: RunId;
}

export interface ToggleAction {
  kind: 'toggle';
  key: string;
}

export type Action = OpenRunAction | ToggleAction;

export interface ContentLine {
  line: Line;
  action?: Action;
  itemKey?: string;
  isItemStart?: boolean;
}

// select: the cursor jumps between lines with an action. scroll: no cursor. line: the cursor moves line by line.
export type CursorMode = 'select' | 'scroll' | 'line';

export interface PageContent {
  lines: ContentLine[];
  mode: CursorMode;
}

export type RoutineTab = 'runs' | 'prompt' | 'skips' | 'queue';

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
// Caps for expanded tool input/output: a 1MB minified line must not become 10k rows.
const MAX_BLOCK_LINES = 200;
const MAX_LINE_CHARS = 2000;

interface StatusLook {
  icon: string;
  style: string;
}

function getStatusLook(status: RunStatus): StatusLook {
  return match(status)
    .with('running', () => ({ icon: '●', style: S.yellow }))
    .with('succeeded', () => ({ icon: '✓', style: S.green }))
    .with('failed', () => ({ icon: '✗', style: S.red }))
    .with('timed_out', () => ({ icon: '✗', style: S.red }))
    .with('aborted', () => ({ icon: '⊘', style: S.dim }))
    .exhaustive();
}

const text = (value: string, style?: string): Span =>
  style ? { text: value, style } : { text: value };
const blank = (): ContentLine => ({ line: [] });
const toContent = (lines: Line[]): ContentLine[] => lines.map(line => ({ line }));

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

interface Column {
  line: Line;
  width: number;
  align?: 'right';
}

function fitCell(cell: Column): Line {
  const width = lineWidth(cell.line);
  if (cell.align !== 'right' || width >= cell.width) return fitLine(cell.line, cell.width);
  return [text(' '.repeat(cell.width - width)), ...cell.line];
}

function columns(cells: Column[], gap = 2): Line {
  return cells.flatMap((cell, index) =>
    index === 0 ? fitCell(cell) : [text(' '.repeat(gap)), ...fitCell(cell)],
  );
}

export function withStyle(line: Line, style: string): Line {
  return line.map(span => ({ ...span, style: span.style ? `${span.style};${style}` : style }));
}

function onBackground(line: Line, background: string): Line {
  return line.map(span => ({
    ...span,
    style: span.style ? `${background};${span.style}` : background,
  }));
}

function titleSpans(title: string, isFocused: boolean, icon: Span | undefined): Line {
  const [, key, name = title] = /^\[(\S+)\] (.*)$/.exec(title) ?? [];
  return [
    ...(icon ? [icon, text(' ')] : []),
    ...(key ? [text(`${key}  `, S.grey)] : []),
    text(name, isFocused ? S.boldMagenta : S.heading),
  ];
}

interface BoxOptions {
  title: string;
  width: number;
  height: number;
  body: Line[];
  isFocused: boolean;
  footer?: string | undefined;
  highlightRow?: number | null;
  icon?: Span;
  tone?: 'panel' | 'popup';
}

// A filled card like the dashboard's: title row on top, an accent bar on the left while focused,
// and a row and a column of page around a panel so neighbours stay apart.
// Body lines get one cell of padding on each side, so they should be width - 4 wide.
export function box({
  title,
  width,
  height,
  body,
  isFocused,
  footer,
  highlightRow,
  icon,
  tone = 'panel',
}: BoxOptions): Line[] {
  const isPopup = match(tone)
    .with('popup', () => true)
    .with('panel', () => false)
    .exhaustive();
  const fill = isPopup ? S.popup : S.surface;
  const inner = width - 4;
  const bar = isFocused ? text('▌', S.accent) : text(' ');
  const footerLine: Line = footer ? [text(footer, isFocused ? S.cyan : S.grey)] : [];
  const header: Line = [
    ...fitLine(titleSpans(title, isFocused, icon), Math.max(0, inner - lineWidth(footerLine))),
    ...footerLine,
  ];
  const edge = text(' ');
  const row = (content: Line, background = fill): Line => [
    ...onBackground([bar], fill),
    ...onBackground([text(' '), ...fitLine(content, inner), text(' ')], background),
    ...(isPopup ? onBackground([edge], fill) : [edge]),
  ];
  const rows = Array.from({ length: Math.max(0, height - 2) }, (_, index) => {
    const content = body[index] ?? [];
    if (index !== highlightRow) return row(content);
    return row(content, `${fill};${isFocused ? S.selected : S.hover}`);
  });
  const last = isPopup ? row([]) : [text(' '.repeat(width))];
  return [row(header), ...rows, last];
}

export function overlayOnto(frame: Line[], popup: Line[], width: number): Line[] {
  const popupWidth = lineWidth(popup[0] ?? []);
  const top = Math.max(0, Math.floor((frame.length - popup.length) / 2));
  const left = Math.max(0, Math.floor((width - popupWidth) / 2));
  return frame.map((row, index) => {
    const popupRow = popup[index - top];
    if (!popupRow) return row;
    return [...sliceLine(row, 0, left), ...popupRow, ...sliceLine(row, left + popupWidth, width)];
  });
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
            : 'is it running? check with the status command',
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
  ];
}

export function formatCopyright(version: string | undefined, now: number): string {
  const copyright = `© ${new Date(now).getFullYear()}`;
  return version === undefined ? copyright : `v${version} · ${copyright}`;
}

function formatQueueLabel(count: number): string {
  return `${count} in queue`;
}

export function getRoutineTabs(routine: RoutineSummary): RoutineTab[] {
  return routine.webhook ? ['runs', 'prompt', 'skips', 'queue'] : ['runs', 'prompt', 'skips'];
}

export function routineRow(routine: RoutineSummary, width: number, now: number): Line {
  const icon = routine.running
    ? text(spinner(now), S.yellow)
    : routine.lastRun
      ? statusIcon(routine.lastRun.status, now)
      : text('·', S.dim);
  const next = !routine.enabled
    ? 'off'
    : routine.nextRunAt
      ? formatRelativeCompact(routine.nextRunAt, now)
      : 'manual';
  return [
    icon,
    text(' '),
    ...columns([
      {
        line: [
          text(routine.name, routine.running ? S.boldYellow : routine.enabled ? undefined : S.dim),
          ...(routine.queuedWebhooks > 0
            ? [text(`  ${formatQueueLabel(routine.queuedWebhooks)}`, S.yellow)]
            : []),
        ],
        width: Math.max(4, width - 13),
      },
      { line: [text(next, routine.nextRunAt ? S.cyan : S.dim)], width: 9, align: 'right' },
    ]),
  ];
}

export function runRow(run: RunRecord, width: number, now: number): Line {
  return [
    statusIcon(run.status, now),
    text(' '),
    ...columns(
      [
        { line: [text(run.routine)], width: Math.max(4, width - 21) },
        {
          line: [text(formatRelativeCompact(run.startedAt, now), S.cyan)],
          width: 10,
          align: 'right',
        },
        {
          line: [text(formatDuration(getRunDurationMs(run, now)), S.magenta)],
          width: 7,
          align: 'right',
        },
      ],
      1,
    ),
  ];
}

interface DetailPair {
  label: string;
  value: Line;
  isWide?: boolean;
}

function detailRows(pairs: DetailPair[], width: number): Line[] {
  const labelWidth = 10;
  const isTwoColumn = width >= 96;
  const half = Math.floor(width / 2);
  const rows: Line[] = [];
  const label = (value: string): Span => text(value.padEnd(labelWidth), S.dim);
  const queue = [...pairs];
  for (let pair = queue.shift(); pair !== undefined; pair = queue.shift()) {
    const next = queue[0];
    if (isTwoColumn && pair.isWide !== true && next !== undefined && next.isWide !== true) {
      rows.push([
        ...fitLine([label(pair.label), ...pair.value], half),
        ...fitLine([label(next.label), ...next.value], width - half),
      ]);
      queue.shift();
      continue;
    }
    const [first = [], ...rest] = wrapLine(pair.value, width - labelWidth);
    rows.push(
      [label(pair.label), ...first],
      ...rest.map(line => [text(' '.repeat(labelWidth)), ...line]),
    );
  }
  return rows;
}

function sectionTitle(title: string, aside?: string): Line {
  return [text(title.toUpperCase(), S.heading), ...(aside ? [text(`  ${aside}`, S.grey)] : [])];
}

function timeValue(iso: string | null, now: number): Line {
  if (!iso) return [text('-', S.dim)];
  return [text(formatTimestamp(iso)), text(` · ${formatRelativeCompact(iso, now)}`, S.cyan)];
}

interface Tab {
  id: RoutineTab;
  label: string;
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

function runsTable(
  routine: RoutineName,
  { runs, total }: RunsPage,
  width: number,
  now: number,
): ContentLine[] {
  if (runs.length === 0) return [{ line: [text('No runs yet.', S.dim)] }];
  const isWide = width >= 78;
  const header: Column[] = isWide
    ? [
        { line: [text('STATUS')], width: 12 },
        { line: [text('RUN')], width: 22 },
        { line: [text('TRIGGER')], width: 9 },
        { line: [text('STARTED')], width: 10, align: 'right' },
        { line: [text('DURATION')], width: 8, align: 'right' },
        { line: [text('TURNS')], width: 5, align: 'right' },
      ]
    : [
        { line: [text(' ')], width: 1 },
        { line: [text('RUN')], width: Math.max(8, width - 24) },
        { line: [text('STARTED')], width: 10, align: 'right' },
        { line: [text('TIME')], width: 7, align: 'right' },
      ];
  const headerLine = withStyle(columns(header), S.dim);
  const rows = runs.map((run): ContentLine => {
    const started: Line = [text(formatRelativeCompact(run.startedAt, now), S.cyan)];
    const duration: Line = [text(formatDuration(getRunDurationMs(run, now)), S.magenta)];
    const cells: Column[] = isWide
      ? [
          { line: statusBadge(run.status, now), width: 12 },
          { line: [text(run.id)], width: 22 },
          { line: [text(getTriggerLabel(run.trigger), S.dim)], width: 9 },
          { line: started, width: 10, align: 'right' },
          { line: duration, width: 8, align: 'right' },
          { line: [text(String(run.numTurns ?? '-'))], width: 5, align: 'right' },
        ]
      : [
          { line: [statusIcon(run.status, now)], width: 1 },
          { line: [text(run.id)], width: Math.max(8, width - 24) },
          { line: started, width: 10, align: 'right' },
          { line: duration, width: 7, align: 'right' },
        ];
    return { line: columns(cells), action: { kind: 'open-run', routine, id: run.id } };
  });
  const more = total - runs.length;
  return [
    { line: headerLine },
    ...rows,
    ...(more > 0 ? [{ line: [text(`${more} more…`, S.dim)] }] : []),
  ];
}

function skipsTable(skips: Skip[], now: number): ContentLine[] {
  if (skips.length === 0) return [{ line: [text('Nothing skipped.', S.dim)] }];
  const header = withStyle(
    columns([
      { line: [text('SKIPPED')], width: 10 },
      { line: [text('SCHEDULED FOR')], width: 22 },
      { line: [text('REASON')], width: 20 },
    ]),
    S.dim,
  );
  const rows = [...skips].reverse().map(skip =>
    columns([
      { line: [text(formatRelativeCompact(skip.at, now), S.cyan)], width: 10 },
      { line: [text(formatTimestamp(skip.scheduledFor))], width: 22 },
      { line: [text(getSkipReasonLabel(skip.reason), S.yellow)], width: 20 },
    ]),
  );
  return toContent([header, ...rows]);
}

const QUEUE_BODY_LINES = 3;

// Bodies from one sender often start alike.
function wrapQueueBody(preview: string, width: number): Line[] {
  const body = sanitize(preview.replace(/\s+/g, ' ').trim());
  if (body === '') return [[text('empty body', S.dim)]];
  const lines = wrapLine([text(body)], width);
  if (lines.length <= QUEUE_BODY_LINES) return lines;
  const kept = lines.slice(0, QUEUE_BODY_LINES - 1);
  const last = lines[QUEUE_BODY_LINES - 1] ?? [];
  return [...kept, [...sliceLine(last, 0, width - 1), text('…')]];
}

function buildQueueTable(queue: QueuedWebhook[], width: number, now: number): ContentLine[] {
  if (queue.length === 0) return [{ line: [text('Nothing in the queue.', S.dim)] }];
  const bodyWidth = Math.max(8, width - 30);
  const bodyIndent = text(' '.repeat(width - bodyWidth));
  const header = withStyle(
    columns([
      { line: [text('#')], width: 6 },
      { line: [text('QUEUED')], width: 10 },
      { line: [text('SIZE')], width: 8, align: 'right' },
      { line: [text('BODY')], width: bodyWidth },
    ]),
    S.dim,
  );
  const rows = queue.flatMap((webhook, index): Line[] => {
    const [first = [], ...rest] = wrapQueueBody(webhook.preview, bodyWidth);
    const position = text(getQueuePositionLabel(index), index === 0 ? S.boldYellow : undefined);
    return [
      columns([
        { line: [position], width: 6 },
        { line: [text(formatRelativeCompact(webhook.queuedAt, now), S.cyan)], width: 10 },
        { line: [text(formatPayloadSize(webhook.bytes), S.magenta)], width: 8, align: 'right' },
        { line: first, width: bodyWidth },
      ]),
      ...rest.map(line => [bodyIndent, ...line]),
    ];
  });
  return toContent([header, ...rows]);
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
    .exhaustive();
}

export function runHeaderLines(
  run: RunRecord,
  cwd: string | null,
  width: number,
  now: number,
): ContentLine[] {
  const pairs: DetailPair[] = [
    { label: 'status', value: statusBadge(run.status, now) },
    { label: 'trigger', value: [text(getTriggerLabel(run.trigger))] },
    ...(run.scheduledFor
      ? [{ label: 'scheduled', value: timeValue(run.scheduledFor, now), isWide: true }]
      : []),
    { label: 'started', value: timeValue(run.startedAt, now) },
    { label: 'ended', value: timeValue(run.endedAt, now) },
    { label: 'duration', value: [text(formatDuration(getRunDurationMs(run, now)), S.magenta)] },
    { label: 'turns', value: [text(String(run.numTurns ?? '-'))] },
    { label: 'agent', value: [text(run.agent, S.cyan)] },
    { label: 'model', value: [text(run.model ?? '-', S.blue)] },
    { label: 'exit code', value: [text(String(run.exitCode ?? '-'))] },
    { label: 'session', value: [text(run.sessionId ?? '-')], isWide: true },
    ...(run.resumeCommand === null
      ? []
      : [
          {
            label: 'resume',
            value: [text(`${cwd === null ? '' : `cd ${cwd} && `}${run.resumeCommand}`, S.cyan)],
            isWide: true,
          },
        ]),
    { label: 'log', value: [text(run.logFile, S.dim)], isWide: true },
  ];
  const lines: Line[] = [
    [text(run.id, S.boldMagenta), text(`  ${run.routine}`, S.cyan)],
    [],
    ...detailRows(pairs, width),
  ];
  if (run.error) {
    lines.push(
      [],
      ...sanitize(run.error)
        .split('\n')
        .flatMap(errorLine => wrapLine([text('▌ ', S.red), text(errorLine, S.red)], width, 2)),
    );
  }
  if (run.resultText)
    lines.push([], sectionTitle('Result'), ...renderMarkdown(run.resultText, width));
  return toContent(lines);
}

function formatInput(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return JSON.stringify(input ?? null, null, 2).split('\n');
  return Object.entries(input).flatMap(([key, value]) => {
    if (typeof value === 'string' && value.includes('\n'))
      return [`${key}:`, ...value.split('\n').map(line => `  ${line}`)];
    return [`${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`];
  });
}

function blockLines(
  label: string,
  source: string[],
  style: string | undefined,
  width: number,
): Line[] {
  const gutter = text('  │ ', S.grey);
  const body: Line[] = [];
  let isCut = false;
  for (const raw of source) {
    if (body.length >= MAX_BLOCK_LINES) {
      isCut = true;
      break;
    }
    isCut ||= raw.length > MAX_LINE_CHARS;
    body.push(
      ...wrapLine([text(sanitize(raw.slice(0, MAX_LINE_CHARS)), style)], Math.max(10, width - 4)),
    );
  }
  isCut ||= body.length > MAX_BLOCK_LINES;
  const lines: Line[] = [
    [gutter, text(label, S.bold)],
    ...body.slice(0, MAX_BLOCK_LINES).map(line => [gutter, ...line]),
  ];
  if (isCut) lines.push([gutter, text('… cut here, the full output is in the log file', S.dim)]);
  return lines;
}

function toolLines(
  tool: ToolItem,
  toggle: Span,
  isExpanded: boolean,
  width: number,
  isRunning: boolean,
): Line[] {
  const pending = tool.result === null && isRunning ? text(' … running', S.yellow) : null;
  const suffix = tool.result?.isError === true ? text(' ✗ error', S.red) : pending;
  const headerWidth = width - (suffix ? textWidth(suffix.text) : 0);
  const header = [
    ...fitLine(
      [
        toggle,
        text(tool.name, S.boldCyan),
        text('  '),
        text(sanitize(tool.preview).replace(/\s+/g, ' '), S.dim),
      ],
      headerWidth,
    ),
    ...(suffix ? [suffix] : []),
  ];
  if (!isExpanded) return [header];
  const result = tool.result
    ? blockLines(
        tool.result.isError ? 'Error' : 'Result',
        (tool.result.content || '(empty)').split('\n'),
        tool.result.isError ? S.red : undefined,
        width,
      )
    : blockLines('Result', [isRunning ? 'waiting for the result…' : 'no result'], S.dim, width);
  return [header, ...blockLines('Input', formatInput(tool.input), S.cyan, width), ...result];
}

function itemLines(
  item: TranscriptItem,
  isExpanded: boolean,
  width: number,
  isRunning: boolean,
): Line[] {
  const toggle = text(isExpanded ? '▾ ' : '▸ ', S.dim);
  return match(item)
    .with({ kind: 'hook' }, hook => {
      const exit = text(`exit ${hook.exitCode ?? '?'}`, hook.exitCode === 0 ? S.green : S.red);
      const header = fitLine(
        [
          hook.output ? toggle : text('  '),
          text('before hook', S.bold),
          text('  '),
          text(hook.command, S.cyan),
          text('  '),
          exit,
        ],
        width,
      );
      return isExpanded && hook.output
        ? [header, ...blockLines('Output', hook.output.split('\n'), undefined, width)]
        : [header];
    })
    .with({ kind: 'init' }, init =>
      wrapLine(
        [
          text('● ', S.green),
          text('Session started', S.bold),
          ...(init.model === null ? [] : [text(`  ${init.model}`, S.blue)]),
          ...(init.cwd === null ? [] : [text(`  ${init.cwd}`, S.dim)]),
          ...(init.toolCount === null ? [] : [text(`  ${init.toolCount} tools`, S.dim)]),
          ...(init.permissionMode === null
            ? []
            : [text(`  permission ${init.permissionMode}`, S.dim)]),
        ],
        width,
        2,
      ),
    )
    .with({ kind: 'model-fallback' }, fallback => {
      const reason = getModelFallbackReasonLabel(fallback.reason);
      return wrapLine(
        [
          text('↷ ', S.yellow),
          text('Switched model', S.bold),
          text(`  ${fallback.from} → `, S.dim),
          text(fallback.to, S.blue),
          ...(reason === null ? [] : [text(`  because ${reason}`, S.dim)]),
        ],
        width,
        2,
      );
    })
    .with({ kind: 'text' }, ({ text: source }) => renderMarkdown(source, width))
    .with({ kind: 'tool' }, tool => toolLines(tool, toggle, isExpanded, width, isRunning))
    .with({ kind: 'result' }, result => {
      const look = result.isError
        ? { icon: '✗', style: S.boldRed }
        : { icon: '✓', style: S.boldGreen };
      return [
        [
          text(`${look.icon} ${getTranscriptResultLabel(result.isError)}`, look.style),
          text(`  ${result.numTurns ?? '-'} turns`),
          text(`  ${formatDuration(result.durationMs)}`, S.magenta),
        ],
      ];
    })
    .exhaustive();
}

export function checkIsExpandable(item: TranscriptItem): boolean {
  return match(item)
    .with({ kind: 'tool' }, () => true)
    .with({ kind: 'hook' }, hook => hook.output !== '')
    .otherwise(() => false);
}

export function transcriptLines(
  items: TranscriptItem[],
  eventCount: number,
  expanded: Set<string>,
  width: number,
  isRunning: boolean,
): ContentLine[] {
  const lines: ContentLine[] = [
    blank(),
    { line: sectionTitle('Transcript', `${eventCount} events`) },
  ];
  if (items.length === 0)
    return [
      ...lines,
      {
        line: [text(getTranscriptEmptyLabel(isRunning), S.dim)],
      },
    ];
  let previousKind: TranscriptItem['kind'] | null = null;
  for (const item of items) {
    const isSubagent = checkIsSubagent(item);
    const needsGap =
      isMatching({ kind: P.union('text', 'result') }, item) || isMatching('text', previousKind);
    if (needsGap && (lines.at(-1)?.line.length ?? 0) > 0) lines.push(blank());
    const innerWidth = isSubagent ? width - 2 : width;
    const action: Action = { kind: 'toggle', key: item.key };
    itemLines(item, expanded.has(item.key), innerWidth, isRunning).forEach((line, index) => {
      lines.push({
        line: isSubagent ? [text('┊ ', S.grey), ...line] : line,
        itemKey: item.key,
        isItemStart: index === 0,
        ...(checkIsExpandable(item) ? { action } : {}),
      });
    });
    previousKind = item.kind;
  }
  return lines;
}

export const HELP: Array<[string, string]> = [
  ['↑ ↓  j k', 'move'],
  ['enter  l  →', 'open, expand a tool call'],
  ['esc  h  ←', 'back'],
  ['tab  shift-tab', 'next / previous panel'],
  ['1  2  0', 'routines / runs / detail'],
  ['g  G', 'top / bottom (G follows a running run)'],
  ['ctrl-d  ctrl-u', 'half page down / up'],
  ['pgdn  pgup', 'page down / up'],
  ['[  ]', 'routine tabs: runs, prompt, skipped'],
  ['{  }', 'previous / next transcript item'],
  ['e', 'expand or collapse every tool call'],
  ['r', 'run the selected routine now'],
  ['R  ctrl-r', 'refresh now'],
  ['?', 'toggle this help'],
  ['q  ctrl-c', 'quit'],
];

export function helpPopup(width: number, height: number): Line[] {
  const popupWidth = Math.min(64, width - 4);
  const keys: Line[] = HELP.map(([keys, label]) => [
    text(` ${keys.padEnd(18)}`, S.boldCyan),
    text(label),
  ]);
  // Drop the spacing and the footer when the terminal is too short for them.
  const body =
    keys.length + 5 <= height ? [[], ...keys, [], [text(' any key closes', S.dim)]] : keys;
  return box({
    title: 'Keys',
    width: popupWidth,
    height: body.length + 2,
    body,
    isFocused: true,
    footer: 'esc',
    tone: 'popup',
  });
}

export function confirmPopup(routine: RoutineName, width: number): Line[] {
  const popupWidth = Math.min(Math.max(44, textWidth(routine) + 20), width - 4);
  const body: Line[] = [
    [],
    [text(' Start '), text(routine, S.boldMagenta), text(' now?')],
    [text(' The daemon runs it in the background.', S.dim)],
    [],
    [
      text(' y', S.boldGreen),
      text(' start    '),
      text('any other key', S.boldRed),
      text(' cancel'),
    ],
  ];
  return box({
    title: 'Run now',
    width: popupWidth,
    height: body.length + 2,
    body,
    isFocused: true,
    tone: 'popup',
  });
}

export function hintsBar(hints: Array<[string, string]>, right: Line, width: number): Line {
  const left: Line = hints.flatMap(([key, label]) => [
    text(` ${key}`, S.boldCyan),
    text(` ${label}  `, S.dim),
  ]);
  const rightWidth = Math.min(lineWidth(right), Math.floor(width / 2));
  return [...fitLine(left, width - rightWidth - 1), text(' '), ...fitLine(right, rightWidth)];
}

import { isMatching, match, P } from 'ts-pattern';

import type { ToolItem, TranscriptItem } from 'domains/transcript/types';
import {
  checkIsSubagent,
  getHookLabel,
  getMessageSourceLabel,
  getModelFallbackReasonLabel,
  getTranscriptEmptyLabel,
  getTranscriptResultLabel,
  getTurnsLabel,
} from 'domains/transcript/utils';
import { formatDuration } from 'utils/date-time';

import { sectionTitle } from '../../components/section-title';
import { blank } from '../../page-content';
import type { Action, ContentLine } from '../../page-content';
import { renderMarkdown } from '../../terminal/markdown';
import { fitLine, S, sanitize, text, textWidth, wrapLine } from '../../terminal/text';
import type { Line, Span } from '../../terminal/text';

// Caps for expanded tool input/output: a 1MB minified line must not become 10k rows.
const MAX_BLOCK_LINES = 200;
const MAX_LINE_CHARS = 2000;

function formatInput(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return JSON.stringify(input ?? null, null, 2).split('\n');
  return Object.entries(input).flatMap(([key, value]) => {
    if (typeof value === 'string' && value.includes('\n'))
      return [`${key}:`, ...value.split('\n').map(line => `  ${line}`)];
    return [`${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`];
  });
}

function formatTurns(numTurns: number | null): string {
  return `${numTurns ?? '-'} ${getTurnsLabel(numTurns)}`;
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
          text(getHookLabel(hook.phase).toLowerCase(), S.bold),
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
    .with({ kind: 'message' }, message => {
      const sourceLabel = getMessageSourceLabel(message.source);
      return [
        ...(sourceLabel === null ? [] : wrapLine([text(`  ${sourceLabel}`, S.dim)], width, 2)),
        ...sanitize(message.text)
          .split('\n')
          .flatMap((line, index) =>
            wrapLine([text(index === 0 ? '› ' : '  ', S.accent), text(line, S.bold)], width, 2),
          ),
      ];
    })
    .with({ kind: 'tool' }, tool => toolLines(tool, toggle, isExpanded, width, isRunning))
    .with({ kind: 'result', isError: false }, result => [
      [
        text('✓ ', S.green),
        text(
          `${getTranscriptResultLabel(false)} · ${formatTurns(result.numTurns)} · ${formatDuration(result.durationMs)}`,
          S.dim,
        ),
      ],
    ])
    .with({ kind: 'result', isError: true }, result => [
      [
        text(`✗ ${getTranscriptResultLabel(true)}`, S.boldRed),
        text(`  ${formatTurns(result.numTurns)}`),
        text(`  ${formatDuration(result.durationMs)}`, S.magenta),
      ],
    ])
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
      isMatching({ kind: P.union('text', 'message', 'result') }, item) ||
      isMatching(P.union('text', 'message'), previousKind);
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

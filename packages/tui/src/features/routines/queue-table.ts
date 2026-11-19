import type { QueuedWebhook } from 'domains/webhook/types';
import { formatPayloadSize, getQueuePositionLabel } from 'domains/webhook/utils';
import { formatRelativeCompact } from 'utils/date-time';

import { columns, withStyle } from '../../components/columns';
import { toContent } from '../../page-content';
import type { ContentLine } from '../../page-content';
import { S, sanitize, sliceLine, text, wrapLine } from '../../terminal/text';
import type { Line } from '../../terminal/text';

const BODY_LINES = 3;

export function formatQueueLabel(count: number): string {
  return `${count} in queue`;
}

// Bodies from one sender often start alike.
export function wrapWebhookBody(preview: string, width: number): Line[] {
  const body = sanitize(preview.replace(/\s+/g, ' ').trim());
  if (body === '') return [[text('empty body', S.dim)]];
  const lines = wrapLine([text(body)], width);
  if (lines.length <= BODY_LINES) return lines;
  const kept = lines.slice(0, BODY_LINES - 1);
  const last = lines[BODY_LINES - 1] ?? [];
  return [...kept, [...sliceLine(last, 0, width - 1), text('…')]];
}

export function buildQueueTable(queue: QueuedWebhook[], width: number, now: number): ContentLine[] {
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
    const [first = [], ...rest] = wrapWebhookBody(webhook.preview, bodyWidth);
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

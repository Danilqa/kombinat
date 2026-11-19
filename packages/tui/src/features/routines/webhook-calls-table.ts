import { match } from 'ts-pattern';

import type { WebhookCall, WebhookCallOutcome } from 'domains/webhook/types';
import { formatPayloadSize, getWebhookCallOutcomeLabel } from 'domains/webhook/utils';
import { formatRelativeCompact } from 'utils/date-time';

import { columns, withStyle } from '../../components/columns';
import { toContent } from '../../page-content';
import type { ContentLine } from '../../page-content';
import { S, sanitize, text, wrapLine } from '../../terminal/text';
import type { Line } from '../../terminal/text';
import { wrapWebhookBody } from './queue-table';

const BODY_INDENT = 12;

function getOutcomeStyle(outcome: WebhookCallOutcome): string {
  return match(outcome)
    .with('started', 'continued', 'queued', () => S.green)
    .with('ignored', () => S.dim)
    .with('disabled', 'queue_full', () => S.yellow)
    .with('rejected', 'timed_out', () => S.red)
    .exhaustive();
}

export function buildWebhookCallsTable(
  calls: WebhookCall[],
  width: number,
  now: number,
): ContentLine[] {
  if (calls.length === 0) return [{ line: [text('No webhook calls yet.', S.dim)] }];
  const indent = text(' '.repeat(BODY_INDENT));
  const detailWidth = Math.max(8, width - BODY_INDENT);
  const header = withStyle(
    columns([
      { line: [text('RECEIVED')], width: 10 },
      { line: [text('STATUS')], width: 6 },
      { line: [text('OUTCOME')], width: 20 },
      { line: [text('SIZE')], width: 8, align: 'right' },
    ]),
    S.dim,
  );
  const rows = calls.flatMap((call): Line[] => {
    const style = getOutcomeStyle(call.outcome);
    const reason =
      call.reason === null ? [] : wrapLine([text(sanitize(call.reason), S.red)], detailWidth);
    return [
      columns([
        { line: [text(formatRelativeCompact(call.receivedAt, now), S.cyan)], width: 10 },
        { line: [text(String(call.status), style)], width: 6 },
        { line: [text(getWebhookCallOutcomeLabel(call.outcome), style)], width: 20 },
        { line: [text(formatPayloadSize(call.bytes), S.magenta)], width: 8, align: 'right' },
      ]),
      ...[...reason, ...wrapWebhookBody(call.preview, detailWidth)].map(line => [indent, ...line]),
    ];
  });
  return toContent([header, ...rows]);
}

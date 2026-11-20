import type { RunRecord } from 'domains/run/types';
import {
  checkIsWaitingForSlot,
  formatTokens,
  getRunDurationMs,
  getTokenTotal,
  getTriggerLabel,
} from 'domains/run/utils';
import { getUsageLimitLabel } from 'domains/transcript/utils';
import { formatDuration } from 'utils/date-time';

import { detailRows, timeValue } from '../../components/detail-rows';
import type { DetailPair } from '../../components/detail-rows';
import { statusBadge } from '../../components/run-status';
import { sectionTitle } from '../../components/section-title';
import { toContent } from '../../page-content';
import type { ContentLine } from '../../page-content';
import { renderMarkdown } from '../../terminal/markdown';
import { S, sanitize, text, wrapLine } from '../../terminal/text';
import type { Line } from '../../terminal/text';

export function runHeaderLines(
  run: RunRecord,
  cwd: string | null,
  width: number,
  now: number,
): ContentLine[] {
  const pairs: DetailPair[] = [
    { label: 'status', value: statusBadge(run.status, now) },
    ...(run.usageLimit === null
      ? []
      : [
          {
            label: 'continues',
            value: checkIsWaitingForSlot(run.usageLimit, now)
              ? [
                  text('once another run finishes'),
                  text(`  the ${getUsageLimitLabel(run.usageLimit.limit)} has reset`, S.dim),
                ]
              : [
                  ...timeValue(run.usageLimit.continuesAt, now),
                  text(`  after the ${getUsageLimitLabel(run.usageLimit.limit)}`, S.dim),
                ],
            isWide: true,
          },
        ]),
    { label: 'trigger', value: [text(getTriggerLabel(run.trigger))] },
    ...(run.scheduledFor
      ? [{ label: 'scheduled', value: timeValue(run.scheduledFor, now), isWide: true }]
      : []),
    { label: 'started', value: timeValue(run.startedAt, now) },
    { label: 'ended', value: timeValue(run.endedAt, now) },
    { label: 'duration', value: [text(formatDuration(getRunDurationMs(run, now)), S.magenta)] },
    { label: 'turns', value: [text(String(run.numTurns ?? '-'))] },
    {
      label: 'tokens',
      value: [text(run.tokens === null ? '-' : formatTokens(getTokenTotal(run.tokens)))],
    },
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

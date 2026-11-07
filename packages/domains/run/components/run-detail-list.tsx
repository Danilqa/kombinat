import { DetailList, type DetailEntry } from 'design-system/components/detail-list';
import { RelativeTime } from 'design-system/components/relative-time';
import { formatDuration, formatShort } from 'utils/date-time';

import type { RunRecord } from '../types';
import { getRunDurationMs, getTriggerLabel } from '../utils';

function formatOptionalTime(iso: string | null) {
  return iso ? (
    <span className="flex flex-wrap gap-x-2 tabular-nums">
      <span>{formatShort(iso)}</span>
      <RelativeTime iso={iso} className="text-fg-muted" />
    </span>
  ) : (
    '-'
  );
}

function getSummaryEntries(run: RunRecord): DetailEntry[] {
  return [
    { label: 'Trigger', value: getTriggerLabel(run.trigger) },
    ...(run.scheduledFor
      ? [{ label: 'Scheduled for', value: formatOptionalTime(run.scheduledFor) }]
      : []),
    { label: 'Started', value: formatOptionalTime(run.startedAt) },
    { label: 'Ended', value: formatOptionalTime(run.endedAt) },
    { label: 'Duration', value: formatDuration(getRunDurationMs(run)) },
    { label: 'Turns', value: run.numTurns ?? '-' },
    { label: 'Agent', value: run.agent, isMono: true },
    { label: 'Model', value: run.model ?? '-', isMono: true },
    { label: 'Session', value: run.sessionId ?? '-', isMono: true, span: 'wide' },
    ...(run.resumeCommand === null
      ? []
      : [{ label: 'Resume', value: run.resumeCommand, isMono: true, span: 'wide' as const }]),
    { label: 'Exit code', value: run.exitCode ?? '-', isMono: true },
    { label: 'PID', value: run.pid ?? '-', isMono: true },
    { label: 'Log', value: run.logFile, isMono: true, span: 'full' },
  ];
}

interface RunDetailListProps {
  run: RunRecord;
}

export function RunDetailList({ run }: RunDetailListProps) {
  return <DetailList entries={getSummaryEntries(run)} />;
}

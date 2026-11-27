import { useLiveText } from 'design-system';
import type { RunRecord } from 'domains/run/types';
import { getRunDurationMs } from 'domains/run/utils';
import { formatDuration } from 'utils/date-time';

interface RunDurationProps {
  run: Pick<RunRecord, 'startedAt' | 'endedAt'>;
}

export function RunDuration({ run }: RunDurationProps) {
  return useLiveText(now => formatDuration(getRunDurationMs(run, now)));
}

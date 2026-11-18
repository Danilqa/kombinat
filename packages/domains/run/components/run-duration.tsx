import { useLiveText } from 'design-system/utils';
import { formatDuration } from 'utils/date-time';

import type { RunRecord } from '../types';
import { getRunDurationMs } from '../utils';

interface RunDurationProps {
  run: Pick<RunRecord, 'startedAt' | 'endedAt'>;
}

export function RunDuration({ run }: RunDurationProps) {
  return useLiveText(now => formatDuration(getRunDurationMs(run, now)));
}

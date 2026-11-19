import { RUN_RETENTION_DAYS_OPTIONS } from 'domains/settings/constants';
import type { Settings } from 'domains/settings/types';
import { getRunRetentionLabel } from 'domains/settings/utils';

import { S, text } from '../terminal/text';
import type { Line } from '../terminal/text';
import { box } from './box';

export function settingsPopup({ runRetentionDays }: Settings, width: number): Line[] {
  const options: Line[] = RUN_RETENTION_DAYS_OPTIONS.map((days, index) => {
    const isCurrent = days === runRetentionDays;
    return [
      text(` ${index + 1}  `, S.boldCyan),
      text(isCurrent ? '● ' : '○ ', isCurrent ? S.boldGreen : S.dim),
      text(getRunRetentionLabel(days)),
    ];
  });
  const body: Line[] = [
    [],
    [text(' Keep runs for')],
    ...options,
    [text(' Older runs and webhook calls are', S.dim)],
    [text(' deleted, except the last run of each', S.dim)],
    [text(' routine.', S.dim)],
    [],
    [
      text(` 1-${RUN_RETENTION_DAYS_OPTIONS.length}`, S.boldGreen),
      text(' pick    '),
      text('any other key', S.boldRed),
      text(' cancel'),
    ],
  ];
  return box({
    title: 'Settings',
    width: Math.min(44, width - 4),
    height: body.length + 2,
    body,
    isFocused: true,
    tone: 'popup',
  });
}

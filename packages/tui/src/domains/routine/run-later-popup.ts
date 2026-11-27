import type { RoutineName } from 'domains/routine/ids';
import type { RunLaterPreset } from 'domains/scheduler/types';
import { formatDayTime } from 'utils/date-time';

import { box } from '../../terminal/box';
import { S, text, textWidth } from '../../terminal/text';
import type { Line } from '../../terminal/text';

const LABEL_WIDTH = 22;

export function runLaterPopup(
  routine: RoutineName,
  presets: RunLaterPreset[],
  width: number,
): Line[] {
  const options: Line[] = presets.map(({ label, at }, index) => [
    text(` ${index + 1}  `, S.boldCyan),
    text(label.padEnd(LABEL_WIDTH)),
    text(formatDayTime(at.toISOString()), S.dim),
  ]);
  const body: Line[] = [
    [],
    [text(' Run '), text(routine, S.boldMagenta), text(' once at')],
    ...options,
    [text(' The routine file stays as it is.', S.dim)],
    [],
    [
      text(` 1-${presets.length}`, S.boldGreen),
      text(' pick    '),
      text('any other key', S.boldRed),
      text(' cancel'),
    ],
  ];
  return box({
    title: 'Run once later',
    width: Math.min(Math.max(46, textWidth(routine) + 20), width - 4),
    height: body.length + 2,
    body,
    isFocused: true,
    tone: 'popup',
  });
}

import type { RoutineName } from 'domains/routine/ids';

import { S, text, textWidth } from '../terminal/text';
import type { Line } from '../terminal/text';
import { box } from './box';

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

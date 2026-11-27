import { match, P } from 'ts-pattern';

import type { ReleaseUpdate } from 'domains/release/types';
import { getOfferedRelease } from 'domains/release/utils';
import { formatRelativeCompact } from 'utils/date-time';

import type { Focus, Message, Page } from './app-types';
import { fitLine, lineWidth, S, text } from './terminal/text';
import type { Line } from './terminal/text';

type Hint = [string, string];

const MESSAGE_MS = 6000;

function hints(focus: Focus, page: Page | undefined): Hint[] {
  const tail: Hint[] = [
    ['?', 'help'],
    ['q', 'quit'],
  ];
  return match({ focus, page })
    .with({ focus: P.union('routines', 'runs') }, (): Hint[] => [
      ['↑↓', 'move'],
      ['enter', 'open'],
      ['r', 'run now'],
      ['L', 'run later'],
      ['tab', 'panels'],
      ['R', 'refresh'],
      ...tail,
    ])
    .with({ page: { kind: 'run' } }, (): Hint[] => [
      ['↑↓', 'move'],
      ['enter', 'expand'],
      ['e', 'expand all'],
      ['{ }', 'items'],
      ['G', 'follow'],
      ['esc', 'back'],
      ['r', 'run now'],
      ['L', 'run later'],
      ...tail,
    ])
    .with({ page: { kind: 'routine', tab: 'runs' } }, (): Hint[] => [
      ['↑↓', 'move'],
      ['enter', 'open run'],
      ['[ ]', 'tabs'],
      ['esc', 'back'],
      ['r', 'run now'],
      ['L', 'run later'],
      ...tail,
    ])
    .otherwise((): Hint[] => [
      ['↑↓', 'scroll'],
      ['[ ]', 'tabs'],
      ['esc', 'back'],
      ['r', 'run now'],
      ['L', 'run later'],
      ...tail,
    ]);
}

interface StatusRightInput {
  message: Message | null;
  overviewError: string | null;
  loadedAt: number | null;
  releaseUpdate: ReleaseUpdate | null;
  now: number;
}

function statusRight({
  message,
  overviewError,
  loadedAt,
  releaseUpdate,
  now,
}: StatusRightInput): Line {
  if (message && now - message.at < MESSAGE_MS)
    return [
      {
        text: message.text,
        style: match(message.tone)
          .with('ok', () => S.boldGreen)
          .with('error', () => S.boldRed)
          .exhaustive(),
      },
    ];
  if (overviewError) return [{ text: overviewError, style: S.red }];
  if (loadedAt === null) return [];
  const offered = releaseUpdate ? getOfferedRelease(releaseUpdate) : null;
  return [
    ...(offered === null
      ? []
      : [
          { text: `kombinat ${offered.version} is available`, style: S.boldYellow },
          { text: ' · ', style: S.dim },
        ]),
    {
      text: `updated ${formatRelativeCompact(new Date(loadedAt).toISOString(), now)}`,
      style: S.dim,
    },
  ];
}

interface BottomBarInput extends StatusRightInput {
  focus: Focus;
  page: Page | undefined;
  width: number;
}

export function bottomBar({ focus, page, width, ...status }: BottomBarInput): Line {
  const left: Line = hints(focus, page).flatMap(([key, label]) => [
    text(` ${key}`, S.boldCyan),
    text(` ${label}  `, S.dim),
  ]);
  const right = statusRight(status);
  const rightWidth = Math.min(lineWidth(right), Math.floor(width / 2));
  return [...fitLine(left, width - rightWidth - 1), text(' '), ...fitLine(right, rightWidth)];
}

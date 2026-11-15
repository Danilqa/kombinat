import { S, text } from '../terminal/text';
import type { Line } from '../terminal/text';
import { box } from './box';

export const HELP: Array<[string, string]> = [
  ['↑ ↓  j k', 'move'],
  ['enter  l  →', 'open, expand a tool call'],
  ['esc  h  ←', 'back'],
  ['tab  shift-tab', 'next / previous panel'],
  ['1  2  0', 'routines / runs / detail'],
  ['g  G', 'top / bottom (G follows a running run)'],
  ['ctrl-d  ctrl-u', 'half page down / up'],
  ['pgdn  pgup', 'page down / up'],
  ['[  ]', 'routine tabs: runs, prompt, skipped'],
  ['{  }', 'previous / next transcript item'],
  ['e', 'expand or collapse every tool call'],
  ['r', 'run the selected routine now'],
  ['R  ctrl-r', 'refresh now'],
  ['?', 'toggle this help'],
  ['q  ctrl-c', 'quit'],
];

export function helpPopup(width: number, height: number): Line[] {
  const popupWidth = Math.min(64, width - 4);
  const keys: Line[] = HELP.map(([keys, label]) => [
    text(` ${keys.padEnd(18)}`, S.boldCyan),
    text(label),
  ]);
  // Drop the spacing and the footer when the terminal is too short for them.
  const body =
    keys.length + 5 <= height ? [[], ...keys, [], [text(' any key closes', S.dim)]] : keys;
  return box({
    title: 'Keys',
    width: popupWidth,
    height: body.length + 2,
    body,
    isFocused: true,
    footer: 'esc',
    tone: 'popup',
  });
}

import { match } from 'ts-pattern';

import { fitLine, lineWidth, S, sliceLine, text } from './text';
import type { Line, Span } from './text';

function onBackground(line: Line, background: string): Line {
  return line.map(span => ({
    ...span,
    style: span.style ? `${background};${span.style}` : background,
  }));
}

function titleSpans(title: string, isFocused: boolean, icon: Span | undefined): Line {
  const [, key, name = title] = /^\[(\S+)\] (.*)$/.exec(title) ?? [];
  return [
    ...(icon ? [icon, text(' ')] : []),
    ...(key ? [text(`${key}  `, S.grey)] : []),
    text(name, isFocused ? S.boldMagenta : S.heading),
  ];
}

interface BoxOptions {
  title: string;
  width: number;
  height: number;
  body: Line[];
  isFocused: boolean;
  footer?: string | undefined;
  highlightRow?: number | null;
  icon?: Span;
  tone?: 'panel' | 'popup';
}

// A filled card like the dashboard's: title row on top, an accent bar on the left while focused,
// and a row and a column of page around a panel so neighbours stay apart.
// Body lines get one cell of padding on each side, so they should be width - 4 wide.
export function box({
  title,
  width,
  height,
  body,
  isFocused,
  footer,
  highlightRow,
  icon,
  tone = 'panel',
}: BoxOptions): Line[] {
  const isPopup = match(tone)
    .with('popup', () => true)
    .with('panel', () => false)
    .exhaustive();
  const fill = isPopup ? S.popup : S.surface;
  const inner = width - 4;
  const bar = isFocused ? text('▌', S.accent) : text(' ');
  const footerLine: Line = footer ? [text(footer, isFocused ? S.cyan : S.grey)] : [];
  const header: Line = [
    ...fitLine(titleSpans(title, isFocused, icon), Math.max(0, inner - lineWidth(footerLine))),
    ...footerLine,
  ];
  const edge = text(' ');
  const row = (content: Line, background = fill): Line => [
    ...onBackground([bar], fill),
    ...onBackground([text(' '), ...fitLine(content, inner), text(' ')], background),
    ...(isPopup ? onBackground([edge], fill) : [edge]),
  ];
  const rows = Array.from({ length: Math.max(0, height - 2) }, (_, index) => {
    const content = body[index] ?? [];
    if (index !== highlightRow) return row(content);
    return row(content, `${fill};${isFocused ? S.selected : S.hover}`);
  });
  const last = isPopup ? row([]) : [text(' '.repeat(width))];
  return [row(header), ...rows, last];
}

export function overlayOnto(frame: Line[], popup: Line[], width: number): Line[] {
  const popupWidth = lineWidth(popup[0] ?? []);
  const top = Math.max(0, Math.floor((frame.length - popup.length) / 2));
  const left = Math.max(0, Math.floor((width - popupWidth) / 2));
  return frame.map((row, index) => {
    const popupRow = popup[index - top];
    if (!popupRow) return row;
    return [...sliceLine(row, 0, left), ...popupRow, ...sliceLine(row, left + popupWidth, width)];
  });
}

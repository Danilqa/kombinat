import { stripVTControlCharacters } from 'node:util';

import { bg, fg } from './theme';

// `style` holds SGR parameters ("1;32" = bold green), `link` becomes an OSC 8 hyperlink.
export interface Span {
  text: string;
  style?: string;
  link?: string;
}
export type Line = Span[];

// Named after what they used to be in 16 colours; the values come from the dashboard palette.
export const S = {
  bold: '1',
  dim: fg('muted'),
  italic: '3',
  underline: '4',
  inverse: '7',
  red: fg('negative'),
  green: fg('positive'),
  yellow: fg('warning'),
  blue: fg('info'),
  magenta: fg('fg'),
  cyan: fg('secondary'),
  grey: fg('faint'),
  accent: fg('accent'),
  boldRed: `1;${fg('negative')}`,
  boldGreen: `1;${fg('positive')}`,
  boldYellow: `1;${fg('warning')}`,
  boldBlue: `1;${fg('info')}`,
  boldMagenta: `1;${fg('fg')}`,
  boldCyan: `1;${fg('fg')}`,
  heading: `1;${fg('secondary')}`,
  selected: bg('overlay'),
  hover: bg('raised'),
  surface: bg('surface'),
  popup: bg('overlay'),
} as const;

const ZERO_WIDTH: Array<[number, number]> = [
  [0x0300, 0x036f],
  [0x200b, 0x200f],
  [0x20d0, 0x20ff],
  [0xfe00, 0xfe0f],
  [0xfe20, 0xfe2f],
  [0x1f3fb, 0x1f3ff],
  [0xe0100, 0xe01ef],
];

const WIDE: Array<[number, number]> = [
  [0x1100, 0x115f],
  [0x231a, 0x231b],
  [0x2329, 0x232a],
  [0x23e9, 0x23ec],
  [0x23f0, 0x23f0],
  [0x23f3, 0x23f3],
  [0x25fd, 0x25fe],
  [0x2614, 0x2615],
  [0x2648, 0x2653],
  [0x267f, 0x267f],
  [0x2693, 0x2693],
  [0x26a1, 0x26a1],
  [0x26aa, 0x26ab],
  [0x26bd, 0x26be],
  [0x26c4, 0x26c5],
  [0x26ce, 0x26ce],
  [0x26d4, 0x26d4],
  [0x26ea, 0x26ea],
  [0x26f2, 0x26f3],
  [0x26f5, 0x26f5],
  [0x26fa, 0x26fa],
  [0x26fd, 0x26fd],
  [0x2705, 0x2705],
  [0x270a, 0x270b],
  [0x2728, 0x2728],
  [0x274c, 0x274c],
  [0x274e, 0x274e],
  [0x2753, 0x2755],
  [0x2757, 0x2757],
  [0x2795, 0x2797],
  [0x27b0, 0x27b0],
  [0x27bf, 0x27bf],
  [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f004, 0x1f004],
  [0x1f0cf, 0x1f0cf],
  [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a],
  [0x1f200, 0x1f251],
  [0x1f300, 0x1f64f],
  [0x1f680, 0x1f6ff],
  [0x1f7e0, 0x1f7eb],
  [0x1f900, 0x1f9ff],
  [0x1fa70, 0x1faff],
  [0x20000, 0x3fffd],
];

function inRanges(code: number, ranges: Array<[number, number]>): boolean {
  for (const [from, to] of ranges) {
    if (code < from) return false;
    if (code <= to) return true;
  }
  return false;
}

export function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0x200d || inRanges(code, ZERO_WIDTH)) return 0;
  return inRanges(code, WIDE) ? 2 : 1;
}

export function textWidth(text: string): number {
  let width = 0;
  for (const char of text) width += charWidth(char);
  return width;
}

// Strips escape codes, control and format characters, and variation selectors (terminals disagree on their width).
export function sanitize(text: string): string {
  return stripVTControlCharacters(text)
    .replace(/\t/g, '  ')
    .replace(/(?!\n)[\p{Cc}\p{Cf}\p{Variation_Selector}]/gu, '');
}

export function lineWidth(line: Line): number {
  return line.reduce((sum, span) => sum + textWidth(span.text), 0);
}

export function plain(line: Line): string {
  return line.map(span => span.text).join('');
}

function pushText(out: Line, text: string, source: Span): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.style === source.style && last.link === source.link) {
    last.text += text;
    return;
  }
  const span: Span = { text };
  if (source.style !== undefined) span.style = source.style;
  if (source.link !== undefined) span.link = source.link;
  out.push(span);
}

// Cells [start, end). A wide character cut in half becomes a space.
export function sliceLine(line: Line, start: number, end: number): Line {
  const out: Line = [];
  let col = 0;
  for (const span of line) {
    let text = '';
    for (const char of span.text) {
      const w = charWidth(char);
      if (col >= start && col + w <= end) text += char;
      else if (w === 2 && col < end && col + w > start) text += ' ';
      col += w;
      if (col >= end) break;
    }
    pushText(out, text, span);
    if (col >= end) break;
  }
  return out;
}

export function fitLine(line: Line, width: number): Line {
  const current = lineWidth(line);
  if (current <= width)
    return current === width ? line : [...line, { text: ' '.repeat(width - current) }];
  if (width <= 0) return [];
  const out: Line = [];
  let col = 0;
  let lastSpan: Span = line[0] ?? { text: '' };
  outer: for (const span of line) {
    let text = '';
    for (const char of span.text) {
      const w = charWidth(char);
      if (col + w > width - 1) {
        pushText(out, text, span);
        lastSpan = span;
        break outer;
      }
      text += char;
      col += w;
    }
    pushText(out, text, span);
    lastSpan = span;
  }
  pushText(out, '…', lastSpan);
  col += 1;
  return col < width ? [...out, { text: ' '.repeat(width - col) }] : out;
}

interface Cell {
  char: string;
  width: number;
  span: Span;
}

function toLine(cells: Cell[]): Line {
  const out: Line = [];
  for (const cell of cells) pushText(out, cell.char, cell.span);
  return out;
}

function cellAfterColumns(cells: Cell[], from: number, columns: number): number {
  let index = from;
  for (let col = 0; index < cells.length && col < columns; index++) {
    col += cells[index]?.width ?? 0;
  }
  return index;
}

// Continuation lines get a hanging `indent`, and the first line never breaks inside those cells.
export function wrapLine(line: Line, width: number, indent = 0): Line[] {
  const hang = indent < width ? indent : 0;
  const cells: Cell[] = line.flatMap(span =>
    Array.from(span.text, char => ({ char, width: charWidth(char), span })),
  );
  const lines: Line[] = [];
  let start = 0;
  while (start < cells.length || lines.length === 0) {
    const isFirst = lines.length === 0;
    if (!isFirst) while (cells[start]?.char === ' ') start++;
    if (start >= cells.length && !isFirst) break;
    const available = isFirst ? width : width - hang;
    let end = start;
    let used = 0;
    for (
      let cell = cells[end];
      cell !== undefined && used + cell.width <= available;
      cell = cells[end]
    ) {
      used += cell.width;
      end++;
    }
    if (end === start && end < cells.length) end++;
    if (end < cells.length) {
      const minBreak = Math.max(start + 1, isFirst ? cellAfterColumns(cells, start, hang) : 0);
      for (let i = end; i >= minBreak; i--) {
        if (cells[i]?.char !== ' ') continue;
        end = i;
        break;
      }
    }
    let last = end;
    while (last > start && cells[last - 1]?.char === ' ') last--;
    const body = toLine(cells.slice(start, last));
    lines.push(isFirst || hang === 0 ? body : [{ text: ' '.repeat(hang) }, ...body]);
    start = end;
  }
  return lines;
}

function sgr(base: string | undefined, style: string | undefined): string {
  const params = [base, style].filter(Boolean).join(';');
  return params ? `\x1b[0;${params}m` : '\x1b[0m';
}

export function toAnsi(line: Line, base?: string): string {
  let out = '';
  for (const span of line) {
    const text = span.link ? `\x1b]8;;${span.link}\x07${span.text}\x1b]8;;\x07` : span.text;
    out += sgr(base, span.style) + text;
  }
  return `${out}\x1b[0m`;
}

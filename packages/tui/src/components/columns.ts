import { fitLine, lineWidth, text } from '../terminal/text';
import type { Line } from '../terminal/text';

export interface Column {
  line: Line;
  width: number;
  align?: 'right';
}

function fitCell(cell: Column): Line {
  const width = lineWidth(cell.line);
  if (cell.align !== 'right' || width >= cell.width) return fitLine(cell.line, cell.width);
  return [text(' '.repeat(cell.width - width)), ...cell.line];
}

export function columns(cells: Column[], gap = 2): Line {
  return cells.flatMap((cell, index) =>
    index === 0 ? fitCell(cell) : [text(' '.repeat(gap)), ...fitCell(cell)],
  );
}

export function withStyle(line: Line, style: string): Line {
  return line.map(span => ({ ...span, style: span.style ? `${span.style};${style}` : style }));
}

import { fitLine, lineWidth, S, text } from '../terminal/text';
import type { Line } from '../terminal/text';

export function hintsBar(hints: Array<[string, string]>, right: Line, width: number): Line {
  const left: Line = hints.flatMap(([key, label]) => [
    text(` ${key}`, S.boldCyan),
    text(` ${label}  `, S.dim),
  ]);
  const rightWidth = Math.min(lineWidth(right), Math.floor(width / 2));
  return [...fitLine(left, width - rightWidth - 1), text(' '), ...fitLine(right, rightWidth)];
}

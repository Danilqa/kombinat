import { S, text } from '../terminal/text';
import type { Line } from '../terminal/text';

export function sectionTitle(title: string, aside?: string): Line {
  return [text(title.toUpperCase(), S.heading), ...(aside ? [text(`  ${aside}`, S.grey)] : [])];
}

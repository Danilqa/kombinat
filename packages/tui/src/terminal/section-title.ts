import { S, text } from './text';
import type { Line } from './text';

export function sectionTitle(title: string, aside?: string): Line {
  return [text(title.toUpperCase(), S.heading), ...(aside ? [text(`  ${aside}`, S.grey)] : [])];
}

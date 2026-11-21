import type { RoutineMemory } from 'domains/routine/types';
import { getMemoryAuthorLabel, getMemoryChangeVerb } from 'domains/routine/utils';
import type { RunId } from 'domains/run/ids';
import { formatRelativeCompact } from 'utils/date-time';

import { renderMarkdown } from '../../terminal/markdown';
import { S, sanitize, text, wrapLine } from '../../terminal/text';
import type { Line } from '../../terminal/text';

function changeLine(memory: RoutineMemory, lastRunId: RunId | null, now: number): Line {
  const { change } = memory;
  if (change === null) return [];
  const hasCounts = change.added !== null && change.removed !== null && memory.text !== '';
  return [
    text(`${getMemoryChangeVerb(memory)} by ${getMemoryAuthorLabel(change, lastRunId)} `, S.dim),
    text(formatRelativeCompact(change.at, now), S.cyan),
    ...(hasCounts
      ? [
          text(' · ', S.dim),
          text(`+${change.added}`, S.green),
          text(' '),
          text(`−${change.removed}`, S.red),
          text(' lines', S.dim),
        ]
      : []),
  ];
}

export function memoryNotes(
  memory: RoutineMemory,
  lastRunId: RunId | null,
  width: number,
  now: number,
): Line[] {
  const change = changeLine(memory, lastRunId, now);
  return [
    ...(change.length === 0 ? [] : [...wrapLine(change, width), []]),
    ...(memory.text === ''
      ? [[text('No notes yet. The next run starts them.', S.dim)]]
      : renderMarkdown(memory.text, width)),
    [],
    ...wrapLine([text(`Edit them in the dashboard or in ${sanitize(memory.file)}`, S.grey)], width),
  ];
}

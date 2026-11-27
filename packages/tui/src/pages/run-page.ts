import { match } from 'ts-pattern';

import type { RunRecord } from 'domains/run/types';
import { checkIsRunActive } from 'domains/run/utils';
import type { TranscriptItem } from 'domains/transcript/types';

import { runHeaderLines } from '../domains/run/run-header';
import { transcriptLines } from '../domains/transcript/transcript';
import type { ContentLine, PageContent } from '../page-content';

export interface RenderedTranscript {
  key: string;
  lines: ContentLine[];
}

interface RunPageInput {
  run: RunRecord;
  eventCount: number;
  items: TranscriptItem[];
  expanded: Set<string>;
  expandedVersion: number;
  transcript: RenderedTranscript | null;
  width: number;
  now: number;
}

interface RunPageOutput {
  content: PageContent;
  // Rendered again only when its key changes, so the caller keeps it for the next frame.
  transcript: RenderedTranscript;
}

export function runPage({
  run,
  eventCount,
  items,
  expanded,
  expandedVersion,
  transcript: cached,
  width,
  now,
}: RunPageInput): RunPageOutput {
  const isRunning = checkIsRunActive(run);
  const key = `${width}|${eventCount}|${expandedVersion}|${String(isRunning)}`;
  const transcript =
    cached?.key === key
      ? cached
      : { key, lines: transcriptLines(items, eventCount, expanded, width, isRunning) };
  const cwd = items.flatMap(item =>
    match(item)
      .with({ kind: 'init' }, init => [init.cwd])
      .otherwise(() => []),
  )[0];
  return {
    content: {
      mode: 'line',
      lines: [...runHeaderLines(run, cwd ?? null, width, now), ...transcript.lines],
    },
    transcript,
  };
}

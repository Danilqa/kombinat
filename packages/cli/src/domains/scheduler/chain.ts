import type { ChainCondition, RunRecord } from 'domains/run/types';
import { checkHasRunEnded, checkMeetsChainCondition } from 'domains/run/utils';

interface ChainStart {
  // The newest run to start after, null when none of them ended as the condition asks.
  run: RunRecord | null;
  endedAt: string;
}

// Like missed scheduled times, the runs that ended since the last look start the routine once.
export function findChainStart(
  runs: RunRecord[],
  since: string,
  condition: ChainCondition,
): ChainStart | null {
  const sinceMs = Date.parse(since);
  const ended = runs
    .flatMap(run =>
      checkHasRunEnded(run) && run.endedAt !== null && Date.parse(run.endedAt) > sinceMs
        ? [{ run, endedAt: run.endedAt }]
        : [],
    )
    .toSorted((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
  const newest = ended[0];
  if (newest === undefined) return null;
  const match = ended.find(({ run }) => checkMeetsChainCondition(run, condition));
  return { run: match?.run ?? null, endedAt: newest.endedAt };
}

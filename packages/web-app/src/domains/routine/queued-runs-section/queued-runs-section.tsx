import type { RefObject } from 'react';
import { X } from 'lucide-react';
import { Button, Card, SectionHeader } from 'design-system';
import type { RoutineName } from 'domains/routine/ids';
import type { QueuedRun } from 'domains/run/types';
import { useCancelQueuedRuns } from '../queries';

function getQueuedRunsNote(maxParallel: number): string {
  return maxParallel === 1
    ? 'They start one after another, as each run ends.'
    : `They start as runs end, up to ${maxParallel} at once.`;
}

interface QueuedRunsSectionProps {
  routine: RoutineName;
  queuedRuns: QueuedRun[];
  runNowRef: RefObject<HTMLButtonElement | null>;
}

export function QueuedRunsSection({ routine, queuedRuns, runNowRef }: QueuedRunsSectionProps) {
  // The section unmounts, so the focus moves on before it would drop to the page.
  const cancel = useCancelQueuedRuns(routine, () => runNowRef.current?.focus());
  const [first] = queuedRuns;
  if (first === undefined) return null;
  const count = queuedRuns.length;
  return (
    <section>
      <SectionHeader.Root
        aside={
          <SectionHeader.Aside>
            {count} {count === 1 ? 'run' : 'runs'}
          </SectionHeader.Aside>
        }
      >
        Queued
      </SectionHeader.Root>
      <Card.Root>
        <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-1.5">
          <p className="min-w-0 text-body-sm text-fg-secondary">
            {getQueuedRunsNote(first.maxParallel)}
          </p>
          <Button
            variant="tertiary"
            size="small"
            className="shrink-0 max-sm:h-9"
            aria-disabled={cancel.isPending || undefined}
            onClick={() => {
              if (!cancel.isPending) cancel.mutate();
            }}
          >
            <X aria-hidden="true" />
            Cancel
            <span className="sr-only"> the queued runs</span>
          </Button>
        </div>
        {cancel.error && (
          <p role="alert" className="border-t border-line px-4 py-2.5 text-body-sm text-negative">
            {cancel.error.message}
          </p>
        )}
      </Card.Root>
    </section>
  );
}

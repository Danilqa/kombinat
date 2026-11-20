import { useRef, type RefObject } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button, RelativeTime, Table } from 'design-system/components';
import { QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS } from 'domains/routine/constants';
import type { RoutineName } from 'domains/routine/ids';
import { cancelOneTimeRun } from 'domains/routine/requests';
import type { OneTimeRun } from 'domains/scheduler/types';
import { formatDayTime } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';

interface OneTimeRunsTableProps {
  routine: RoutineName;
  oneTimeRuns: OneTimeRun[];
  runNowRef: RefObject<HTMLButtonElement | null>;
}

export function OneTimeRunsTable({ routine, oneTimeRuns, runNowRef }: OneTimeRunsTableProps) {
  const queryClient = useQueryClient();
  const cancelButtons = useRef(new Map<string, HTMLButtonElement>());
  const cancel = useMutation({
    mutationFn: (at: string) => cancelOneTimeRun(sameOriginApi, routine, at),
    // The cancelled row unmounts, so the focus moves on before it would drop to the page.
    onSuccess: (_, at) => {
      if (document.activeElement !== cancelButtons.current.get(at)) return;
      const index = oneTimeRuns.findIndex(run => run.at === at);
      const rest = oneTimeRuns.filter(run => run.at !== at);
      const next = rest[Math.min(index, rest.length - 1)];
      (next === undefined ? runNowRef.current : cancelButtons.current.get(next.at))?.focus();
    },
    onSettled: () =>
      Promise.all(
        QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS.map(queryKey =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
  return (
    <>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Starts</Table.Head>
            <Table.Head>At</Table.Head>
            <Table.Head>
              <span className="sr-only">Actions</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {oneTimeRuns.map(({ at }) => {
            const time = formatDayTime(at);
            const isCancelling = cancel.isPending && cancel.variables === at;
            return (
              <Table.Row key={at}>
                <Table.Cell>
                  <RelativeTime iso={at} isFocusable />
                </Table.Cell>
                <Table.Cell className="w-full text-fg-secondary">{time}</Table.Cell>
                <Table.Cell className="text-right">
                  <Button
                    ref={button => {
                      if (button !== null) cancelButtons.current.set(at, button);
                      return () => {
                        cancelButtons.current.delete(at);
                      };
                    }}
                    variant="tertiary"
                    size="small"
                    className="max-sm:h-9"
                    aria-disabled={isCancelling || undefined}
                    onClick={() => {
                      if (!isCancelling) cancel.mutate(at);
                    }}
                  >
                    <X aria-hidden="true" />
                    Cancel
                    <span className="sr-only"> the run at {time}</span>
                  </Button>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
      {cancel.error && (
        <p role="alert" className="border-t border-line px-4 py-2.5 text-body-sm text-negative">
          {cancel.error.message}
        </p>
      )}
    </>
  );
}

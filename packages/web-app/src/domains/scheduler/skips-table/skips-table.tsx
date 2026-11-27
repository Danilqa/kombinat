import { RelativeTime, Table } from 'design-system';
import type { Skip } from 'domains/scheduler/types';
import { getSkipReasonLabel } from 'domains/scheduler/utils';

interface SkipsTableProps {
  skips: Skip[];
}

export function SkipsTable({ skips }: SkipsTableProps) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Skipped at</Table.Head>
          <Table.Head>Scheduled for</Table.Head>
          <Table.Head>Reason</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {[...skips].reverse().map(skip => (
          <Table.Row key={`${skip.at}-${skip.scheduledFor}`}>
            <Table.Cell>
              <RelativeTime iso={skip.at} isFocusable />
            </Table.Cell>
            <Table.Cell className="text-fg-secondary">
              <RelativeTime iso={skip.scheduledFor} isFocusable />
            </Table.Cell>
            <Table.Cell className="text-fg-secondary">
              {getSkipReasonLabel(skip.reason)}
              {skip.checkOutput && (
                <pre
                  className="mt-1 line-clamp-2 font-mono text-caption wrap-anywhere whitespace-pre-wrap text-fg-muted"
                  title={skip.checkOutput}
                >
                  {skip.checkOutput}
                </pre>
              )}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

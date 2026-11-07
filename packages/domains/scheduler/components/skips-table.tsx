import { RelativeTime, Table } from 'design-system/components';

import type { Skip } from '../types';
import { getSkipReasonLabel } from '../utils';

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
            <Table.Cell className="text-fg-secondary">{getSkipReasonLabel(skip.reason)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

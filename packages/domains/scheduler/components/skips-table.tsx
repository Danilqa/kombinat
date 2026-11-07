import { RelativeTime } from 'design-system/components/relative-time';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'design-system/components/table';

import type { Skip } from '../types';
import { getSkipReasonLabel } from '../utils';

interface SkipsTableProps {
  skips: Skip[];
}

export function SkipsTable({ skips }: SkipsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Skipped at</TableHead>
          <TableHead>Scheduled for</TableHead>
          <TableHead>Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...skips].reverse().map(skip => (
          <TableRow key={`${skip.at}-${skip.scheduledFor}`}>
            <TableCell>
              <RelativeTime iso={skip.at} isFocusable />
            </TableCell>
            <TableCell className="text-fg-secondary">
              <RelativeTime iso={skip.scheduledFor} isFocusable />
            </TableCell>
            <TableCell className="text-fg-secondary">{getSkipReasonLabel(skip.reason)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

import { ShieldAlert } from 'lucide-react';

import { Badge } from 'design-system';
import { getBlockedLabel } from 'domains/run/utils';

interface BlockedBadgeProps {
  count: number;
  className?: string;
}

export function BlockedBadge({ count, className }: BlockedBadgeProps) {
  return (
    <Badge
      variant="warning"
      size="medium"
      title="Actions that nobody was there to approve"
      className={className}
    >
      <ShieldAlert aria-hidden="true" />
      {getBlockedLabel(count)}
    </Badge>
  );
}

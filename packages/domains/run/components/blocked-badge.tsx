import { ShieldAlert } from 'lucide-react';

import { Badge } from 'design-system/components';

import { getBlockedLabel } from '../utils';

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

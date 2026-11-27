import { useState } from 'react';
import { isMatching } from 'ts-pattern';

import { Badge, PingingStatusDot, cn } from 'design-system';
import type { RunStatus } from 'domains/run/types';
import { getRunStatusLabel, getRunStatusTone } from 'domains/run/utils';

interface RunStatusBadgeProps {
  status: RunStatus;
}

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const tone = getRunStatusTone(status);
  const [initialStatus] = useState(status);
  return (
    <Badge
      key={status}
      variant={tone}
      size="medium"
      className={cn(status !== initialStatus && 'motion-safe:animate-status-pop')}
    >
      <PingingStatusDot tone={tone} isPinging={isMatching('running', status)} />
      {getRunStatusLabel(status)}
    </Badge>
  );
}

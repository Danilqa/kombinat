import { match } from 'ts-pattern';

import { Badge, type BadgeVariant } from 'design-system/components/badge';
import { cn } from 'design-system/utils';

import { getAgentLabel } from '../../agent/utils';
import type { RoutineSummary } from '../types';

type EnabledState = 'enabled' | 'disabled';

interface EnabledBadge {
  label: string;
  variant: BadgeVariant;
  dotClassName: string;
}

const enabledBadges: Record<EnabledState, EnabledBadge> = {
  enabled: { label: 'Enabled', variant: 'positive', dotClassName: 'bg-positive' },
  disabled: { label: 'Disabled', variant: 'ghost', dotClassName: 'bg-fg-faint' },
};

function getEnabledState(routine: RoutineSummary): EnabledState {
  return match(routine.enabled)
    .with(true, () => 'enabled' as const)
    .with(false, () => 'disabled' as const)
    .exhaustive();
}

interface RoutineBadgesProps {
  routine: RoutineSummary;
}

export function RoutineBadges({ routine }: RoutineBadgesProps) {
  const enabledBadge = enabledBadges[getEnabledState(routine)];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge size="small" variant={enabledBadge.variant}>
        <span className={cn('size-1.5 rounded-full', enabledBadge.dotClassName)} />
        {enabledBadge.label}
      </Badge>
      <Badge size="small">{routine.scheduleHuman}</Badge>
      {routine.schedule && (
        <Badge size="small" className="font-mono">
          {routine.schedule}
        </Badge>
      )}
      <Badge size="small">{getAgentLabel(routine.agent)}</Badge>
      {routine.model !== null && (
        <Badge size="small" className="font-mono">
          {routine.model}
        </Badge>
      )}
      {routine.effort !== null && <Badge size="small">Effort {routine.effort}</Badge>}
      {routine.permissionMode !== null && (
        <Badge size="small">Permission {routine.permissionMode}</Badge>
      )}
    </div>
  );
}

import { match } from 'ts-pattern';

import { Badge, StatusDot, type StatusDotTone } from 'design-system';
import { getAgentLabel } from 'domains/agent/utils';
import type { RoutineSummary } from 'domains/routine/types';

type EnabledState = 'enabled' | 'disabled';

interface EnabledBadge {
  label: string;
  tone: StatusDotTone;
}

const enabledBadges: Record<EnabledState, EnabledBadge> = {
  enabled: { label: 'Enabled', tone: 'positive' },
  disabled: { label: 'Disabled', tone: 'ghost' },
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
      <Badge size="small" variant={enabledBadge.tone}>
        <StatusDot tone={enabledBadge.tone} />
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
      {routine.fallbackModel && (
        <Badge size="small">
          Fallback <span className="font-mono">{routine.fallbackModel}</span>
        </Badge>
      )}
      {routine.effort !== null && <Badge size="small">Effort {routine.effort}</Badge>}
      {routine.permissionMode !== null && (
        <Badge size="small">Permission {routine.permissionMode}</Badge>
      )}
    </div>
  );
}

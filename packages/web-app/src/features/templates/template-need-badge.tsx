import { GitBranch, SquareTerminal } from 'lucide-react';
import { match } from 'ts-pattern';
import { Badge } from 'design-system/components';
import type { RoutineTemplateNeed } from 'domains/routine/types';
import { getTemplateNeedLabel } from 'domains/routine/utils';

interface TemplateNeedBadgeProps {
  need: RoutineTemplateNeed;
}

export function TemplateNeedBadge({ need }: TemplateNeedBadgeProps) {
  const Icon = match(need)
    .with('git-repository', () => GitBranch)
    .with('github-cli', () => SquareTerminal)
    .exhaustive();
  return (
    <Badge size="small" variant="info">
      <Icon aria-hidden="true" />
      {getTemplateNeedLabel(need)}
    </Badge>
  );
}

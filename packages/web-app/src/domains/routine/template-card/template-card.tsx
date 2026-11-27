import { Link } from 'react-router';
import { Badge } from 'design-system';
import { getAgentLabel } from 'domains/agent/utils';
import type { RoutineTemplate } from 'domains/routine/types';
import { describeScheduleValue } from 'domains/routine/utils';
import { getTemplatePath } from '@web-app/paths';
import { TemplateNeedBadge } from '../template-need-badge';

interface TemplateCardProps {
  template: RoutineTemplate;
}

export function TemplateCard({ template }: TemplateCardProps) {
  return (
    <Link
      to={getTemplatePath(template.id)}
      className="group flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-raised focus-visible:border-line-strong"
    >
      <div className="space-y-1">
        <h3 className="text-body font-medium wrap-anywhere text-fg">{template.title}</h3>
        <p className="text-body-sm text-fg-secondary">{template.description}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Badge size="small">{getAgentLabel(template.agent)}</Badge>
        <Badge size="small">{describeScheduleValue(template.schedule ?? 'manual')}</Badge>
        {template.needs.map(need => (
          <TemplateNeedBadge key={need} need={need} />
        ))}
      </div>
    </Link>
  );
}

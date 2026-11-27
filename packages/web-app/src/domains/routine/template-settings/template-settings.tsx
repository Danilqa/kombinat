import { DetailList, type DetailEntry } from 'design-system';
import type { RoutineTemplate } from 'domains/routine/types';
import { getRetriesLabel } from 'domains/run/utils';

// Effort and permission mean something else to each agent, so another agent starts from its own.
function getEntries(template: RoutineTemplate, isTemplateAgent: boolean): DetailEntry[] {
  return [
    ...(template.effort === null
      ? []
      : [{ label: 'Effort', value: isTemplateAgent ? template.effort : 'Default' }]),
    ...(template.permissionMode === null
      ? []
      : [
          {
            label: 'Permission',
            value: isTemplateAgent ? template.permissionMode : 'Default',
            isMono: isTemplateAgent,
          },
        ]),
    { label: 'Timeout', value: `${template.timeoutMinutes} min` },
    {
      label: 'Retries',
      value: template.retries === 0 ? 'None' : getRetriesLabel(template.retries),
    },
    {
      label: 'Works in',
      value: template.worktree ? 'A worktree of its own for each run' : 'The folder itself',
    },
    { label: 'Memory', value: template.memory ? 'Keeps notes for the next runs' : 'Off' },
    ...(template.check === null
      ? []
      : [{ label: 'Check', value: template.check, isMono: true, span: 'full' as const }]),
    ...(template.command === null
      ? []
      : [{ label: 'Command', value: template.command, isMono: true, span: 'full' as const }]),
  ];
}

interface TemplateSettingsProps {
  template: RoutineTemplate;
  isTemplateAgent: boolean;
}

export function TemplateSettings({ template, isTemplateAgent }: TemplateSettingsProps) {
  return <DetailList entries={getEntries(template, isTemplateAgent)} />;
}

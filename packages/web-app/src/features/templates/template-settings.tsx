import { DetailList, type DetailEntry } from 'design-system/components';
import { getAgentLabel } from 'domains/agent/utils';
import type { RoutineTemplate } from 'domains/routine/types';
import { getRetriesLabel } from 'domains/run/utils';

function getEntries(template: RoutineTemplate): DetailEntry[] {
  return [
    { label: 'Agent', value: getAgentLabel(template.agent) },
    { label: 'Model', value: template.model, isMono: true },
    { label: 'Effort', value: template.effort },
    { label: 'Permission', value: template.permissionMode, isMono: true },
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
  ];
}

interface TemplateSettingsProps {
  template: RoutineTemplate;
}

export function TemplateSettings({ template }: TemplateSettingsProps) {
  return <DetailList entries={getEntries(template)} />;
}

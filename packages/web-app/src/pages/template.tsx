import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge, Card, ErrorState, LoadingState, PageHeader } from 'design-system';
import type { AgentName } from 'domains/agent/types';
import { getAgentLabel } from 'domains/agent/utils';
import { routineTemplateIdSchema } from 'domains/routine/ids';
import { findRoutineTemplate } from 'domains/routine/templates';
import type { RoutineTemplate } from 'domains/routine/types';
import { useAgents } from '@web-app/domains/agent/queries';
import { AddRoutineForm } from '@web-app/domains/routine/add-routine-form';
import { useAddRoutine, useRoutines } from '@web-app/domains/routine/queries';
import { TemplateNeedBadge } from '@web-app/domains/routine/template-need-badge';
import { TemplateSettings } from '@web-app/domains/routine/template-settings';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { Breadcrumbs } from '@web-app/layout/breadcrumbs';
import { ROUTINES_PATH, TEMPLATES_PATH, getRoutinePath } from '@web-app/paths';

interface TemplateViewProps {
  template: RoutineTemplate;
}

function TemplateView({ template }: TemplateViewProps) {
  const navigate = useNavigate();
  // isPending changes only after a render. Without the ref, a double click sends the request twice.
  const isSendingRef = useRef(false);
  const [agent, setAgent] = useState(template.agent);
  const [model, setModel] = useState(template.model);
  const routines = useRoutines();
  const agents = useAgents();
  const add = useAddRoutine(
    ({ name, file }) => void navigate(getRoutinePath(name), { state: { addedFile: file } }),
  );
  const error = routines.error ?? agents.error;

  // The template's model belongs to its agent. Another agent starts from its own default.
  function changeAgent(next: AgentName) {
    setAgent(next);
    setModel(next === template.agent ? template.model : null);
  }

  return (
    <>
      <header className="mb-6 min-w-0 space-y-3">
        <div className="space-y-1">
          <PageHeader.Title>{template.title}</PageHeader.Title>
          <p className="max-w-3xl text-body text-fg-secondary">{template.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge size="small">{getAgentLabel(agent)}</Badge>
          {model !== null && (
            <Badge size="small" className="font-mono">
              {model}
            </Badge>
          )}
          {template.needs.length > 0 && (
            <span className="ml-1 text-body-sm text-fg-muted">Needs</span>
          )}
          {template.needs.map(need => (
            <TemplateNeedBadge key={need} need={need} />
          ))}
        </div>
      </header>
      <div className="space-y-10">
        <Card.Root>
          <TemplateSettings template={template} isTemplateAgent={agent === template.agent} />
        </Card.Root>
        {error && <ErrorState message={error.message} />}
        {!error && (routines.isPending || agents.isPending) && <LoadingState />}
        {routines.data && agents.data && (
          <AddRoutineForm
            template={template}
            routines={routines.data}
            agents={agents.data}
            agent={agent}
            model={model}
            isPending={add.isPending}
            error={add.error?.message ?? null}
            onAgentChange={changeAgent}
            onModelChange={setModel}
            onSubmit={request => {
              if (isSendingRef.current) return;
              isSendingRef.current = true;
              add.mutate(request, {
                onError: () => {
                  isSendingRef.current = false;
                },
              });
            }}
          />
        )}
      </div>
    </>
  );
}

export function TemplatePage() {
  const id = routineTemplateIdSchema.parse(useParams<'id'>().id ?? '');
  const template = findRoutineTemplate(id);
  useDocumentTitle(template?.title ?? 'Template');

  return (
    <div>
      <Breadcrumbs
        crumbs={[
          { label: 'Routines', to: ROUTINES_PATH },
          { label: 'Templates', to: TEMPLATES_PATH },
        ]}
      />
      {template === null ? (
        <ErrorState message={`There is no template named ${id}`} />
      ) : (
        <TemplateView key={template.id} template={template} />
      )}
    </div>
  );
}

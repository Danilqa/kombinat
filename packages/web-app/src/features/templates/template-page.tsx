import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { Badge, Card, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { getAgents } from 'domains/agent/requests';
import type { AgentName } from 'domains/agent/types';
import { getAgentLabel } from 'domains/agent/utils';
import { routineTemplateIdSchema } from 'domains/routine/ids';
import { addRoutine, getRoutines } from 'domains/routine/requests';
import { findRoutineTemplate } from 'domains/routine/templates';
import type { AddRoutineRequest, RoutineTemplate } from 'domains/routine/types';
import { sameOriginApi } from 'utils/http';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { ROUTINES_PATH, TEMPLATES_PATH, getRoutinePath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { AddRoutineForm } from './add-routine-form';
import { TemplateNeedBadge } from './template-need-badge';
import { TemplateSettings } from './template-settings';

const QUERY_KEYS_CHANGED_BY_ADDING = [['routines'], ['calendar']];

interface TemplateViewProps {
  template: RoutineTemplate;
}

function TemplateView({ template }: TemplateViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // isPending changes only after a render. Without the ref, a double click sends the request twice.
  const isSendingRef = useRef(false);
  const [agent, setAgent] = useState(template.agent);
  const [model, setModel] = useState(template.model);
  const routines = useQuery({
    queryKey: ['routines'],
    queryFn: () => getRoutines(sameOriginApi),
  });
  const agents = useQuery({
    queryKey: ['agents'],
    queryFn: () => getAgents(sameOriginApi),
  });
  const add = useMutation({
    mutationFn: (request: AddRoutineRequest) => addRoutine(sameOriginApi, request),
    onSuccess: ({ name, file }) => {
      for (const queryKey of QUERY_KEYS_CHANGED_BY_ADDING) {
        void queryClient.invalidateQueries({ queryKey });
      }
      void navigate(getRoutinePath(name), { state: { addedFile: file } });
    },
  });
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
        <Card.Root className="gap-0 py-0">
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

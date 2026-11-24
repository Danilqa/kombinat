import { PageHeader, SectionHeader } from 'design-system/layouts';
import { ROUTINE_TEMPLATE_CATEGORIES, ROUTINE_TEMPLATES } from 'domains/routine/templates';
import { getTemplateCategoryLabel } from 'domains/routine/utils';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { ROUTINES_PATH } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { TemplateCard } from './template-card';

export function TemplatesPage() {
  useDocumentTitle('Templates');
  return (
    <div>
      <Breadcrumbs crumbs={[{ label: 'Routines', to: ROUTINES_PATH }, { label: 'Templates' }]} />
      <header className="mb-8 space-y-1">
        <PageHeader.Title>Start from a template</PageHeader.Title>
        <p className="max-w-3xl text-body text-fg-secondary">
          Routines that work out of the box. Pick one, give it a name, folder and schedule, and it
          lands in your routines folder as a markdown file you can change.
        </p>
      </header>
      <div className="space-y-10">
        {ROUTINE_TEMPLATE_CATEGORIES.map(category => {
          const templates = ROUTINE_TEMPLATES.filter(template => template.category === category);
          return (
            <section key={category}>
              <SectionHeader.Root
                aside={
                  <SectionHeader.Aside>
                    {templates.length} {templates.length === 1 ? 'template' : 'templates'}
                  </SectionHeader.Aside>
                }
              >
                {getTemplateCategoryLabel(category)}
              </SectionHeader.Root>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map(template => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

import { Card } from 'design-system/components';
import { SectionHeader } from 'design-system/layouts';
import type { InboxSection as InboxSectionData } from 'domains/inbox/types';
import { getInboxGroupLabel } from 'domains/inbox/utils';
import { InboxRunRow } from './inbox-run-row';

interface InboxSectionProps {
  section: InboxSectionData;
}

export function InboxSection({ section: { group, runs } }: InboxSectionProps) {
  const label = getInboxGroupLabel(group);
  return (
    <section aria-label={label}>
      <SectionHeader.Root aside={<SectionHeader.Aside>{runs.length}</SectionHeader.Aside>}>
        {label}
      </SectionHeader.Root>
      <Card.Root className="gap-0 py-0">
        <ul className="divide-y divide-line">
          {runs.map(run => (
            <InboxRunRow key={`${run.routine}/${run.id}`} run={run} group={group} />
          ))}
        </ul>
      </Card.Root>
    </section>
  );
}

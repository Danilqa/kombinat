import { useId } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { Card, SectionHeader } from 'design-system';
import type { RoutineName } from 'domains/routine/ids';
import type { ChainLink } from 'domains/routine/types';
import { listChainLoops } from 'domains/routine/utils';
import { getChainConditionLabel } from 'domains/run/utils';
import { ChainNode } from './chain-node';
import { ChainRunRow } from './chain-run-row';

const namesFormatter = new Intl.ListFormat('en', { type: 'conjunction' });

interface ChainStepProps {
  link: ChainLink;
  previous: ChainLink | undefined;
}

// A phone stacks the routines and points the arrows down. A step that does not follow the routine
// it starts after, as on a second branch, names that routine.
function ChainStep({ link, previous }: ChainStepProps) {
  if (link.startsWhen === null || link.startsAfter === null) return null;
  const subject = link.startsAfter === previous?.name ? 'it' : link.startsAfter;
  return (
    <span className="flex shrink-0 items-center gap-1.5 px-3 text-body-sm text-fg-muted sm:flex-col sm:gap-0.5 sm:px-1">
      <ArrowDown aria-hidden="true" className="size-3.5 sm:hidden" />
      <ArrowRight aria-hidden="true" className="size-3.5 max-sm:hidden" />
      {getChainConditionLabel(link.startsWhen, subject)}
    </span>
  );
}

interface ChainSectionProps {
  routine: RoutineName;
  chain: ChainLink[];
}

export function ChainSection({ routine, chain }: ChainSectionProps) {
  const lastRunsId = useId();
  const [loop] = listChainLoops(chain);
  return (
    <section>
      <SectionHeader.Root
        aside={<SectionHeader.Aside>{chain.length} routines</SectionHeader.Aside>}
      >
        Chain
      </SectionHeader.Root>
      <Card.Root>
        <ol
          aria-label="Routines in the order they start"
          className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center"
        >
          {chain.map((link, index) => (
            <li key={link.name} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              {index > 0 && <ChainStep link={link} previous={chain[index - 1]} />}
              <ChainNode link={link} current={routine} />
            </li>
          ))}
        </ol>
        <div className="border-t border-line-faint">
          <h3 id={lastRunsId} className="px-4 pt-3 text-body-sm text-fg-muted">
            Last runs
          </h3>
          <ul aria-labelledby={lastRunsId}>
            {chain.map(link => (
              <ChainRunRow key={link.name} link={link} />
            ))}
          </ul>
          {loop ? (
            <p className="px-4 pb-3 text-body-sm text-negative">
              {namesFormatter.format(loop)} start after each other in a loop. None of them starts
              this way until you remove startsAfter from one of them.
            </p>
          ) : (
            <p className="px-4 pb-3 text-body-sm text-fg-muted">
              Each run gets the result of the run before it, below its prompt.
            </p>
          )}
        </div>
      </Card.Root>
    </section>
  );
}

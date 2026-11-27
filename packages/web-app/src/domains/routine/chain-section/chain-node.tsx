import { Link } from 'react-router';
import { cn } from 'design-system';
import type { RoutineName } from 'domains/routine/ids';
import type { ChainLink } from 'domains/routine/types';
import { getRoutinePath } from '@web-app/paths';

interface ChainNodeProps {
  link: ChainLink;
  current: RoutineName;
}

export function ChainNode({ link, current }: ChainNodeProps) {
  const isCurrent = link.name === current;
  const note = link.startsAfter === null ? link.scheduleHuman : `After ${link.startsAfter}`;
  const className = cn(
    'flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2 sm:max-w-64',
    isCurrent
      ? 'border-info/60 bg-info-tint'
      : 'border-line transition-colors hover:bg-hover focus-visible:bg-hover',
  );
  const content = (
    <>
      <span className="truncate font-mono text-body-sm text-fg" title={link.name}>
        {link.name}
      </span>
      <span className="truncate text-body-sm text-fg-muted" title={note}>
        {note}
      </span>
    </>
  );
  return isCurrent ? (
    <div aria-current="page" className={className}>
      {content}
    </div>
  ) : (
    <Link to={getRoutinePath(link.name)} className={className}>
      {content}
    </Link>
  );
}

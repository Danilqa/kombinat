import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@web-app/lib/utils';

interface Crumb {
  label: string;
  to?: string;
}

interface CrumbLabelProps {
  crumb: Crumb;
  hasBackArrow: boolean;
}

function CrumbLabel({ crumb, hasBackArrow }: CrumbLabelProps) {
  const className = 'min-w-0 text-nav font-medium';
  if (crumb.to) {
    return (
      <Link
        to={crumb.to}
        className={cn(
          className,
          'flex items-center gap-1.5 py-1 text-fg-muted transition-colors hover:text-fg',
        )}
      >
        {hasBackArrow && <ArrowLeft aria-hidden="true" className="size-3.5 shrink-0" />}
        <span className="truncate">{crumb.label}</span>
      </Link>
    );
  }
  return (
    <span aria-current="page" className={cn(className, 'truncate text-fg')}>
      {crumb.label}
    </span>
  );
}

interface BreadcrumbsProps {
  crumbs: Crumb[];
  aside?: ReactNode;
}

export function Breadcrumbs({ crumbs, aside }: BreadcrumbsProps) {
  return (
    <div className="mb-6 flex min-h-8 flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-2">
          {crumbs.map((crumb, index) => (
            <li key={crumb.label} className="flex min-w-0 items-center gap-2">
              {index > 0 && (
                <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-fg-faint" />
              )}
              <CrumbLabel crumb={crumb} hasBackArrow={index === 0} />
            </li>
          ))}
        </ol>
      </nav>
      {aside && (
        <div className="ml-auto flex max-w-full min-w-0 items-center justify-end gap-3">
          {aside}
        </div>
      )}
    </div>
  );
}

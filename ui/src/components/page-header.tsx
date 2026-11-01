import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { BrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

interface Crumb {
  label: string;
  to?: string;
  isMono?: boolean;
}

interface CrumbLabelProps {
  crumb: Crumb;
}

function CrumbLabel({ crumb }: CrumbLabelProps) {
  const className = cn(
    'min-w-0 truncate text-body font-medium',
    crumb.isMono && 'font-mono text-body-sm',
  );
  if (crumb.to) {
    return (
      <Link
        to={crumb.to}
        className={cn(className, 'text-fg-muted transition-colors hover:text-fg')}
      >
        {crumb.label}
      </Link>
    );
  }
  return (
    <span aria-current="page" className={cn(className, 'text-fg')}>
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
    <div className="mb-8 flex min-h-8 flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-title-md text-fg">
          <BrandMark />
          Kombinat
        </Link>
        {crumbs.map(crumb => (
          <span key={crumb.label} className="flex min-w-0 items-center gap-2">
            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-fg-faint" />
            <CrumbLabel crumb={crumb} />
          </span>
        ))}
      </nav>
      {aside && (
        <div className="ml-auto flex max-w-full min-w-0 items-center justify-end gap-3">
          {aside}
        </div>
      )}
    </div>
  );
}

interface PageTitleProps {
  children: ReactNode;
  className?: string;
}

export function PageTitle({ children, className }: PageTitleProps) {
  return <h1 className={cn('min-w-0 truncate text-title-lg text-fg', className)}>{children}</h1>;
}

interface SectionTitleProps {
  children: ReactNode;
  aside?: ReactNode;
}

export function SectionTitle({ children, aside }: SectionTitleProps) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-body font-medium text-fg-secondary">{children}</h2>
      {aside}
    </div>
  );
}

interface SectionAsideProps {
  children: ReactNode;
}

export function SectionAside({ children }: SectionAsideProps) {
  return <span className="text-body-sm text-fg-muted tabular-nums">{children}</span>;
}

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

interface Crumb {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  crumbs: Crumb[];
}

export function Breadcrumbs({ crumbs }: BreadcrumbsProps) {
  return (
    <nav className="mb-4 flex items-center gap-2 text-paragraph-14 text-grey-60">
      <Link to="/" className="hover:text-black hover:underline">
        Kombinat
      </Link>
      {crumbs.map(crumb => (
        <span key={crumb.label} className="flex items-center gap-2">
          <span className="text-grey-30">/</span>
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-black hover:underline">
              {crumb.label}
            </Link>
          ) : (
            <span className="font-mono text-black">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

interface PageTitleProps {
  children: ReactNode;
  className?: string;
}

export function PageTitle({ children, className }: PageTitleProps) {
  return (
    <div className="flex h-10 min-w-0 items-center gap-2">
      <h1 className={cn('min-w-16 truncate text-headline-h1 text-black', className)}>{children}</h1>
    </div>
  );
}

interface SectionTitleProps {
  children: ReactNode;
  aside?: ReactNode;
}

export function SectionTitle({ children, aside }: SectionTitleProps) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="eyebrow">{children}</h2>
      {aside}
    </div>
  );
}

interface SectionAsideProps {
  children: ReactNode;
}

export function SectionAside({ children }: SectionAsideProps) {
  return <span className="text-paragraph-14 text-grey-60 tabular-nums">{children}</span>;
}

import type { ReactNode } from 'react';
import { cn } from '@web-app/lib/utils';

interface PageTitleProps {
  children: ReactNode;
  className?: string;
}

export function PageTitle({ children, className }: PageTitleProps) {
  return (
    <h1 className={cn('min-w-0 text-title-lg wrap-anywhere text-fg', className)}>{children}</h1>
  );
}

interface PageHeaderProps {
  title: string;
  aside?: ReactNode;
}

export function PageHeader({ title, aside }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <PageTitle>{title}</PageTitle>
      {aside}
    </div>
  );
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

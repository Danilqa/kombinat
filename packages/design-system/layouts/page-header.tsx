import type { ReactNode } from 'react';
import { cn } from '../utils';

interface PageHeaderTitleProps {
  children: ReactNode;
  className?: string;
}

function PageHeaderTitle({ children, className }: PageHeaderTitleProps) {
  return (
    <h1 className={cn('min-w-0 text-title-lg wrap-anywhere text-fg', className)}>{children}</h1>
  );
}

interface PageHeaderProps {
  title: string;
  aside?: ReactNode;
}

function PageHeader({ title, aside }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <PageHeaderTitle>{title}</PageHeaderTitle>
      {aside}
    </div>
  );
}

interface PageHeaderAsideProps {
  children: ReactNode;
}

function PageHeaderAside({ children }: PageHeaderAsideProps) {
  return <span className="text-body-sm text-fg-muted tabular-nums">{children}</span>;
}

export { PageHeader as Root, PageHeaderTitle as Title, PageHeaderAside as Aside };

import { useRef, type ReactNode } from 'react';
import { cn, useHeightProperty } from '../utils';

interface PageHeaderTitleProps {
  children: ReactNode;
  className?: string;
}

function PageHeaderTitle({ children, className }: PageHeaderTitleProps) {
  return (
    <h1 className={cn('min-w-0 text-title-lg wrap-anywhere text-fg', className)}>{children}</h1>
  );
}

interface PageHeaderBarProps {
  children: ReactNode;
}

function PageHeaderBar({ children }: PageHeaderBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  useHeightProperty(ref, '--page-header-height');
  return (
    <div ref={ref} className="sticky top-[var(--app-header-height,0px)] z-30 mb-3 bg-page pb-3">
      {children}
    </div>
  );
}

interface PageHeaderAsideProps {
  children: ReactNode;
}

function PageHeaderAside({ children }: PageHeaderAsideProps) {
  return <span className="text-body-sm text-fg-muted tabular-nums">{children}</span>;
}

interface PageHeaderProps {
  title: string;
  count?: ReactNode;
  aside?: ReactNode;
}

function PageHeader({ title, count, aside }: PageHeaderProps) {
  return (
    <PageHeaderBar>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <PageHeaderTitle>{title}</PageHeaderTitle>
          {count !== undefined && <PageHeaderAside>{count}</PageHeaderAside>}
        </div>
        {aside}
      </div>
    </PageHeaderBar>
  );
}

export {
  PageHeader as Root,
  PageHeaderBar as Bar,
  PageHeaderTitle as Title,
  PageHeaderAside as Aside,
};

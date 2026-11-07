import type { ReactNode } from 'react';

interface SectionHeaderProps {
  children: ReactNode;
  aside?: ReactNode;
}

function SectionHeader({ children, aside }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-body font-medium text-fg-secondary">{children}</h2>
      {aside}
    </div>
  );
}

export { SectionHeader as Root };
export { Aside } from './page-header';

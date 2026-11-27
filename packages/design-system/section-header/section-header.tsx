import { useRef, type ReactNode } from 'react';
import { useHeightProperty } from '../utils';

interface SectionHeaderProps {
  children: ReactNode;
  aside?: ReactNode;
}

function getParent(element: HTMLElement): HTMLElement | null {
  return element.parentElement;
}

// The height goes on its section, so only the sticky parts of that section move below it.
function SectionHeader({ children, aside }: SectionHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  useHeightProperty(ref, '--section-header-height', getParent);
  return (
    <div
      ref={ref}
      className="sticky top-below-page-header z-20 -mt-2 mb-1 flex items-baseline justify-between gap-4 bg-page py-2"
    >
      <h2 className="text-body font-medium text-fg-secondary">{children}</h2>
      {aside}
    </div>
  );
}

export { SectionHeader as Root };
export { Aside } from '../page-header/page-header';

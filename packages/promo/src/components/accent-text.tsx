import type { ReactNode } from 'react';

interface AccentTextProps {
  children: ReactNode;
}

export function AccentText({ children }: AccentTextProps) {
  return (
    <span className="bg-linear-to-r from-brand-violet via-brand-pink to-brand-peach bg-clip-text text-transparent">
      {children}
    </span>
  );
}

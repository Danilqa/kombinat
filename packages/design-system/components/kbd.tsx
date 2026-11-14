import * as React from 'react';
import { cn } from '../utils';

interface KbdProps extends React.ComponentProps<'kbd'> {}

function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-raised px-1 font-sans text-caption text-fg-secondary',
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full font-sans font-medium whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        primary: 'bg-fg text-page hover:bg-fg/90 active:bg-fg/80 aria-pressed:bg-fg/80',
        secondary: 'border border-line bg-raised text-fg hover:bg-overlay',
        tertiary: 'text-fg-secondary hover:bg-hover hover:text-fg active:bg-pressed',
      },
      size: {
        small: 'h-7 gap-1.5 px-3 text-body-sm',
        medium: 'h-8 gap-1.5 px-4 text-body',
        'icon-small': 'size-7',
      },
      isActive: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'tertiary',
        isActive: true,
        className: 'bg-overlay text-fg hover:bg-overlay active:bg-overlay',
      },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'medium',
      isActive: false,
    },
  },
);

interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({
  className,
  variant = 'primary',
  size = 'medium',
  isActive = false,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-active={isActive || undefined}
      className={cn(buttonVariants({ variant, size, isActive, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

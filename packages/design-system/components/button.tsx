import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';
import { Slot } from 'radix-ui';

// aria-disabled buttons keep focus, so they dim their colours instead of the whole element: element
// opacity would dim the focus ring too.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-sans font-medium whitespace-nowrap transition-[color,background-color,border-color,scale] duration-150 interactive:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        primary:
          'bg-fg text-page interactive:hover:bg-fg/90 interactive:active:bg-fg/80 aria-disabled:bg-fg/40 aria-pressed:bg-fg/80',
        secondary:
          'border border-line bg-raised text-fg interactive:hover:bg-overlay aria-disabled:text-fg/40',
        tertiary:
          'text-fg-secondary interactive:hover:bg-hover interactive:hover:text-fg interactive:active:bg-pressed aria-disabled:text-fg-secondary/40',
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
        className:
          'bg-overlay text-fg interactive:hover:bg-overlay interactive:active:bg-overlay forced-colors:underline forced-colors:underline-offset-4',
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

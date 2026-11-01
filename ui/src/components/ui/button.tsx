import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-full font-sans font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-300 outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          'bg-yellow text-black hover:bg-yellow-90 active:bg-yellow-80 aria-pressed:bg-yellow-80 disabled:bg-black-alpha-5 disabled:text-black-alpha-30',
        secondary:
          'bg-black text-white hover:bg-black-alpha-80 active:bg-black-alpha-70 disabled:bg-black-alpha-30 disabled:text-white/50',
        tertiary:
          'border border-grey-15 bg-transparent bg-clip-padding text-black hover:bg-grey-15 active:border-grey-20 active:bg-grey-20 disabled:text-black-alpha-30',
      },
      size: {
        small: 'min-h-8 min-w-8 px-4 py-1.5 text-title-14',
        medium: 'min-h-10 min-w-10 px-5 py-2 text-title-14',
        'icon-small': 'size-8 p-1.5 text-title-14',
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
          'border-light-blue-80 bg-light-blue-80 hover:border-light-blue hover:bg-light-blue active:border-light-blue active:bg-light-blue',
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

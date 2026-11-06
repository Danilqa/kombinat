import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@web-app/lib/utils';
import { Slot } from 'radix-ui';

const badgeVariants = cva(
  'chip shrink-0 overflow-hidden [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        positive: 'chip-positive',
        neutral: 'chip-neutral',
        info: 'chip-info',
        warning: 'chip-warning',
        negative: 'chip-negative',
        ghost: 'chip-ghost',
      },
      size: {
        medium: 'chip-medium',
        small: 'chip-small',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'medium',
    },
  },
);

interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({
  className,
  variant = 'neutral',
  size = 'medium',
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export { Badge, badgeVariants, type BadgeVariant };

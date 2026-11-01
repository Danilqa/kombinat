import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Tabs as TabsPrimitive } from 'radix-ui';

interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {}

function Tabs({ className, orientation = 'horizontal', ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col', className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex items-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
  {
    variants: {
      variant: {
        default:
          'relative h-12 w-full gap-6 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-grey-10',
        line: 'relative h-12 w-full gap-6 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-grey-10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>;

function TabsList({ className, variant = 'default', ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

interface TabsTriggerProps extends React.ComponentProps<typeof TabsPrimitive.Trigger> {}

function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full items-center gap-1.5 text-title-16 whitespace-nowrap text-grey-60 transition-colors duration-200 ease-in-out outline-none hover:text-black focus-visible:text-black disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-black [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-bottom-right after:scale-x-0 after:rounded-full after:bg-black after:transition-transform after:duration-200 after:ease-in-out hover:after:origin-bottom-left hover:after:scale-x-100 data-[state=active]:after:origin-bottom-left data-[state=active]:after:scale-x-100',
        className,
      )}
      {...props}
    />
  );
}

interface TabsContentProps extends React.ComponentProps<typeof TabsPrimitive.Content> {}

function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };

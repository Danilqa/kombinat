import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';
import { Tabs as TabsPrimitive } from 'radix-ui';

interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {}

function Tabs({ className, orientation = 'horizontal', ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn('group/tabs flex gap-3 data-[orientation=horizontal]:flex-col', className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex items-center gap-1 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
  {
    variants: {
      variant: {
        default: '',
        line: '',
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
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-nav font-medium whitespace-nowrap text-fg-muted transition-colors hover:text-fg focus-visible:text-fg disabled:pointer-events-none disabled:opacity-40 data-[state=active]:bg-overlay data-[state=active]:text-fg forced-colors:underline-offset-4 forced-colors:data-[state=active]:underline [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
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
      className={cn('flex-1', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };

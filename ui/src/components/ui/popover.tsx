import * as React from 'react';
import { cn } from '@/lib/utils';
import { Popover as PopoverPrimitive } from 'radix-ui';

interface PopoverProps extends React.ComponentProps<typeof PopoverPrimitive.Root> {}

function Popover({ ...props }: PopoverProps) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

interface PopoverTriggerProps extends React.ComponentProps<typeof PopoverPrimitive.Trigger> {}

function PopoverTrigger({ ...props }: PopoverTriggerProps) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

interface PopoverContentProps extends React.ComponentProps<typeof PopoverPrimitive.Content> {}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 6,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-max max-w-80 origin-(--radix-popover-content-transform-origin) rounded-lg border border-line bg-raised px-3 py-2.5 text-body-sm text-fg shadow-popover data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };

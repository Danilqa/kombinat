import * as React from 'react';
import { cn } from '../utils';
import { Collapsible as CollapsiblePrimitive } from 'radix-ui';

interface CollapsibleProps extends React.ComponentProps<typeof CollapsiblePrimitive.Root> {}

function Collapsible({ ...props }: CollapsibleProps) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

interface CollapsibleTriggerProps extends React.ComponentProps<
  typeof CollapsiblePrimitive.Trigger
> {}

function CollapsibleTrigger({ ...props }: CollapsibleTriggerProps) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}

interface CollapsibleContentProps extends React.ComponentProps<
  typeof CollapsiblePrimitive.Content
> {}

// The height animates, so spacing around the content goes inside it, not on this element.
function CollapsibleContent({ className, ...props }: CollapsibleContentProps) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn(
        'overflow-hidden ease-out-quint data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
        className,
      )}
      {...props}
    />
  );
}

export { Collapsible as Root, CollapsibleTrigger as Trigger, CollapsibleContent as Content };

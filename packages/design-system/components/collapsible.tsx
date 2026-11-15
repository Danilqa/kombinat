import * as React from 'react';
import { cn } from '../utils';
import { Collapsible as CollapsiblePrimitive } from 'radix-ui';

const HasOpenedContext = React.createContext(false);

interface CollapsibleProps extends React.ComponentProps<typeof CollapsiblePrimitive.Root> {}

function Collapsible({ defaultOpen = false, ...props }: CollapsibleProps) {
  const [hasOpened, setHasOpened] = React.useState(defaultOpen);
  if (props.open && !hasOpened) setHasOpened(true);
  return (
    <HasOpenedContext value={hasOpened}>
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        defaultOpen={defaultOpen}
        {...props}
        onOpenChange={isOpen => {
          if (isOpen) setHasOpened(true);
          props.onOpenChange?.(isOpen);
        }}
      />
    </HasOpenedContext>
  );
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

// Radix zeroes the transition of the content while measuring it, so the fold animates a grid inside.
function CollapsibleContent({ className, children, ...props }: CollapsibleContentProps) {
  const hasOpened = React.use(HasOpenedContext);
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      forceMount
      className={cn('group/collapsible-content', className)}
      {...props}
    >
      <div className="grid grid-rows-[1fr] transition-[grid-template-rows,visibility] duration-200 ease-out-quint group-data-[state=closed]/collapsible-content:invisible group-data-[state=closed]/collapsible-content:grid-rows-[0fr]">
        <div className="min-h-0 overflow-hidden">{hasOpened && children}</div>
      </div>
    </CollapsiblePrimitive.Content>
  );
}

export { Collapsible as Root, CollapsibleTrigger as Trigger, CollapsibleContent as Content };

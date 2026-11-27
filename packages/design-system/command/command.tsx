import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '../utils';
import { Spinner } from '../spinner';
import { Dialog as DialogPrimitive } from 'radix-ui';

interface CommandDialogProps extends React.ComponentProps<typeof DialogPrimitive.Root> {
  title: string;
}

function CommandDialog({ title, children, ...props }: CommandDialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="command-overlay"
          className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          data-slot="command-dialog"
          aria-describedby={undefined}
          className="fixed top-[15vh] left-1/2 z-50 w-[min(40rem,calc(100%-1.5rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface text-fg shadow-popover ease-out-quint data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 max-sm:top-[calc(--spacing(3)+env(safe-area-inset-top))]"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface CommandProps extends React.ComponentProps<typeof CommandPrimitive> {}

function Command({ className, ...props }: CommandProps) {
  return (
    <CommandPrimitive data-slot="command" className={cn('flex flex-col', className)} {...props} />
  );
}

interface CommandHeaderProps extends React.ComponentProps<'div'> {}

function CommandHeader({ className, ...props }: CommandHeaderProps) {
  return (
    <div
      data-slot="command-header"
      className={cn('flex items-center justify-between gap-3 px-3 pt-3 pb-1', className)}
      {...props}
    />
  );
}

interface CommandInputProps extends React.ComponentProps<typeof CommandPrimitive.Input> {}

function CommandInput({ className, ...props }: CommandInputProps) {
  return (
    <CommandPrimitive.Input
      data-slot="command-input"
      className={cn(
        'h-14 w-full border-b border-line bg-transparent px-4 text-title-md font-normal text-fg placeholder:text-fg-muted focus-visible:shadow-none',
        className,
      )}
      {...props}
    />
  );
}

interface CommandListProps extends React.ComponentProps<typeof CommandPrimitive.List> {}

function CommandList({ className, ...props }: CommandListProps) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'max-h-[min(26rem,60vh)] scroll-py-1.5 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5',
        className,
      )}
      {...props}
    />
  );
}

interface CommandEmptyProps extends React.ComponentProps<typeof CommandPrimitive.Empty> {}

function CommandEmpty({ className, ...props }: CommandEmptyProps) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn('px-3 py-10 text-center text-body text-fg-muted', className)}
      {...props}
    />
  );
}

interface CommandLoadingProps extends React.ComponentProps<typeof CommandPrimitive.Loading> {}

function CommandLoading({ className, children, ...props }: CommandLoadingProps) {
  return (
    <CommandPrimitive.Loading
      data-slot="command-loading"
      className={cn('px-2.5 py-2 text-body text-fg-muted', className)}
      {...props}
    >
      <span className="flex items-center gap-2">
        <Spinner />
        {children}
      </span>
    </CommandPrimitive.Loading>
  );
}

interface CommandGroupProps extends React.ComponentProps<typeof CommandPrimitive.Group> {}

function CommandGroup({ className, ...props }: CommandGroupProps) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        'not-first:mt-1.5 **:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:pt-1.5 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-caption **:[[cmdk-group-heading]]:text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

interface CommandItemProps extends React.ComponentProps<typeof CommandPrimitive.Item> {}

function CommandItem({ className, ...props }: CommandItemProps) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-body text-fg-secondary select-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[selected=true]:bg-neutral-soft data-[selected=true]:text-fg max-sm:min-h-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command as Root,
  CommandDialog as Dialog,
  CommandHeader as Header,
  CommandInput as Input,
  CommandList as List,
  CommandEmpty as Empty,
  CommandLoading as Loading,
  CommandGroup as Group,
  CommandItem as Item,
};

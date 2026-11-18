import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../utils';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

interface DropdownMenuProps extends React.ComponentProps<typeof DropdownMenuPrimitive.Root> {}

function DropdownMenu({ ...props }: DropdownMenuProps) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

interface DropdownMenuTriggerProps extends React.ComponentProps<
  typeof DropdownMenuPrimitive.Trigger
> {}

function DropdownMenuTrigger({ ...props }: DropdownMenuTriggerProps) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

interface DropdownMenuContentProps extends React.ComponentProps<
  typeof DropdownMenuPrimitive.Content
> {}

function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) rounded-lg border border-line bg-raised p-1 text-body-sm text-fg shadow-popover ease-out-quint data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

interface DropdownMenuItemProps extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {}

function DropdownMenuItem({ className, ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 outline-none select-none data-highlighted:bg-hover max-sm:h-11 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

interface DropdownMenuCheckboxItemProps extends React.ComponentProps<
  typeof DropdownMenuPrimitive.CheckboxItem
> {}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'relative flex h-8 cursor-pointer items-center rounded-md pr-3 pl-8 outline-none select-none data-highlighted:bg-hover max-sm:h-11',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check
            aria-hidden="true"
            className="size-3.5 animate-in duration-200 ease-out-quint zoom-in-50 fade-in"
          />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

interface DropdownMenuLabelProps extends React.ComponentProps<typeof DropdownMenuPrimitive.Label> {}

function DropdownMenuLabel({ className, ...props }: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn('px-2.5 pt-1.5 pb-1 text-caption text-fg-muted', className)}
      {...props}
    />
  );
}

interface DropdownMenuRadioGroupProps extends React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioGroup
> {}

function DropdownMenuRadioGroup({ ...props }: DropdownMenuRadioGroupProps) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

interface DropdownMenuRadioItemProps extends React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioItem
> {}

function DropdownMenuRadioItem({ className, children, ...props }: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'relative flex h-8 cursor-pointer items-center rounded-md pr-3 pl-8 outline-none select-none data-highlighted:bg-hover max-sm:h-11',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check
            aria-hidden="true"
            className="size-3.5 animate-in duration-200 ease-out-quint zoom-in-50 fade-in"
          />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export {
  DropdownMenu as Root,
  DropdownMenuTrigger as Trigger,
  DropdownMenuContent as Content,
  DropdownMenuItem as Item,
  DropdownMenuCheckboxItem as CheckboxItem,
  DropdownMenuLabel as Label,
  DropdownMenuRadioGroup as RadioGroup,
  DropdownMenuRadioItem as RadioItem,
};

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TableProps extends React.ComponentProps<'table'> {}

function Table({ className, ...props }: TableProps) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-body tabular-nums', className)}
        {...props}
      />
    </div>
  );
}

interface TableHeaderProps extends React.ComponentProps<'thead'> {}

function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-line [&_tr]:hover:bg-transparent', className)}
      {...props}
    />
  );
}

interface TableBodyProps extends React.ComponentProps<'tbody'> {}

function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

interface TableFooterProps extends React.ComponentProps<'tfoot'> {}

function TableFooter({ className, ...props }: TableFooterProps) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t border-line font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

interface TableRowProps extends React.ComponentProps<'tr'> {}

function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-line-faint transition-colors hover:bg-hover has-aria-expanded:bg-hover data-[state=selected]:bg-overlay',
        className,
      )}
      {...props}
    />
  );
}

interface TableHeadProps extends React.ComponentProps<'th'> {}

function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-9 px-2 text-left align-middle text-body-sm font-normal whitespace-nowrap text-fg-muted first:pl-4 last:pr-4 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

interface TableCellProps extends React.ComponentProps<'td'> {}

function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'h-11 px-2 py-2 align-middle text-body whitespace-nowrap text-fg first:pl-4 last:pr-4 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

interface TableCaptionProps extends React.ComponentProps<'caption'> {}

function TableCaption({ className, ...props }: TableCaptionProps) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-body-sm text-fg-muted', className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };

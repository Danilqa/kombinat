import * as React from 'react';
import { cn } from '@/lib/utils';

interface TableProps extends React.ComponentProps<'table'> {}

function Table({ className, ...props }: TableProps) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto px-4 pt-2 pb-2">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom bg-white text-paragraph-14', className)}
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
      className={cn('bg-white [&_tr]:border-b [&_tr]:hover:bg-transparent', className)}
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
      className={cn('border-t border-grey-10 font-medium [&>tr]:last:border-b-0', className)}
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
        'border-b border-grey-10 transition-colors hover:bg-grey-2 has-aria-expanded:bg-grey-2 data-[state=selected]:bg-light-blue-40',
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
        'h-14 px-2 text-left align-middle text-label-16 whitespace-nowrap text-grey-60 first:pl-4 last:pr-4 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
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
        'h-16 px-2 py-2 align-middle whitespace-nowrap text-black first:pl-4 last:pr-4 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
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
      className={cn('mt-4 text-paragraph-14 text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };

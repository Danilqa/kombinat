import * as React from 'react';
import { cn } from '@web-app/lib/utils';

interface TableProps extends React.ComponentProps<'table'> {}

function useStickyHeaderCopy(
  containerRef: React.RefObject<HTMLDivElement | null>,
  copyScrollerRef: React.RefObject<HTMLDivElement | null>,
  scrollerRef: React.RefObject<HTMLDivElement | null>,
) {
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const copyScroller = copyScrollerRef.current;
    const scroller = scrollerRef.current;
    const table = scroller?.querySelector('table');
    const copy = copyScroller?.querySelector('table');
    if (!container || !copyScroller || !scroller || !table || !copy) return;
    const heads = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
    const copyHeads = [...copy.querySelectorAll<HTMLTableCellElement>('thead th')];
    const syncSize = () => {
      container.style.setProperty('--table-header-height', `${table.tHead?.offsetHeight ?? 0}px`);
      copy.style.width = `${table.offsetWidth}px`;
      copyHeads.forEach((head, index) => {
        head.style.width = `${heads[index]?.getBoundingClientRect().width ?? 0}px`;
      });
    };
    const syncScroll = () => {
      copyScroller.scrollLeft = scroller.scrollLeft;
    };
    syncSize();
    syncScroll();
    const observer = new ResizeObserver(syncSize);
    for (const element of [table, ...heads]) observer.observe(element);
    scroller.addEventListener('scroll', syncScroll, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', syncScroll);
    };
  });
}

// A header can't stick from inside a sideways-scrolling box, so a hidden copy sticks above it.
function Table({ className, children, ...props }: TableProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const copyScrollerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const header = React.Children.toArray(children).find(
    child => React.isValidElement(child) && child.type === TableHeader,
  );
  useStickyHeaderCopy(containerRef, copyScrollerRef, scrollerRef);
  const tableClassName = cn('w-full caption-bottom text-body tabular-nums', className);
  return (
    <div ref={containerRef} data-slot="table-container" className="w-full">
      {header && (
        <div
          aria-hidden="true"
          inert
          className="sticky top-[var(--app-header-height,0px)] z-10 -mx-px -mt-px h-[calc(var(--table-header-height,36px)+2px)] bg-page"
        >
          <div
            ref={copyScrollerRef}
            className="relative h-full overflow-hidden rounded-t-xl border border-line bg-surface"
          >
            <table className={cn(tableClassName, 'table-fixed')}>{header}</table>
          </div>
        </div>
      )}
      <div
        ref={scrollerRef}
        className={cn(
          'relative overflow-x-auto rounded-[11px]',
          header && '-mt-[calc(var(--table-header-height,36px)+1px)]',
        )}
      >
        <table data-slot="table" className={tableClassName} {...props}>
          {children}
        </table>
      </div>
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
      scope="col"
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

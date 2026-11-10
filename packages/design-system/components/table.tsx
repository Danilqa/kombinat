import * as React from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import type {
  ContextProp,
  FillerRowProps,
  ItemProps,
  TableProps as VirtuosoTableProps,
} from 'react-virtuoso';
import { cn } from '../utils';

const TABLE_CLASS_NAME = 'w-full caption-bottom text-body tabular-nums';
const VIRTUAL_TABLE_OVERSCAN_PX = 600;
const VIRTUAL_TABLE_ROW_HEIGHT_PX = 44;
const VIRTUAL_TABLE_FIRST_INDEX = 1_000_000_000;

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

interface TableFrameProps {
  header: React.ReactNode;
  tableClassName: string;
  children: React.ReactNode;
}

// A header can't stick from inside a sideways-scrolling box, so a hidden copy sticks above it.
function TableFrame({ header, tableClassName, children }: TableFrameProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const copyScrollerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  useStickyHeaderCopy(containerRef, copyScrollerRef, scrollerRef);
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
        {children}
      </div>
    </div>
  );
}

function Table({ className, children, ...props }: TableProps) {
  const header = React.Children.toArray(children).find(
    child => React.isValidElement(child) && child.type === TableHeader,
  );
  const tableClassName = cn(TABLE_CLASS_NAME, className);
  return (
    <TableFrame header={header} tableClassName={tableClassName}>
      <table data-slot="table" className={tableClassName} {...props}>
        {children}
      </table>
    </TableFrame>
  );
}

interface VirtualTableContext {
  tableClassName: string;
  rowCount: number;
  getRowProps: (index: number) => TableRowProps | undefined;
}

interface VirtualTableElementProps extends VirtuosoTableProps, ContextProp<VirtualTableContext> {}

function VirtualTableElement({ context, ...props }: VirtualTableElementProps) {
  return (
    <table
      data-slot="table"
      aria-rowcount={context.rowCount + 1}
      className={context.tableClassName}
      {...props}
    />
  );
}

interface VirtualTableHeaderProps extends Pick<TableHeaderProps, 'ref' | 'style' | 'children'> {}

function VirtualTableHeader({ ref, style, children }: VirtualTableHeaderProps) {
  return (
    <TableHeader ref={ref} style={style}>
      {children}
    </TableHeader>
  );
}

interface VirtualTableBodyProps extends Pick<TableBodyProps, 'ref' | 'style' | 'children'> {}

function VirtualTableBody({ ref, style, children }: VirtualTableBodyProps) {
  return (
    <TableBody ref={ref} style={style}>
      {children}
    </TableBody>
  );
}

interface VirtualTableRowProps
  extends Omit<ItemProps<unknown>, 'item'>, ContextProp<VirtualTableContext> {}

// Picks the props it passes on, because Virtuoso also hands rows their item and context.
function VirtualTableRow({
  context,
  style,
  children,
  'data-index': index,
  'data-item-index': itemIndex,
  'data-known-size': knownSize,
}: VirtualTableRowProps) {
  return (
    <TableRow
      data-index={index}
      data-item-index={itemIndex}
      data-known-size={knownSize}
      aria-rowindex={index + 2}
      style={style}
      {...context.getRowProps(index)}
    >
      {children}
    </TableRow>
  );
}

interface VirtualTableFillerProps extends FillerRowProps {}

function VirtualTableFiller({ height }: VirtualTableFillerProps) {
  return (
    <tr aria-hidden="true">
      <td style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}

const VIRTUAL_TABLE_COMPONENTS = {
  Table: VirtualTableElement,
  TableHead: VirtualTableHeader,
  TableBody: VirtualTableBody,
  TableRow: VirtualTableRow,
  FillerRow: VirtualTableFiller,
};

interface VirtualTableProps<Item> {
  className?: string;
  data: Item[];
  header: React.ReactNode;
  computeItemKey: (item: Item) => React.Key;
  renderCells: (item: Item) => React.ReactNode;
  getRowProps?: (item: Item) => TableRowProps;
}

function VirtualTable<Item>({
  className,
  data,
  header,
  computeItemKey,
  renderCells,
  getRowProps,
}: VirtualTableProps<Item>) {
  // Until Virtuoso measures the rows, the list holds their height, so going back restores the scroll.
  const [isMeasured, setIsMeasured] = React.useState(false);
  // Rows added above the first one lower the first index, so Virtuoso keeps the rows in view still.
  const firstKey = data[0] === undefined ? undefined : computeItemKey(data[0]);
  const [first, setFirst] = React.useState({ key: firstKey, index: VIRTUAL_TABLE_FIRST_INDEX });
  if (first.key !== firstKey) {
    const addedCount = data.findIndex(item => computeItemKey(item) === first.key);
    setFirst({ key: firstKey, index: first.index - Math.max(addedCount, 0) });
  }
  // Only some rows are rendered, so columns take their widths from the header, not the content.
  const tableClassName = cn(TABLE_CLASS_NAME, 'table-fixed', className);
  const context: VirtualTableContext = {
    tableClassName,
    rowCount: data.length,
    getRowProps: index => {
      const item = data[index];
      return item === undefined ? undefined : getRowProps?.(item);
    },
  };
  return (
    <TableFrame header={<TableHeader>{header}</TableHeader>} tableClassName={tableClassName}>
      <TableVirtuoso<Item, VirtualTableContext>
        useWindowScroll
        data={data}
        firstItemIndex={first.index}
        context={context}
        components={VIRTUAL_TABLE_COMPONENTS}
        increaseViewportBy={VIRTUAL_TABLE_OVERSCAN_PX}
        defaultItemHeight={VIRTUAL_TABLE_ROW_HEIGHT_PX}
        style={isMeasured ? undefined : { height: data.length * VIRTUAL_TABLE_ROW_HEIGHT_PX }}
        totalListHeightChanged={height => {
          if (height > 0) setIsMeasured(true);
        }}
        computeItemKey={(_, item) => computeItemKey(item)}
        fixedHeaderContent={() => header}
        itemContent={(_, item) => renderCells(item)}
      />
    </TableFrame>
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

export {
  Table as Root,
  VirtualTable as VirtualRoot,
  TableHeader as Header,
  TableBody as Body,
  TableFooter as Footer,
  TableHead as Head,
  TableRow as Row,
  TableCell as Cell,
  TableCaption as Caption,
};

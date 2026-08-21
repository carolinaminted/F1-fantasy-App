import React from 'react';
import { NUMERIC } from './tokens.ts';
import { EmptyState } from './EmptyState.tsx';

export interface Column<Row> {
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Return a string/number and it inherits the column's alignment. */
  render: (row: Row, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Numeric columns get tabular figures so digits line up down the column. */
  numeric?: boolean;
  /** Hidden below md. Use for detail columns a phone has no room for. */
  hideOnMobile?: boolean;
  width?: string;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  onRowClick?: (row: Row, index: number) => void;
  /** Marks a row as the reader's own. */
  isHighlighted?: (row: Row, index: number) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Scrolls inside its own container, replacing the old isLockedLayout page-level hack. */
  scrollInside?: boolean;
  className?: string;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function DataTable<Row>({
  columns, rows, rowKey, onRowClick, isHighlighted,
  emptyTitle = 'Nothing here yet', emptyDescription, scrollInside, className = '',
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div
      className={[
        'w-full rounded-xl border border-pure-white/10 bg-accent-gray/30',
        scrollInside ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto',
        className,
      ].filter(Boolean).join(' ')}
    >
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-carbon-black/95 backdrop-blur-sm">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={[
                  'px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-highlight-silver border-b border-pure-white/10',
                  ALIGN[col.align ?? 'left'],
                  col.hideOnMobile ? 'hidden md:table-cell' : '',
                ].filter(Boolean).join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
              className={[
                'border-b border-pure-white/5 transition-colors',
                onRowClick ? 'cursor-pointer hover:bg-pure-white/5' : '',
                isHighlighted?.(row, i) ? 'bg-pure-white/[0.07] ring-1 ring-inset ring-pure-white/25' : '',
              ].filter(Boolean).join(' ')}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={[
                    'px-3 py-2.5 text-sm text-ghost-white',
                    ALIGN[col.align ?? 'left'],
                    col.numeric ? NUMERIC : '',
                    col.hideOnMobile ? 'hidden md:table-cell' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

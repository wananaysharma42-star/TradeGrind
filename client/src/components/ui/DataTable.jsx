import React from 'react';
import clsx from 'clsx';
import { Inbox, AlertCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Skeleton - Shimmering placeholder for loading states.
 */
export function Skeleton({ className = '' }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-16 bg-white/[0.06] border border-white/[0.04]',
        className
      )}
    />
  );
}

/**
 * EmptyState - Illustrated empty view for tables, targets, or watchlists.
 */
export function EmptyState({
  icon = <Inbox className="w-10 h-10 text-muted" />,
  title = 'No items found',
  description = 'There are no active records in this section yet.',
  action = null,
  className = ''
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center p-10 text-center rounded-20 bg-white/[0.02] border border-white/[0.05]', className)}>
      <div className="p-4 rounded-full bg-white/[0.04] border border-white/[0.08] mb-3 text-mauve">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-white tracking-wide">{title}</h4>
      <p className="text-xs text-muted max-w-xs mt-1 mb-4">{description}</p>
      {action}
    </div>
  );
}

/**
 * TooltipCard - Hover card with glass backdrop for charts and indicators.
 */
export function TooltipCard({ children, className = '' }) {
  return (
    <div
      className={clsx(
        'p-3 rounded-16 bg-dark-base/95 border border-white/15 backdrop-blur-glass shadow-glass text-xs text-white z-50 pointer-events-none',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Toast - Notification toast popup.
 */
export function Toast({
  title,
  message,
  type = 'info', // 'info' | 'success' | 'warning' | 'error'
  onClose,
  className = ''
}) {
  const icons = {
    info: <Info className="w-4 h-4 text-mauve" />,
    success: <CheckCircle className="w-4 h-4 text-trade-green" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-400" />,
    error: <AlertCircle className="w-4 h-4 text-trade-red" />
  };

  return (
    <div
      className={clsx(
        'flex items-start space-x-3 p-4 rounded-20 bg-dark-base/95 border border-white/10 backdrop-blur-glass shadow-glass max-w-sm',
        className
      )}
    >
      <div className="shrink-0 mt-0.5">{icons[type] || icons.info}</div>
      <div className="flex-1">
        <h5 className="text-sm font-semibold text-white">{title}</h5>
        {message && <p className="text-xs text-muted mt-0.5">{message}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className="text-muted hover:text-white text-xs">
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * DataTable - Standardized glass table with headers and row hover.
 */
export function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  onRowClick = null,
  emptyMessage = 'No records available',
  className = ''
}) {
  if (!data || data.length === 0) {
    return <EmptyState description={emptyMessage} />;
  }

  return (
    <div className={clsx('w-full overflow-x-auto rounded-20 border border-white/[0.08] bg-white/[0.02]', className)}>
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03] text-muted uppercase font-medium">
            {columns.map((col, idx) => (
              <th key={idx} className={clsx('py-3 px-4', col.align === 'right' ? 'text-right' : 'text-left', col.headerClass)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {data.map((row, rowIdx) => (
            <tr
              key={row[keyField] ?? rowIdx}
              onClick={() => onRowClick && onRowClick(row)}
              className={clsx(
                'transition-colors duration-150',
                onRowClick ? 'cursor-pointer hover:bg-white/[0.05]' : 'hover:bg-white/[0.02]'
              )}
            >
              {columns.map((col, cIdx) => (
                <td key={cIdx} className={clsx('py-3.5 px-4 text-white font-medium', col.align === 'right' ? 'text-right' : 'text-left')}>
                  {col.render ? col.render(row[col.accessor], row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

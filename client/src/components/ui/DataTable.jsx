import React from 'react';
import clsx from 'clsx';
import { Inbox, AlertCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Skeleton - Shimmering placeholder for loading states.
 * Shimmers between #17130C and #2B2315.
 */
export function Skeleton({ className = '' }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-16 bg-surface border border-border',
        className
      )}
    />
  );
}

/**
 * EmptyState - Illustrated empty view for tables, targets, or watchlists.
 */
export function EmptyState({
  icon = <Inbox className="w-10 h-10 text-text-muted" />,
  title = 'No items found',
  description = 'There are no active records in this section yet.',
  action = null,
  className = ''
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center p-10 text-center rounded-20 bg-surface/50 border border-border', className)}>
      <div className="p-4 rounded-full bg-raised border border-border mb-3 text-accent shadow-sm">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-text tracking-wide">{title}</h4>
      <p className="text-xs text-text-muted max-w-xs mt-1 mb-4">{description}</p>
      {action}
    </div>
  );
}

/**
 * TooltipCard - Floating tooltip card on #1E1810 with a gold border.
 */
export function TooltipCard({ children, className = '' }) {
  return (
    <div
      className={clsx(
        'p-3 rounded-16 bg-raised border border-accent/30 backdrop-blur-glass shadow-glass text-xs text-text z-50 pointer-events-none',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Toast - Notification toast popup with private-banking variants.
 * - Info: #FAF5EA on the raised surface with a gold left border (#F5B93B)
 * - Warning: #F59E0B only for warning toasts and always with an icon
 * - Success: #4ADE80 gain left border and icon
 * - Error: #F87171 loss left border and icon
 */
export function Toast({
  title,
  message,
  type = 'info', // 'info' | 'success' | 'warning' | 'error'
  onClose,
  className = ''
}) {
  const icons = {
    info: <Info className="w-4 h-4 text-accent shrink-0" />,
    success: <CheckCircle className="w-4 h-4 text-gain shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 text-warning shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-loss shrink-0" />
  };

  const borders = {
    info: 'border-l-4 border-l-accent',
    success: 'border-l-4 border-l-gain',
    warning: 'border-l-4 border-l-warning',
    error: 'border-l-4 border-l-loss'
  };

  return (
    <div
      className={clsx(
        'flex items-start space-x-3 p-4 rounded-20 bg-raised border border-border backdrop-blur-glass shadow-glass max-w-sm text-text',
        borders[type] || borders.info,
        className
      )}
    >
      <div className="shrink-0 mt-0.5">{icons[type] || icons.info}</div>
      <div className="flex-1">
        <h5 className="text-sm font-semibold text-text">{title}</h5>
        {message && <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{message}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className="text-text-muted hover:text-text text-xs p-1">
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * DataTable - Standardized glass table with headers and row hover rgba(245,185,59,0.05).
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
    <div className={clsx('w-full overflow-x-auto rounded-20 border border-border bg-surface/40', className)}>
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-surface text-text-muted uppercase font-medium">
            {columns.map((col, idx) => (
              <th key={idx} className={clsx('py-3 px-4', col.align === 'right' ? 'text-right' : 'text-left', col.headerClass)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {data.map((row, rowIdx) => (
            <tr
              key={row[keyField] ?? rowIdx}
              onClick={() => onRowClick && onRowClick(row)}
              className={clsx(
                'transition-colors duration-150',
                onRowClick ? 'cursor-pointer hover:bg-accent/[0.05]' : 'hover:bg-accent/[0.03]'
              )}
            >
              {columns.map((col, cIdx) => (
                <td key={cIdx} className={clsx('py-3.5 px-4 text-text font-medium', col.align === 'right' ? 'text-right' : 'text-left')}>
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

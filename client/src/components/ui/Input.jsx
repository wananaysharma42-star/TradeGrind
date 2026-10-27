import React from 'react';
import clsx from 'clsx';

/**
 * Input - Glassmorphic styled input with Amber Gold focus ring and borders.
 */
export function Input({
  label,
  icon = null,
  error = null,
  className = '',
  id,
  ...props
}) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-text-muted mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3.5 text-text-muted pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={clsx(
            'w-full bg-surface border border-border text-text text-sm rounded-full py-2.5 px-4 backdrop-blur-md',
            'transition-all duration-200 placeholder:text-text-muted/60',
            'focus:outline-none focus:border-accent/60 focus:bg-raised focus:ring-1 focus:ring-accent/30 focus:shadow-[0_0_15px_rgba(245,185,59,0.20)]',
            icon && 'pl-10',
            error && 'border-loss/50 focus:border-loss focus:ring-loss/30',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-loss ml-2">{error}</p>}
    </div>
  );
}

/**
 * Select - Glassmorphic styled dropdown select in Amber Gold theme.
 */
export function Select({
  label,
  options = [],
  error = null,
  className = '',
  id,
  children,
  ...props
}) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-text-muted mb-1.5 ml-1">
          {label}
        </label>
      )}
      <select
        id={id}
        className={clsx(
          'w-full bg-surface border border-border text-text text-sm rounded-full py-2.5 px-4 backdrop-blur-md',
          'transition-all duration-200 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30',
          error && 'border-loss/50',
          className
        )}
        {...props}
      >
        {children
          ? children
          : options.map((opt, idx) => {
              const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
              const text = typeof opt === 'object' && opt !== null ? opt.label : opt;
              const optKey = (val !== undefined && val !== null && val !== '') ? String(val) : `opt-${idx}`;
              return (
                <option key={optKey} value={val} className="bg-raised text-text">
                  {text}
                </option>
              );
            })}
      </select>
      {error && <p className="mt-1 text-xs text-loss ml-2">{error}</p>}
    </div>
  );
}

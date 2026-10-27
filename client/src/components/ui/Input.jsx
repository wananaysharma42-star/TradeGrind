import React from 'react';
import clsx from 'clsx';

/**
 * Input - Glassmorphic styled input with optional icon and error text.
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
        <label htmlFor={id} className="block text-xs font-medium text-muted mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3.5 text-muted pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={clsx(
            'w-full bg-glass-surface border border-white/[0.09] text-white text-sm rounded-full py-2.5 px-4 backdrop-blur-md',
            'transition-all duration-200 placeholder:text-muted/60',
            'focus:outline-none focus:border-mauve/50 focus:bg-white/[0.07] focus:ring-1 focus:ring-mauve/30 focus:shadow-glass-glow',
            icon && 'pl-10',
            error && 'border-trade-red/50 focus:border-trade-red focus:ring-trade-red/30',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-trade-red ml-2">{error}</p>}
    </div>
  );
}

/**
 * Select - Glassmorphic styled dropdown select.
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
        <label htmlFor={id} className="block text-xs font-medium text-muted mb-1.5 ml-1">
          {label}
        </label>
      )}
      <select
        id={id}
        className={clsx(
          'w-full bg-dark-base/80 border border-white/[0.09] text-white text-sm rounded-full py-2.5 px-4 backdrop-blur-md',
          'transition-all duration-200 focus:outline-none focus:border-mauve/50 focus:ring-1 focus:ring-mauve/30',
          error && 'border-trade-red/50',
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
                <option key={optKey} value={val} className="bg-dark-base text-white">
                  {text}
                </option>
              );
            })}
      </select>
      {error && <p className="mt-1 text-xs text-trade-red ml-2">{error}</p>}
    </div>
  );
}

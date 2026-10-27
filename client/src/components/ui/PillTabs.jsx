import React from 'react';
import clsx from 'clsx';

/**
 * PillTabs - Tab navigation bar with mauve-glow active state.
 */
export function PillTabs({ tabs = [], activeTab, onChange, className = '' }) {
  return (
    <div className={clsx('flex items-center space-x-1.5 p-1 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md', className)}>
      {tabs.map((tab) => {
        const key = typeof tab === 'object' ? tab.id : tab;
        const label = typeof tab === 'object' ? tab.label : tab;
        const icon = typeof tab === 'object' ? tab.icon : null;
        const isActive = activeTab === key;

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={clsx(
              'flex items-center space-x-2 px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200',
              isActive
                ? 'bg-mauve-pill text-mauve border border-mauve/40 shadow-glass-glow'
                : 'text-muted hover:text-white hover:bg-white/5'
            )}
          >
            {icon && <span className="text-sm">{icon}</span>}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * FilterPills - Compact filter toggle pills (e.g. 1D, 1W, 1M, Gainers, Losers).
 */
export function FilterPills({ options = [], value, onChange, className = '' }) {
  return (
    <div className={clsx('flex items-center space-x-1', className)}>
      {options.map((opt) => {
        const optVal = typeof opt === 'object' ? opt.value : opt;
        const optLabel = typeof opt === 'object' ? opt.label : opt;
        const isActive = value === optVal;

        return (
          <button
            key={optVal}
            onClick={() => onChange(optVal)}
            className={clsx(
              'px-3 py-1 text-xs font-semibold rounded-full border transition-all duration-150',
              isActive
                ? 'bg-mauve/20 border-mauve/50 text-mauve shadow-sm'
                : 'bg-white/[0.03] border-white/[0.07] text-muted hover:text-white hover:border-white/20'
            )}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

import React from 'react';
import clsx from 'clsx';

/**
 * PillTabs - Tab navigation bar with Amber Gold glass-glow active state.
 */
export function PillTabs({ tabs = [], activeTab, onChange, className = '' }) {
  return (
    <div className={clsx('flex items-center space-x-1.5 p-1 rounded-full bg-surface/70 border border-border backdrop-blur-md', className)}>
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
              'flex items-center space-x-2 px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              isActive
                ? 'bg-amber-pill text-accent border border-accent/35 shadow-glass-glow font-semibold'
                : 'text-text-muted hover:text-text hover:bg-surface'
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
              'px-3 py-1 text-xs font-semibold rounded-full border transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50',
              isActive
                ? 'bg-accent/15 border-accent/40 text-accent shadow-sm'
                : 'bg-surface/50 border-border text-text-muted hover:text-text hover:border-accent/25'
            )}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

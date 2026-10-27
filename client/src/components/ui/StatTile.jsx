import React, { useEffect, useState, useRef } from 'react';
import clsx from 'clsx';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * Badge - Positive/Negative Pill (Green / Red / Neutral / Mauve)
 */
export function Badge({
  children,
  variant = 'neutral', // 'positive' | 'negative' | 'mauve' | 'neutral'
  size = 'md',
  className = ''
}) {
  const styles = {
    positive: 'bg-trade-green/15 text-trade-green border-trade-green/30',
    negative: 'bg-trade-red/15 text-trade-red border-trade-red/30',
    mauve: 'bg-mauve/20 text-mauve border-mauve/40 shadow-sm',
    neutral: 'bg-white/5 text-muted border-white/10'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full border',
        styles[variant] || styles.neutral,
        sizes[size] || sizes.md,
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * NumberFlash - Animates and flashes green/red whenever the numeric value changes.
 */
export function NumberFlash({
  value,
  formatter = (v) => `$${Number(v).toFixed(2)}`,
  className = ''
}) {
  const [flash, setFlash] = useState(null); // 'green' | 'red' | null
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== undefined && value !== prevValue.current) {
      const isUp = Number(value) > Number(prevValue.current);
      setFlash(isUp ? 'green' : 'red');
      const timer = setTimeout(() => setFlash(null), 600);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
    prevValue.current = value;
  }, [value]);

  return (
    <span
      className={clsx(
        'inline-block px-1.5 py-0.5 rounded transition-all duration-300 font-mono',
        flash === 'green' && 'bg-trade-green/20 text-trade-green scale-105',
        flash === 'red' && 'bg-trade-red/20 text-trade-red scale-105',
        !flash && 'text-inherit',
        className
      )}
    >
      {formatter(value)}
    </span>
  );
}

/**
 * StatTile - Standard KPI metric tile with label, live value, change indicator, and icon.
 */
export function StatTile({
  label,
  value,
  subvalue = null,
  change = null, // number percentage e.g. +2.4 or -1.2
  icon = null,
  className = ''
}) {
  const isPositive = change != null ? change >= 0 : null;

  return (
    <div
      className={clsx(
        'p-5 rounded-20 bg-white/[0.035] border border-white/[0.07] backdrop-blur-card hover:bg-white/[0.05] transition-all',
        className
      )}
    >
      <div className="flex items-center justify-between text-muted text-xs font-medium mb-2">
        <span>{label}</span>
        {icon && <span className="p-1.5 rounded-full bg-white/5 text-muted">{icon}</span>}
      </div>
      <div className="text-xl font-bold text-white tracking-tight">{value}</div>
      {(change != null || subvalue) && (
        <div className="flex items-center space-x-1.5 mt-2 text-xs">
          {change != null && (
            <span
              className={clsx(
                'inline-flex items-center font-semibold',
                isPositive ? 'text-trade-green' : 'text-trade-red'
              )}
            >
              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
          {subvalue && <span className="text-muted truncate">{subvalue}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * StockLogo - Circular coloured initials logo.
 */
export function StockLogo({ symbol = '??', size = 'md', className = '' }) {
  const initials = symbol.slice(0, 2).toUpperCase();

  // Deterministic pastel palette based on symbol string
  const hash = initials.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palettes = [
    'bg-purple-500/20 text-purple-300 border-purple-500/40',
    'bg-pink-500/20 text-pink-300 border-pink-500/40',
    'bg-blue-500/20 text-blue-300 border-blue-500/40',
    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    'bg-amber-500/20 text-amber-300 border-amber-500/40'
  ];
  const palette = palettes[hash % palettes.length];

  const sizes = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-12 h-12 text-sm'
  };

  return (
    <div
      className={clsx(
        'rounded-full border flex items-center justify-center font-bold tracking-wider select-none shrink-0',
        palette,
        sizes[size] || sizes.md,
        className
      )}
    >
      {initials}
    </div>
  );
}

/**
 * Avatar - User avatar with fallback initials.
 */
export function Avatar({ name = 'User', src = null, size = 'md', className = '' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm'
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx('rounded-full object-cover border border-white/20', sizes[size] || sizes.md, className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full bg-mauve-gradient text-dark-base font-bold flex items-center justify-center border border-white/20 shadow-inner-glow',
        sizes[size] || sizes.md,
        className
      )}
    >
      {initials}
    </div>
  );
}

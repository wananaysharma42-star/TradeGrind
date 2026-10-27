import React, { useEffect, useState, useRef } from 'react';
import clsx from 'clsx';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * Badge - Financial Outcome Pills (Gain / Loss / Gold Accent / Neutral)
 * Gold is the brand accent; gain is green and loss is red.
 */
export function Badge({
  children,
  variant = 'neutral', // 'positive' | 'negative' | 'accent' | 'gold' | 'neutral'
  size = 'md',
  className = ''
}) {
  const styles = {
    positive: 'bg-gain/15 text-gain border-gain/30',
    negative: 'bg-loss/15 text-loss border-loss/30',
    accent: 'bg-accent/15 text-accent border-accent/35 shadow-sm',
    gold: 'bg-accent/15 text-accent border-accent/35 shadow-sm',
    neutral: 'bg-surface border-border text-text-muted'
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
  formatter = (v) => `₹${Number(v).toFixed(2)}`,
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
        flash === 'green' && 'bg-gain/20 text-gain scale-105',
        flash === 'red' && 'bg-loss/20 text-loss scale-105',
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
        'p-5 rounded-20 bg-surface/80 border border-border backdrop-blur-card hover:border-accent/30 hover:bg-surface transition-all',
        className
      )}
    >
      <div className="flex items-center justify-between text-text-muted text-xs font-medium mb-2">
        <span>{label}</span>
        {icon && <span className="p-1.5 rounded-full bg-raised border border-border text-accent">{icon}</span>}
      </div>
      <div className="text-xl font-bold text-text tracking-tight">{value}</div>
      {(change != null || subvalue) && (
        <div className="flex items-center space-x-1.5 mt-2 text-xs">
          {change != null && (
            <span
              className={clsx(
                'inline-flex items-center font-semibold',
                isPositive ? 'text-gain' : 'text-loss'
              )}
            >
              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
          {subvalue && <span className="text-text-muted truncate">{subvalue}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * StockLogo - Circular coloured initials logo.
 * Curated muted-gold/earth set with text #FAF5EA.
 */
export function StockLogo({ symbol = '??', size = 'md', className = '' }) {
  const initials = symbol.slice(0, 2).toUpperCase();

  const hash = initials.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palettes = [
    'bg-[#B7791F]/20 text-[#FAF5EA] border-[#B7791F]/40',
    'bg-[#F5B93B]/15 text-[#FAF5EA] border-[#F5B93B]/35',
    'bg-[#C27A5B]/20 text-[#FAF5EA] border-[#C27A5B]/40',
    'bg-[#A39578]/20 text-[#FAF5EA] border-[#A39578]/35',
    'bg-[#8C7A5B]/25 text-[#FAF5EA] border-[#8C7A5B]/40',
    'bg-[#D4A373]/20 text-[#FAF5EA] border-[#D4A373]/35'
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
 * Avatar - User avatar with fallback initials and gold avatar ring.
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
        className={clsx('rounded-full object-cover border-2 border-accent/60', sizes[size] || sizes.md, className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full bg-gradient-to-br from-accent-deep to-accent text-[#0C0A07] font-bold flex items-center justify-center border-2 border-accent/60 shadow-inner-glow',
        sizes[size] || sizes.md,
        className
      )}
    >
      {initials}
    </div>
  );
}

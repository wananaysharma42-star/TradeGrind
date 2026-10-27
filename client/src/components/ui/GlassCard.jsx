import React from 'react';
import clsx from 'clsx';

/**
 * GlassCard - Core visual container matching the Amber Gold private-banking design system.
 */
export function GlassCard({
  children,
  className = '',
  hoverEffect = false,
  glow = false,
  paddings = 'p-6',
  ...props
}) {
  return (
    <div
      className={clsx(
        'relative rounded-24 border border-border bg-glass-surface backdrop-blur-glass transition-all duration-300',
        glow && 'shadow-glass-glow',
        hoverEffect && 'hover:bg-accent/[0.06] hover:border-accent/30 hover:-translate-y-0.5 hover:shadow-glass',
        paddings,
        className
      )}
      {...props}
    >
      {/* Subtle top edge gold gradient reflection */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      {children}
    </div>
  );
}

export default GlassCard;

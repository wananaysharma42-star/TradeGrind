import React from 'react';
import clsx from 'clsx';

/**
 * Button - Amber Gold primary solid, secondary glass, ghost, icon-round, danger variants.
 */
export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'icon-round' | 'outline' | 'danger'
  size = 'md',        // 'sm' | 'md' | 'lg'
  icon = null,
  disabled = false,
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

  const variants = {
    // Primary: Solid gold with dark background text for the strongest CTAs
    primary: 'bg-accent text-[#0C0A07] font-semibold hover:bg-accent/90 shadow-[0_0_20px_rgba(245,185,59,0.25)] border border-accent/40',
    // Secondary: Amber glass gradient with gold text
    secondary: 'bg-amber-pill text-accent border border-accent/35 shadow-inner-glow hover:brightness-110',
    // Ghost: Raised surface with border
    ghost: 'bg-surface/60 hover:bg-surface text-text hover:text-white border border-border',
    // Outline: Gold border and text
    outline: 'border border-accent/40 text-accent hover:bg-accent/10',
    // Icon-round: Circular button for toolbars and actions
    'icon-round': 'p-2.5 rounded-full bg-surface/80 hover:bg-surface text-text-muted hover:text-text border border-border shadow-inner-glow',
    // Danger: Loss red tint with icon/text
    danger: 'bg-loss/15 text-loss hover:bg-loss/25 border border-loss/30'
  };

  const sizes = {
    sm: variant === 'icon-round' ? 'w-8 h-8' : 'px-3 py-1.5 text-xs rounded-full',
    md: variant === 'icon-round' ? 'w-10 h-10' : 'px-4 py-2 text-sm rounded-full',
    lg: variant === 'icon-round' ? 'w-12 h-12' : 'px-6 py-3 text-base rounded-full'
  };

  return (
    <button
      disabled={disabled}
      className={clsx(
        baseStyles,
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {icon && <span className={clsx(children ? 'mr-2' : '')}>{icon}</span>}
      {children}
    </button>
  );
}

export default Button;

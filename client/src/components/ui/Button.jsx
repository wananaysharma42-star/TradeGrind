import React from 'react';
import clsx from 'clsx';

/**
 * Button - Primary mauve-glass, ghost, icon-round, danger variants.
 */
export function Button({
  children,
  variant = 'primary', // 'primary' | 'ghost' | 'icon-round' | 'outline' | 'danger'
  size = 'md',        // 'sm' | 'md' | 'lg'
  icon = null,
  disabled = false,
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none';

  const variants = {
    primary: 'bg-mauve-gradient text-dark-base font-semibold shadow-glass-glow hover:brightness-110 border border-mauve-light/30',
    ghost: 'bg-white/5 hover:bg-white/10 text-white/90 hover:text-white border border-white/10',
    outline: 'border border-mauve/40 text-mauve hover:bg-mauve/10',
    'icon-round': 'p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/90 hover:text-white border border-white/10 shadow-inner-glow',
    danger: 'bg-trade-red/20 text-trade-red hover:bg-trade-red/30 border border-trade-red/30'
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

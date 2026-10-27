import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Modal - Centered glassmorphic dialogue with dark backdrop blur.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
  className = ''
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-dark-base/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
      />

      {/* Dialog content */}
      <div
        ref={modalRef}
        className={clsx(
          'relative w-full rounded-24 bg-dark-base/90 border border-white/10 p-6 backdrop-blur-glass shadow-glass z-10',
          'transition-all duration-300 animate-in zoom-in-95',
          maxWidth,
          className
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white tracking-wide">{title}</h3>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export default Modal;

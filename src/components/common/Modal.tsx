import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  centeredHeader?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl'
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  children,
  footer,
  showCloseButton = true,
  closeOnBackdrop = true,
  centeredHeader = false,
  className = '',
  headerClassName = '',
  bodyClassName = ''
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key & manage body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] w-full animate-modal ${sizeClasses[size]} ${className}`}
      >
        {/* Modal Header */}
        {centeredHeader ? (
          <div className={`p-6 pb-2 text-center relative ${headerClassName}`}>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {icon && (
              <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-100 text-mart-900 flex items-center justify-center mx-auto mb-3 shadow-xs">
                {icon}
              </div>
            )}
            {title && (
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        ) : (
          (title || icon || showCloseButton) && (
            <div className={`px-6 py-4.5 border-b border-slate-100 flex items-center justify-between gap-4 ${headerClassName}`}>
              <div className="flex items-center gap-3 min-w-0">
                {icon && (
                  <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-100 text-mart-900 flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  {title && (
                    <h3 className="font-bold text-base text-slate-900 tracking-tight truncate">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )
        )}

        {/* Modal Body */}
        <div className={`p-6 overflow-y-auto min-h-0 flex-1 ${bodyClassName}`}>
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50 flex items-center justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

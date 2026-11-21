'use client';

import React, { useEffect, useCallback } from 'react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export function AdminModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon = 'fa-circle-info',
  children,
  footer,
  maxWidth = '2xl',
}: AdminModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-2xl p-6 ${maxWidthClass} w-full shadow-2xl border border-gray-100 flex flex-col gap-5 my-8 animate-in zoom-in-95 duration-150`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#286c00] flex items-center justify-center text-sm font-bold shrink-0">
              <i className={`fa-solid ${icon}`} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 tracking-tight [text-wrap:balance]">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-sm p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286c00]"
            aria-label="Close dialog"
            type="button"
          >
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 text-xs text-gray-800">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

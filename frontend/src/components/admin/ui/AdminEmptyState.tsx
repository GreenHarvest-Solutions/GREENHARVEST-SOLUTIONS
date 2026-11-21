'use client';

import React from 'react';

interface AdminEmptyStateProps {
  title?: string;
  description?: string;
  icon?: string | React.ReactNode;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function AdminEmptyState({
  title = 'No records found',
  description = 'No matching operational data available in the platform registry.',
  icon = 'fa-inbox',
  action,
  actionLabel,
  onAction,
}: AdminEmptyStateProps) {
  return (
    <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 bg-gray-100 text-gray-500 flex items-center justify-center text-xl mb-3 border border-gray-300">
        {typeof icon === 'string' ? (
          <i className={`fa-solid ${icon}`} />
        ) : (
          icon
        )}
      </div>
      <h3 className="text-sm font-bold text-gray-900 tracking-tight mb-1 [text-wrap:balance]">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-gray-600 max-w-sm mb-4 [text-wrap:pretty]">
          {description}
        </p>
      )}
      {action ? (
        <div>{action}</div>
      ) : actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#007a6c] hover:bg-[#005f54] transition-colors"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

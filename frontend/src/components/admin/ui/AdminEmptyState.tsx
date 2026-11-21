'use client';

import React from 'react';

interface AdminEmptyStateProps {
  title?: string;
  description?: string;
  icon?: string;
  action?: React.ReactNode;
}

export function AdminEmptyState({
  title = 'No records found',
  description = 'No matching operational data available in the platform registry.',
  icon = 'fa-inbox',
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center text-xl mb-3 border border-gray-200">
        <i className={`fa-solid ${icon}`} />
      </div>
      <h3 className="text-sm font-bold text-gray-900 tracking-tight mb-1 [text-wrap:balance]">
        {title}
      </h3>
      <p className="text-xs text-gray-600 max-w-sm mb-4 [text-wrap:pretty]">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}

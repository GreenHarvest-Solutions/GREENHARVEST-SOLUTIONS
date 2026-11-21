'use client';

import React from 'react';

interface AdminToolbarProps {
  children?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}

export function AdminToolbar({
  children,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  onRefresh,
  isRefreshing = false,
  actions,
}: AdminToolbarProps) {
  return (
    <div className="bg-white border border-gray-300 p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
        {onSearchChange && (
          <div className="relative flex-1 max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#1f5400] focus:ring-1 focus:ring-[#1f5400]/20"
              aria-label={searchPlaceholder}
            />
          </div>
        )}
        {children}
      </div>

      <div className="flex items-center gap-2.5">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh current data"
            aria-label="Refresh data"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}

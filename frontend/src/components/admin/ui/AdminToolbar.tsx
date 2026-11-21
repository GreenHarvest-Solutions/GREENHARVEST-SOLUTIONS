'use client';

import React from 'react';

export interface AdminToolbarFilter {
  key: string;
  label: string;
  value: any;
  options: Array<{ label: string; value: any }>;
  onChange: (val: any) => void;
}

interface AdminToolbarProps {
  children?: React.ReactNode;
  searchQuery?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: AdminToolbarFilter[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}

export function AdminToolbar({
  children,
  searchQuery,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters,
  onRefresh,
  isRefreshing = false,
  actions,
}: AdminToolbarProps) {
  const query = searchValue !== undefined ? searchValue : searchQuery || '';

  return (
    <div className="bg-white border border-gray-300 p-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
        {onSearchChange && (
          <div className="relative flex-1 max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-[#FCF9F8] border border-gray-300 rounded-none pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#007a6c]"
              aria-label={searchPlaceholder}
            />
          </div>
        )}

        {filters &&
          filters.map((f) => (
            <div key={f.key} className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-gray-500 uppercase tracking-wider text-[11px]">
                {f.label}:
              </span>
              <select
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className="bg-white border border-gray-300 rounded-none px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-[#007a6c]"
              >
                {f.options.map((opt, idx) => (
                  <option key={idx} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

        {children}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-none border border-gray-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
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

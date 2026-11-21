'use client';

import React from 'react';

export interface AdminTabItem {
  key: string;
  label: string;
  count?: number | string;
  icon?: string;
}

interface AdminTabsProps {
  tabs: AdminTabItem[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
}

export function AdminTabs({
  tabs,
  activeTab,
  onChange,
  className = '',
}: AdminTabsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              isActive
                ? 'bg-[#1f5400] text-white shadow-xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-100'
            }`}
          >
            {tab.icon && <i className={`fa-solid ${tab.icon} text-xs`} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold tabular-nums ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

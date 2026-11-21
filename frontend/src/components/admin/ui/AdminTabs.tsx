'use client';

import React from 'react';

export interface AdminTabItem {
  key?: string;
  id?: string;
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
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {tabs.map((tab, idx) => {
        const tabKey = tab.id || tab.key || String(idx);
        const isActive = activeTab === tabKey;
        return (
          <button
            key={tabKey}
            type="button"
            onClick={() => onChange(tabKey)}
            className={`px-3 py-1.5 rounded-none text-xs font-semibold flex items-center gap-2 transition-all border ${
              isActive
                ? 'bg-[#007a6c] text-white border-[#007a6c]'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
            }`}
          >
            {tab.icon && <i className={`fa-solid ${tab.icon} text-xs`} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-700 border border-gray-300'
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

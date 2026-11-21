'use client';

import React from 'react';

interface AdminDateRangeProps {
  fromDate: string;
  toDate: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
}

export function AdminDateRange({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: AdminDateRangeProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 bg-[#FCF9F8] border border-gray-200 rounded-xl px-2.5 py-1.5">
        <span className="text-gray-500 font-medium">From:</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromChange(e.target.value)}
          className="bg-transparent text-gray-800 text-xs font-semibold focus:outline-none"
          aria-label="Filter from date"
        />
      </div>
      <div className="flex items-center gap-1.5 bg-[#FCF9F8] border border-gray-200 rounded-xl px-2.5 py-1.5">
        <span className="text-gray-500 font-medium">To:</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToChange(e.target.value)}
          className="bg-transparent text-gray-800 text-xs font-semibold focus:outline-none"
          aria-label="Filter to date"
        />
      </div>
    </div>
  );
}

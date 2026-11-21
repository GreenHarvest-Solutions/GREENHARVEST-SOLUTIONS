'use client';

import React from 'react';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  totalRecords: number;
  limit?: number;
  onPageChange: (newPage: number) => void;
  disabled?: boolean;
}

export function AdminPagination({
  page,
  totalPages,
  totalRecords,
  limit = 20,
  onPageChange,
  disabled = false,
}: AdminPaginationProps) {
  if (totalPages <= 1 && totalRecords <= limit) {
    return null;
  }

  const startRecord = Math.min((page - 1) * limit + 1, totalRecords);
  const endRecord = Math.min(page * limit, totalRecords);

  return (
    <div className="bg-white border-t border-gray-300 px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-700">
      <div className="tabular-nums font-medium">
        Showing <span className="font-bold text-gray-900">{startRecord}</span> to{' '}
        <span className="font-bold text-gray-900">{endRecord}</span> of{' '}
        <span className="font-bold text-gray-900">{totalRecords}</span> records
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || disabled}
          className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border border-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          aria-label="Previous page"
        >
          <i className="fa-solid fa-chevron-left text-[10px]" />
          <span>Prev</span>
        </button>

        <span className="px-3 py-1 text-xs font-bold text-gray-900 bg-gray-50 rounded-lg border border-gray-200 tabular-nums">
          Page {page} of {Math.max(1, totalPages)}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || disabled}
          className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border border-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          aria-label="Next page"
        >
          <span>Next</span>
          <i className="fa-solid fa-chevron-right text-[10px]" />
        </button>
      </div>
    </div>
  );
}

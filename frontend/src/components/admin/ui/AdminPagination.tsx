'use client';

import React from 'react';

interface AdminPaginationProps {
  page?: number;
  currentPage?: number;
  totalPages: number;
  totalRecords?: number;
  totalItems?: number;
  limit?: number;
  pageSize?: number;
  onPageChange: (newPage: number) => void;
  disabled?: boolean;
}

export function AdminPagination({
  page,
  currentPage,
  totalPages,
  totalRecords,
  totalItems,
  limit,
  pageSize,
  onPageChange,
  disabled = false,
}: AdminPaginationProps) {
  const activePage = currentPage !== undefined ? currentPage : page || 1;
  const count = totalItems !== undefined ? totalItems : totalRecords || 0;
  const itemsPerPage = pageSize !== undefined ? pageSize : limit || 20;

  if (totalPages <= 1 && count <= itemsPerPage) {
    return null;
  }

  const startRecord = Math.min((activePage - 1) * itemsPerPage + 1, count);
  const endRecord = Math.min(activePage * itemsPerPage, count);

  return (
    <div className="bg-white border-t border-gray-300 px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-700">
      <div className="tabular-nums font-medium">
        Showing <span className="font-bold text-gray-900">{startRecord}</span> to{' '}
        <span className="font-bold text-gray-900">{endRecord}</span> of{' '}
        <span className="font-bold text-gray-900">{count}</span> records
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(activePage - 1)}
          disabled={activePage <= 1 || disabled}
          className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold rounded-none disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <span className="px-2 tabular-nums font-medium text-gray-600">
          Page {activePage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(activePage + 1)}
          disabled={activePage >= totalPages || disabled}
          className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold rounded-none disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

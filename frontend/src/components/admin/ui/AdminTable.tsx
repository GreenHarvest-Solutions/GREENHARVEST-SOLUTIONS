'use client';

import React from 'react';
import { AdminEmptyState } from './AdminEmptyState';

export interface AdminTableColumn<T> {
  header: string;
  accessorKey?: keyof T;
  className?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: string;
  emptyAction?: React.ReactNode;
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
}

export function AdminTable<T>({
  columns,
  data,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items available matching the current criteria.',
  emptyIcon = 'fa-folder-open',
  emptyAction,
  rowKey,
  onRowClick,
}: AdminTableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-x-auto bg-white border border-gray-300">
        <div className="p-8 text-center text-xs font-semibold text-gray-500 flex items-center justify-center gap-2">
          <i className="fa-solid fa-spinner animate-spin text-[#1f5400] text-sm" />
          <span>Loading verified operational records...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-300">
        <AdminEmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white border border-gray-300">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#FCF9F8] border-b border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-xs">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`py-3 px-4 ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-300">
          {data.map((row, rowIdx) => {
            const key = rowKey ? rowKey(row, rowIdx) : rowIdx;
            return (
              <tr
                key={key}
                onClick={() => onRowClick && onRowClick(row)}
                className={`hover:bg-gray-50/60 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={`py-3.5 px-4 text-gray-800 ${col.className || ''}`}
                  >
                    {col.render
                      ? col.render(row, rowIdx)
                      : col.accessorKey
                      ? String(row[col.accessorKey] ?? '')
                      : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

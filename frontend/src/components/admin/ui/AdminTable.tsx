'use client';

import React from 'react';
import { AdminEmptyState } from './AdminEmptyState';

export interface AdminTableColumn<T> {
  key?: string;
  header: React.ReactNode;
  accessorKey?: keyof T;
  className?: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (row: T, index: number) => React.ReactNode;
  accessor?: (row: T, index: number) => React.ReactNode;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyMessage?: string;
  emptyIcon?: string;
  emptyAction?: React.ReactNode;
  rowKey?: (row: T, index: number) => string | number;
  keyExtractor?: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
}

export function AdminTable<T>({
  columns,
  data,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyMessage,
  emptyIcon = 'fa-folder-open',
  emptyAction,
  rowKey,
  keyExtractor,
  onRowClick,
}: AdminTableProps<T>) {
  const getKey = keyExtractor || rowKey;
  const title = emptyMessage || emptyTitle || 'No records found';
  const desc = emptyDescription || (emptyMessage ? undefined : 'There are no items available matching the current criteria.');

  if (loading) {
    return (
      <div className="overflow-x-auto bg-white border border-gray-300">
        <div className="p-8 text-center text-xs font-semibold text-gray-500 flex items-center justify-center gap-2">
          <i className="fa-solid fa-spinner animate-spin text-[#007a6c] text-sm" />
          <span>Loading verified operational records...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-300">
        <AdminEmptyState
          title={title}
          description={desc}
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
            {columns.map((col, idx) => {
              const alignClass =
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                  ? 'text-center'
                  : 'text-left';

              return (
                <th
                  key={col.key || idx}
                  style={col.width ? { width: col.width } : undefined}
                  className={`py-3 px-4 ${alignClass} ${col.className || ''}`}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, rowIdx) => {
            const key = getKey ? getKey(row, rowIdx) : rowIdx;
            return (
              <tr
                key={key}
                onClick={() => onRowClick && onRowClick(row)}
                className={`hover:bg-gray-50/80 transition-colors ${
                  rowIdx % 2 === 1 ? 'bg-[#FCF9F8]/50' : 'bg-white'
                } ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col, colIdx) => {
                  const alignClass =
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left';

                  return (
                    <td
                      key={col.key || colIdx}
                      className={`py-3 px-4 text-gray-800 ${alignClass} ${col.className || ''}`}
                    >
                      {col.render
                        ? col.render(row, rowIdx)
                        : col.accessor
                        ? col.accessor(row, rowIdx)
                        : col.accessorKey
                        ? String(row[col.accessorKey] ?? '')
                        : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

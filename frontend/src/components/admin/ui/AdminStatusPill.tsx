'use client';

import React from 'react';

export type StatusVariant =
  | 'success'
  | 'pending'
  | 'error'
  | 'info'
  | 'neutral'
  | 'active'
  | 'suspended'
  | 'in_transit'
  | 'breached'
  | 'optimal'
  | 'approved'
  | 'rejected'
  | 'draft';

interface AdminStatusPillProps {
  status: string;
  variant?: StatusVariant;
  icon?: string;
  className?: string;
}

export function AdminStatusPill({
  status,
  variant,
  icon,
  className = '',
}: AdminStatusPillProps) {
  const normalized = (variant || status || 'neutral').toLowerCase().replace(/[\s-]+/g, '_');

  let styleClasses = 'bg-gray-100 text-gray-700 border-gray-300';
  let defaultIcon: string | null = null;

  if (
    ['success', 'active', 'approved', 'verified', 'optimal', 'completed', 'delivered'].includes(
      normalized
    )
  ) {
    styleClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    defaultIcon = 'fa-circle-check';
  } else if (
    ['pending', 'under_review', 'review', 'loading', 'draft'].includes(normalized)
  ) {
    styleClasses = 'bg-amber-50 text-amber-900 border-amber-300';
    defaultIcon = 'fa-clock';
  } else if (
    ['error', 'suspended', 'banned', 'rejected', 'breached', 'temp_breach', 'cancelled', 'failed'].includes(
      normalized
    )
  ) {
    styleClasses = 'bg-red-50 text-red-800 border-red-200';
    defaultIcon = 'fa-circle-xmark';
  } else if (
    ['info', 'in_transit', 'rerouted', 'provisional', 'sent'].includes(normalized)
  ) {
    styleClasses = 'bg-blue-50 text-blue-800 border-blue-200';
    defaultIcon = 'fa-circle-info';
  }

  const iconToRender = icon !== undefined ? icon : defaultIcon;

  // Format label: capitalize and replace underscores with spaces
  const displayLabel = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border tabular-nums ${styleClasses} ${className}`}
    >
      {iconToRender && <i className={`fa-solid ${iconToRender} text-[10px]`} />}
      <span>{displayLabel}</span>
    </span>
  );
}


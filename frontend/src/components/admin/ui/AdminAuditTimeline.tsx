'use client';

import React from 'react';

export interface AuditTimelineItem {
  id: string | number;
  actor_name?: string;
  actor_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  reason?: string;
  created_at: string;
}

interface AdminAuditTimelineProps {
  items: AuditTimelineItem[];
  emptyMessage?: string;
}

export function AdminAuditTimeline({
  items,
  emptyMessage = 'No audit events recorded for this entity.',
}: AdminAuditTimelineProps) {
  if (!items || items.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-gray-500 font-medium">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
      {items.map((item) => (
        <div key={item.id} className="relative text-xs">
          {/* Timeline Dot */}
          <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#1f5400] ring-4 ring-white" />

          <div className="bg-[#FCF9F8] border border-gray-200 rounded-xl p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="font-bold text-gray-900">
                {item.action}
              </span>
              <span className="text-[11px] text-gray-500 tabular-nums">
                {new Date(item.created_at).toLocaleString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="text-gray-600 mb-1">
              Actor:{' '}
              <span className="font-semibold text-gray-800">
                {item.actor_name || item.actor_email || 'System'}
              </span>{' '}
              • Target: <span className="font-mono text-gray-800">{item.entity_type} {item.entity_id ? `#${item.entity_id}` : ''}</span>
            </div>

            {item.reason && (
              <p className="text-gray-700 font-medium bg-white p-2 rounded-lg border border-gray-100 mt-1.5 [text-wrap:pretty]">
                &ldquo;{item.reason}&rdquo;
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

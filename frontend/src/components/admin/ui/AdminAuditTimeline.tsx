'use client';

import React from 'react';

export interface AuditTimelineItem {
  id: string | number;
  actor_name?: string;
  actor?: string;
  actor_email?: string;
  action?: string;
  event_type?: string;
  entity_type?: string;
  entity_id?: string;
  reason?: string;
  description?: string;
  created_at?: string;
  timestamp?: string;
  status?: string;
}

interface AdminAuditTimelineProps {
  items?: AuditTimelineItem[];
  events?: AuditTimelineItem[];
  emptyMessage?: string;
}

export function AdminAuditTimeline({
  items,
  events,
  emptyMessage = 'No audit events recorded for this entity.',
}: AdminAuditTimelineProps) {
  const data = events || items || [];

  if (data.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-gray-500 font-medium">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
      {data.map((item) => {
        const actionLabel = item.action || item.event_type || 'Event';
        const actorLabel = item.actor || item.actor_name || item.actor_email || 'System';
        const timestampStr = item.created_at || item.timestamp;
        const note = item.description || item.reason;

        return (
          <div key={item.id} className="relative text-xs">
            {/* Timeline Dot */}
            <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-none bg-[#007a6c] ring-4 ring-white" />

            <div className="bg-[#FCF9F8] border border-gray-300 rounded-none p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
                  {actionLabel}
                </span>
                {timestampStr && (
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    {new Date(timestampStr).toLocaleString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>

              <div className="text-gray-600 mb-1">
                Actor: <span className="font-semibold text-gray-800">{actorLabel}</span>
                {item.entity_type && (
                  <> • Target: <span className="font-mono text-gray-800">{item.entity_type} {item.entity_id ? `#${item.entity_id}` : ''}</span></>
                )}
              </div>

              {note && (
                <p className="text-gray-700 font-medium bg-white p-2 rounded-none border border-gray-200 mt-1.5 [text-wrap:pretty]">
                  &ldquo;{note}&rdquo;
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

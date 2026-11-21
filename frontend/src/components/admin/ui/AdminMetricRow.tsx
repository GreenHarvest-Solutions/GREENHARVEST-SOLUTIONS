'use client';

import React from 'react';

export interface MetricItem {
  label: string;
  value: string | number;
  subText?: string;
  prefix?: string;
  suffix?: string;
  trend?: string;
  icon?: string;
}

interface AdminMetricRowProps {
  metrics: MetricItem[];
}

export function AdminMetricRow({ metrics }: AdminMetricRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-gray-300 p-4">
      {metrics.map((item, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {item.label}
          </span>
          <div className="flex items-baseline gap-1 text-gray-900 font-bold text-xl tracking-tight tabular-nums">
            {item.prefix && <span className="text-sm font-semibold text-gray-500">{item.prefix}</span>}
            <span>{item.value}</span>
            {item.suffix && <span className="text-sm font-semibold text-gray-500">{item.suffix}</span>}
          </div>
          {item.subText && (
            <span className="text-[11px] text-gray-500 font-medium">
              {item.subText}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

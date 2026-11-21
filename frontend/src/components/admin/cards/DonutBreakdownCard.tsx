'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface SegmentItem {
  id: string;
  label: string;
  value: number;
  color: string;
  percent: number;
}

export interface DonutBreakdownCardProps {
  title?: string;
  totalValue?: number | string;
  totalLabel?: string;
  segments?: SegmentItem[];
  index?: number;
  className?: string;
}

export const DonutBreakdownCard: React.FC<DonutBreakdownCardProps> = ({
  title = 'Order Volume by Category',
  totalValue = '1,270',
  totalLabel = 'Total orders',
  segments,
  index = 6,
  className = '',
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // Default segments matching the uploaded reference image proportions and colors
  const defaultSegments: SegmentItem[] = [
    { id: 'cereals', label: 'Cereals & Teff', value: 380, color: '#E63946', percent: 30 },
    { id: 'fruits', label: 'Fruits & Citrus', value: 254, color: '#F59E0B', percent: 20 },
    { id: 'vegetables', label: 'Fresh Vegetables', value: 317, color: '#10B981', percent: 25 },
    { id: 'coffee', label: 'Highland Coffee', value: 190, color: '#00c49f', percent: 15 },
    { id: 'pulses', label: 'Pulses & Oilseeds', value: 129, color: '#3B82F6', percent: 10 },
  ];

  const data = segments && segments.length > 0 ? segments : defaultSegments;

  // SVG Geometry for Donut with gaps
  const radius = 64;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~402.12
  const gapSize = 6;
  const totalGaps = data.length * gapSize;
  const usableCircumference = circumference - totalGaps;

  let accumulatedLength = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.25, 0.1, 0.25, 1] as const }}
      className={`bg-white rounded-none border border-gray-300 p-5 flex flex-col justify-between ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight [text-wrap:pretty]">
          {title}
        </h3>
        <button
          className="text-gray-400 hover:text-gray-700 p-1 transition-colors"
          aria-label="Options"
        >
          <i className="fa-solid fa-ellipsis text-sm" />
        </button>
      </div>

      {/* Donut Chart Viewport with Centered Metric */}
      <div className="relative w-full h-[180px] flex items-center justify-center my-2 select-none">
        <svg
          className="w-44 h-44 -rotate-90 overflow-visible"
          viewBox="0 0 160 160"
        >
          {data.map((seg) => {
            const segLength = (seg.percent / 100) * usableCircumference;
            const currentOffset = accumulatedLength;
            accumulatedLength += segLength + gapSize;

            const isHovered = hoveredSegment === seg.id;

            return (
              <motion.circle
                key={seg.id}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${segLength} ${circumference - segLength}`}
                strokeDashoffset={-currentOffset}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${segLength} ${circumference - segLength}` }}
                transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] as const }}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredSegment(seg.id)}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            );
          })}
        </svg>

        {/* Center Number & Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-3xl font-bold text-gray-900 tracking-tight tabular-nums block">
            {hoveredSegment
              ? data.find((s) => s.id === hoveredSegment)?.value.toLocaleString()
              : totalValue}
          </span>
          <span className="text-xs text-gray-500 font-medium mt-0.5">
            {hoveredSegment
              ? data.find((s) => s.id === hoveredSegment)?.label
              : totalLabel}
          </span>
        </div>
      </div>

      {/* 2-Column Legend matching reference image */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-gray-200 text-xs">
        {data.map((seg) => (
          <div
            key={seg.id}
            onMouseEnter={() => setHoveredSegment(seg.id)}
            onMouseLeave={() => setHoveredSegment(null)}
            className={`flex items-center gap-2 cursor-pointer py-0.5 px-1 rounded-none transition-colors ${
              hoveredSegment === seg.id ? 'bg-gray-100/80 font-bold' : 'text-gray-700'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="truncate text-xs">{seg.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};


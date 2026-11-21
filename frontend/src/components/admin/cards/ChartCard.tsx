'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BaseCard } from './BaseCard';

export interface ChartLegendItem {
  label: string;
  color: string;
  icon?: 'line' | 'dot' | 'square' | 'triangle' | 'ring';
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  legends?: ChartLegendItem[];
  index?: number;
  height?: number | string;
  className?: string;
  children: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  badge,
  action,
  legends,
  index = 0,
  height = 280,
  className = '',
  children,
}) => {
  return (
    <BaseCard
      title={title}
      subtitle={subtitle}
      badge={badge}
      action={action}
      index={index}
      className={className}
    >
      <div className="flex flex-col gap-4">
        {/* Legends Bar inspired by Tag Summary chart legend */}
        {legends && legends.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-2 border-b border-gray-100 text-xs">
            {legends.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-gray-600 font-medium">
                {item.icon === 'square' ? (
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                ) : item.icon === 'triangle' ? (
                  <span
                    className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] shrink-0"
                    style={{ borderBottomColor: item.color }}
                  />
                ) : item.icon === 'ring' ? (
                  <span
                    className="w-2.5 h-2.5 rounded-full border-2 shrink-0"
                    style={{ borderColor: item.color }}
                  />
                ) : item.icon === 'line' ? (
                  <span
                    className="w-4 h-0.5 rounded shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                ) : (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span className="text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chart Viewport */}
        <div style={{ height }} className="w-full relative flex items-center justify-center">
          {children}
        </div>
      </div>
    </BaseCard>
  );
};

/**
 * Animated SVG Line Component
 * Automatically draws itself from left to right on mount using Framer Motion pathLength.
 */
export const AnimatedSvgLine: React.FC<{
  d: string;
  stroke?: string;
  strokeWidth?: number;
  duration?: number;
  delay?: number;
}> = ({
  d,
  stroke = '#00A896',
  strokeWidth = 2.5,
  duration = 1.6,
  delay = 0.2,
}) => {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{
        pathLength: { duration, ease: [0.25, 0.1, 0.25, 1] as const, delay },
        opacity: { duration: 0.3, delay },
      }}
    />
  );
};

/**
 * Animated SVG Bar Component
 * Grows from bottom to top on mount using scaleY.
 */
export const AnimatedSvgBar: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  rx?: number;
  delay?: number;
}> = ({
  x,
  y,
  width,
  height,
  fill = '#00A896',
  rx = 4,
  delay = 0,
}) => {
  return (
    <motion.rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      rx={rx}
      initial={{ scaleY: 0, originY: 1 }}
      animate={{ scaleY: 1 }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.34, 1.56, 0.64, 1] as const,
      }}
    />
  );
};

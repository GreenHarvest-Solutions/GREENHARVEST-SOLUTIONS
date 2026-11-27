'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useSpring, useTransform } from 'framer-motion';

/* -------------------------------------------------------------------------- */
/* Animated Number Helper                                                     */
/* -------------------------------------------------------------------------- */
function AnimatedMetricValue({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const spring = useSpring(0, {
    mass: 0.8,
    stiffness: 75,
    damping: 15,
  });

  const display = useTransform(spring, (current: number) => {
    return `${prefix}${current.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  });

  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    return display.on('change', (latest: string) => {
      if (ref.current) {
        ref.current.textContent = latest;
      }
    });
  }, [display]);

  return (
    <span ref={ref} className="tabular-nums font-normal text-gray-900 tracking-tight">
      {prefix}
      {value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Seller Metric Card & Horizontal Strip (Admin Dashboard MetricStrip Style)   */
/* -------------------------------------------------------------------------- */
export interface SellerMetricCardProps {
  label: string;
  value: number | string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  subText?: string;
  href?: string;
  icon?: string;
  className?: string;
}

export const SellerMetricCard: React.FC<SellerMetricCardProps> = ({
  label,
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  subText,
  href,
  icon,
  className = '',
}) => {
  const isNumeric = typeof value === 'number';

  return (
    <div
      className={`p-4 md:py-5 md:px-3 min-h-[124px] flex flex-col items-center justify-between text-center bg-white hover:bg-gray-50/80 transition-colors ${className}`}
    >
      {/* Top Label */}
      <div className="flex items-center justify-center gap-1.5 text-center min-h-[1.25rem] w-full">
        {icon && (
          <span className="material-symbols-outlined text-[15px] text-[#007a6c] shrink-0">
            {icon}
          </span>
        )}
        <span className="text-xs font-medium text-gray-600 tracking-normal [text-wrap:pretty]">
          {label}
        </span>
      </div>

      {/* Main Number */}
      <div className="flex-1 flex items-center justify-center text-center my-auto py-1.5 w-full">
        <div className="text-2xl xl:text-[28px] font-normal text-gray-900 tracking-tight text-center tabular-nums leading-none">
          {isNumeric ? (
            <AnimatedMetricValue
              value={value as number}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
            />
          ) : (
            <span className="font-normal text-gray-900">
              {prefix}
              {value}
              {suffix}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Underlined Subtext */}
      <div className="min-h-[1.25rem] flex items-center justify-center text-center w-full">
        {subText ? (
          href ? (
            <Link
              href={href}
              className="text-[11px] text-gray-500 font-normal underline underline-offset-4 decoration-gray-300 hover:decoration-[#007a6c] hover:text-gray-900 transition-colors"
            >
              {subText}
            </Link>
          ) : (
            <span className="text-[11px] text-gray-500 font-normal underline underline-offset-4 decoration-gray-300">
              {subText}
            </span>
          )
        ) : (
          <span className="block h-3" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export const SellerMetricStrip: React.FC<{
  children: React.ReactNode;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}> = ({ children, headerLeft, headerRight, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`bg-white rounded-none border border-gray-300 overflow-hidden ${className}`}
    >
      {(headerLeft || headerRight) && (
        <div className="px-5 py-3 border-b border-gray-300 bg-white flex flex-wrap items-center justify-between gap-3">
          <div>{headerLeft}</div>
          <div>{headerRight}</div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr divide-y sm:divide-y-0 sm:divide-x divide-gray-300">
        {children}
      </div>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/* Seller Donut Breakdown Card (Admin DonutBreakdownCard Style)               */
/* -------------------------------------------------------------------------- */
export interface SellerDonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
  percent: number;
}

export interface SellerDonutCardProps {
  title: string;
  subtitle?: string;
  totalValue: number | string;
  totalLabel: string;
  segments: SellerDonutSegment[];
  action?: React.ReactNode;
  emptyMessage?: string;
  embedded?: boolean;
  index?: number;
  className?: string;
}

export const SellerDonutCard: React.FC<SellerDonutCardProps> = ({
  title,
  subtitle,
  totalValue,
  totalLabel,
  segments,
  action,
  emptyMessage = 'No activity recorded yet',
  embedded = false,
  index = 1,
  className = '',
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nonZeroSegments = segments.filter((s) => s.percent > 0);
  const hasRealData = nonZeroSegments.length > 0;

  const radius = 60;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const gapSize = nonZeroSegments.length > 1 ? 6 : 0;
  const totalGaps = nonZeroSegments.length * gapSize;
  const usableCircumference = Math.max(1, circumference - totalGaps);

  let accumulatedLength = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: embedded ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className={`bg-white rounded-none flex flex-col justify-between ${
        embedded ? '' : 'border border-gray-300'
      } ${className}`}
    >
      {/* Header */}
      <div
        className={`px-5 py-3.5 flex items-center justify-between gap-3 bg-white ${
          embedded ? 'border-b border-gray-200' : 'border-b border-gray-300'
        }`}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 tracking-tight truncate">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Donut SVG Viewport */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="relative w-full h-[168px] flex items-center justify-center my-1 select-none">
          <svg className="w-40 h-40 -rotate-90 overflow-visible" viewBox="0 0 160 160">
            {!hasRealData ? (
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="#E5E7EB"
                strokeWidth={strokeWidth}
                strokeDasharray="6 6"
              />
            ) : (
              nonZeroSegments.map((seg) => {
                const segLength = (seg.percent / 100) * usableCircumference;
                const currentOffset = accumulatedLength;
                accumulatedLength += segLength + gapSize;
                const isHovered = hoveredId === seg.id;

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
                    transition={{ duration: 0.9, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredId(seg.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                );
              })
            )}
          </svg>

          {/* Centered Metric */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
            <span className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums leading-tight">
              {hoveredId
                ? (segments.find((s) => s.id === hoveredId)?.value ?? 0).toLocaleString()
                : totalValue}
            </span>
            <span className="text-[11px] text-gray-500 font-medium mt-0.5 line-clamp-1">
              {hoveredId
                ? segments.find((s) => s.id === hoveredId)?.label
                : totalLabel}
            </span>
          </div>
        </div>

        {!hasRealData && (
          <p className="text-[11px] text-center text-gray-400 pb-2">{emptyMessage}</p>
        )}

        {/* 2-Column Interactive Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-gray-200 text-xs">
          {segments.map((seg) => (
            <div
              key={seg.id}
              onMouseEnter={() => setHoveredId(seg.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`flex items-center justify-between gap-2 cursor-pointer py-0.5 px-1.5 transition-colors ${
                hoveredId === seg.id ? 'bg-gray-100 font-semibold' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="truncate text-[11px]">{seg.label}</span>
              </div>
              <span className="text-[11px] font-bold text-gray-900 tabular-nums shrink-0">
                {seg.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/* Radial Store Health / Inventory Readiness Widget (Admin Last-Seen Style)   */
/* -------------------------------------------------------------------------- */
export const SellerHealthCard: React.FC<{
  healthScore: number;
  totalProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  farmLocation: string;
  isVerified: boolean;
}> = ({
  healthScore,
  totalProducts,
  inStockCount,
  lowStockCount,
  outOfStockCount,
  farmLocation,
  isVerified,
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="bg-white rounded-none border border-gray-300 overflow-hidden flex flex-col"
    >
      <div className="px-4 py-2.5 border-b border-gray-300 bg-white flex items-center justify-between">
        <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
          Store &amp; Stock Health
        </span>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
            isVerified
              ? 'border-emerald-300 text-emerald-800 bg-emerald-50/40'
              : 'border-amber-300 text-amber-800 bg-amber-50/40'
          }`}
        >
          {isVerified ? 'VERIFIED' : 'PROVISIONAL'}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-3xl font-normal text-gray-900 tabular-nums block leading-none">
              {totalProducts} <span className="text-sm text-gray-500 font-medium">crops</span>
            </span>
            <span className="text-[11px] text-gray-500 mt-1.5 block">
              {inStockCount} healthy • {lowStockCount} low • {outOfStockCount} out
            </span>
          </div>

          {/* Radial Arc Gauge */}
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200"
                strokeWidth="3.2"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <motion.path
                className="text-[#007a6c]"
                strokeDasharray="100, 100"
                initial={{ strokeDashoffset: 100 }}
                animate={{ strokeDashoffset: 100 - clampedScore }}
                transition={{ duration: 1.1, delay: 0.2 }}
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center leading-none">
              <span className="text-xs font-bold text-gray-900 tabular-nums">{clampedScore}%</span>
              <span className="text-[9px] font-medium text-gray-500">stock</span>
            </div>
          </div>
        </div>

        {/* Bottom Metadata Row */}
        <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-gray-700 min-w-0">
            <span className="material-symbols-outlined text-base text-gray-700 shrink-0">
              location_on
            </span>
            <span className="font-semibold text-gray-900 truncate">{farmLocation}</span>
          </div>
          <Link
            href="/farmer/products"
            className="text-[11px] font-bold text-[#007a6c] hover:underline shrink-0"
          >
            Audit Stock →
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

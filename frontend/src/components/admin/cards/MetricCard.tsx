'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export interface MetricCardProps {
  label: string;
  value: number | string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  subText?: string;
  subTextLink?: string;
  trend?: {
    value: number | string;
    isPositive?: boolean;
    label?: string;
  };
  accentColor?: string;
  icon?: string;
  index?: number;
  isStripItem?: boolean;
  className?: string;
}

function AnimatedNumber({
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

  const display = useTransform(spring, (current) => {
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
    return display.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = latest;
      }
    });
  }, [display]);

  return (
    <span
      ref={ref}
      className="tabular-nums font-normal text-gray-900 tracking-tight"
    >
      {prefix}
      {value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  subText,
  subTextLink,
  trend,
  accentColor = '#007a6c',
  icon,
  index = 0,
  isStripItem = false,
  className = '',
}) => {
  const isNumeric = typeof value === 'number';

  // Exact reproduction of the Tag Summary metric cell:
  // - Top label: centered, dark gray/slate, natural casing
  // - Metric: centered, large, clean font, high contrast
  // - Bottom subtext: centered, muted gray with subtle underline (like "from 30th Sept", "at field")
  const content = (
    <>
      {/* Top Label */}
      <div className="flex items-center justify-center gap-1.5 text-center min-h-[1.5rem] w-full">
        {icon && (
          <i
            className={`fa-solid ${icon} text-xs text-[#007a6c] shrink-0`}
            aria-hidden="true"
          />
        )}
        <span className="text-xs md:text-sm font-medium text-gray-700 tracking-normal [text-wrap:pretty]">
          {label}
        </span>
      </div>

      {/* Main Metric Number - Centered Horizontally & Vertically */}
      <div className="flex-1 flex items-center justify-center text-center my-auto py-2 w-full">
        <div className="text-3xl md:text-4xl font-normal text-gray-900 tracking-tight text-center tabular-nums">
          {isNumeric ? (
            <AnimatedNumber
              value={value as number}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
            />
          ) : (
            <span className="font-normal text-gray-900">
              {prefix}{value}{suffix}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Sub-text (with subtle underline matching uploaded image) */}
      <div className="min-h-[1.5rem] flex items-center justify-center text-center w-full">
        {subText ? (
          subTextLink ? (
            <a
              href={subTextLink}
              className="text-xs text-gray-500 font-normal underline underline-offset-4 decoration-gray-400 hover:decoration-gray-700 hover:text-gray-800 transition-colors cursor-pointer"
            >
              {subText}
            </a>
          ) : (
            <span className="text-xs text-gray-500 font-normal underline underline-offset-4 decoration-gray-400">
              {subText}
            </span>
          )
        ) : trend ? (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none border font-semibold tabular-nums text-xs ${
              trend.isPositive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <i
              className={`fa-solid ${
                trend.isPositive ? 'fa-arrow-up' : 'fa-arrow-down'
              } text-[10px]`}
            />
            {trend.value}
          </span>
        ) : (
          <span className="block h-4" aria-hidden="true" />
        )}
      </div>
    </>
  );

  if (isStripItem) {
    return (
      <div
        className={`p-4 md:py-5 md:px-3 min-h-[130px] md:min-h-[150px] flex flex-col items-center justify-between text-center bg-[#FCF9F8] hover:bg-[#F2ECE8] transition-colors ${className}`}
      >
        {content}
      </div>
    );
  }

  return (
    <motion.div
      custom={index}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
      whileHover={{
        y: -2,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      className={`bg-[#FCF9F8] rounded-none border border-gray-300 p-6 min-h-[140px] flex flex-col items-center justify-between text-center hover:bg-[#F2ECE8] transition-colors ${className}`}
    >
      {content}
    </motion.div>
  );
};

/**
 * MetricStrip Component
 * Reproduces the horizontal strip with unrounded straight line borders,
 * dashboard-matching background, and vertical column dividers.
 */
export const MetricStrip: React.FC<{
  children: React.ReactNode;
  columns?: number;
  className?: string;
  index?: number;
}> = ({ children, columns, className = '', index = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className={`bg-[#FCF9F8] rounded-none border border-gray-300 grid grid-flow-row sm:grid-flow-col auto-cols-fr divide-y sm:divide-y-0 sm:divide-x divide-gray-300 ${className}`}
    >
      {children}
    </motion.div>
  );
};

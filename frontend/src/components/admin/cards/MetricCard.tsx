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
      <div className="flex items-center justify-center gap-1.5 text-center min-h-[1.25rem]">
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

      {/* Main Metric Number */}
      <div className="text-3xl md:text-4xl font-normal text-gray-900 tracking-tight my-1.5 text-center tabular-nums">
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

      {/* Bottom Sub-text (with subtle underline matching uploaded image) */}
      <div className="min-h-[1.25rem] flex items-center justify-center text-center">
        {subText ? (
          subTextLink ? (
            <a
              href={subTextLink}
              className="text-xs text-gray-500 font-normal underline underline-offset-4 decoration-gray-300 hover:decoration-gray-700 hover:text-gray-800 transition-colors cursor-pointer"
            >
              {subText}
            </a>
          ) : (
            <span className="text-xs text-gray-500 font-normal underline underline-offset-4 decoration-gray-300">
              {subText}
            </span>
          )
        ) : trend ? (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold tabular-nums text-xs ${
              trend.isPositive
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-rose-50 text-rose-800'
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
        className={`p-4 md:py-6 md:px-5 flex flex-col items-center justify-center text-center hover:bg-gray-50/60 transition-colors ${className}`}
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
        y: -3,
        borderColor: accentColor,
        boxShadow: '0 12px 24px -6px rgba(0, 122, 108, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
        transition: { duration: 0.22, ease: 'easeOut' },
      }}
      className={`bg-white rounded-2xl p-6 border border-gray-200/90 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center text-center ${className}`}
    >
      {content}
    </motion.div>
  );
};

/**
 * MetricStrip Component
 * Exactly reproduces the horizontal strip from the Tag Summary report with delicate vertical dividers.
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
      className={`bg-white rounded-2xl border border-gray-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden grid grid-flow-row sm:grid-flow-col auto-cols-fr divide-y sm:divide-y-0 sm:divide-x divide-gray-200/80 ${className}`}
    >
      {children}
    </motion.div>
  );
};

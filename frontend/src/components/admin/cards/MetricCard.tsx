'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export interface MetricCardProps {
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  subText?: string;
  trend?: {
    value: number | string;
    isPositive?: boolean;
    label?: string;
  };
  accentColor?: string; // defaults to teal '#00A896'
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
      className="tabular-nums font-extrabold text-gray-900 tracking-tight"
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
  trend,
  accentColor = '#00A896',
  icon,
  index = 0,
  isStripItem = false,
  className = '',
}) => {
  const containerClasses = isStripItem
    ? `bg-white p-5 flex flex-col items-center justify-center text-center border-r border-gray-100 last:border-r-0 hover:bg-teal-50/20 transition-colors ${className}`
    : `bg-white rounded-2xl p-6 border border-gray-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center text-center ${className}`;

  return (
    <motion.div
      custom={index}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.07,
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
      whileHover={
        !isStripItem
          ? {
              y: -4,
              borderColor: accentColor,
              boxShadow: '0 14px 28px -6px rgba(0, 168, 150, 0.14), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
              transition: { duration: 0.22, ease: 'easeOut' },
            }
          : undefined
      }
      className={containerClasses}
    >
      {/* Top Label (Small, uppercase, muted gray tracking) */}
      <div className="flex items-center gap-1.5 mb-2">
        {icon && (
          <i
            className={`fa-solid ${icon} text-xs text-[#00A896]`}
            aria-hidden="true"
          />
        )}
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>

      {/* Main Centered Metric Value */}
      <div className="text-3xl font-extrabold text-gray-900 my-1">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
        />
      </div>

      {/* Sub-text / Trend / Context below */}
      {(subText || trend) && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-500 font-medium">
          {trend && (
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
          )}
          {subText && <span className="[text-wrap:pretty]">{subText}</span>}
        </div>
      )}
    </motion.div>
  );
};

export const MetricStrip: React.FC<{
  children: React.ReactNode;
  className?: string;
  index?: number;
}> = ({ children, className = '', index = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className={`bg-white rounded-2xl border border-gray-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden grid grid-flow-col auto-cols-fr divide-x divide-gray-100 ${className}`}
    >
      {children}
    </motion.div>
  );
};

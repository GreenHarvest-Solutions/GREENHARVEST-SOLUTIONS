'use client';

import React from 'react';
import { motion, HTMLMotionProps, Variants } from 'framer-motion';

export interface BaseCardProps extends Omit<HTMLMotionProps<'div'>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  index?: number;
  interactive?: boolean;
  noPadding?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const cardEntranceVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      delay: i * 0.08,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  }),
};

export const BaseCard: React.FC<BaseCardProps> = ({
  title,
  subtitle,
  action,
  badge,
  index = 0,
  interactive = true,
  noPadding = false,
  className = '',
  children,
  ...motionProps
}) => {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardEntranceVariants}
      whileHover={
        interactive
          ? {
              y: -4,
              borderColor: '#00A896',
              boxShadow: '0 14px 28px -6px rgba(0, 168, 150, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
              transition: { duration: 0.25, ease: 'easeOut' },
            }
          : undefined
      }
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`bg-white rounded-2xl border border-gray-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] transition-colors overflow-hidden flex flex-col ${className}`}
      {...motionProps}
    >
      {(title || action || badge) && (
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-white/80 backdrop-blur-xs">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {typeof title === 'string' ? (
                <h3 className="text-sm font-bold text-[#00A896] tracking-wider uppercase">
                  {title}
                </h3>
              ) : (
                title
              )}
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 font-medium mt-0.5 [text-wrap:pretty]">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      )}

      <div className={`flex-1 ${noPadding ? '' : 'p-6'}`}>
        {children}
      </div>
    </motion.div>
  );
};

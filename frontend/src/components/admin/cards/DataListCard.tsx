'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BaseCard } from './BaseCard';

export interface DataListItem {
  id?: string | number;
  label: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
  hint?: string;
  icon?: string;
}

export interface DataListCardProps {
  title: string;
  subtitle?: string;
  items: DataListItem[];
  badge?: React.ReactNode;
  action?: React.ReactNode;
  index?: number;
  initiallyExpanded?: boolean;
  maxVisibleItems?: number;
  alternatingRows?: boolean;
  className?: string;
}

export const DataListCard: React.FC<DataListCardProps> = ({
  title,
  subtitle,
  items,
  badge,
  action,
  index = 0,
  initiallyExpanded = false,
  maxVisibleItems = 6,
  alternatingRows = true,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  const hasExpandableContent = items.length > maxVisibleItems;
  const visibleItems = isExpanded || !hasExpandableContent ? items : items.slice(0, maxVisibleItems);

  return (
    <BaseCard
      title={title}
      subtitle={subtitle}
      badge={badge}
      action={action}
      index={index}
      noPadding
      className={className}
      layout
    >
      <div className="w-full overflow-hidden">
        <ul className="divide-y divide-gray-100">
          <AnimatePresence initial={false}>
            {visibleItems.map((item, idx) => (
              <motion.li
                key={item.id ?? `${item.label}-${idx}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`px-6 py-3.5 flex items-center justify-between gap-4 text-xs transition-colors hover:bg-teal-50/20 ${
                  alternatingRows && idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'
                }`}
              >
                {/* Left Label */}
                <div className="flex items-center gap-2.5 min-w-[35%] max-w-[45%] shrink-0">
                  {item.icon && (
                    <i
                      className={`fa-solid ${item.icon} text-gray-400 text-xs shrink-0`}
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <span className="font-semibold text-gray-600 block uppercase tracking-wider text-[11px] md:text-xs">
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        {item.hint}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Value & Badge */}
                <div className="flex items-center justify-end gap-2.5 flex-1 min-w-0 text-right">
                  <div className="font-bold text-gray-900 truncate tabular-nums text-xs md:text-sm">
                    {item.value}
                  </div>
                  {item.badge && <div className="shrink-0">{item.badge}</div>}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {hasExpandableContent && (
          <div className="px-6 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-bold text-[#00A896] hover:text-[#008073] flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A896] rounded px-2 py-1"
            >
              <span>{isExpanded ? 'Show Less' : `View All ${items.length} Records`}</span>
              <motion.i
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="fa-solid fa-chevron-down text-[10px]"
              />
            </button>
          </div>
        )}
      </div>
    </BaseCard>
  );
};

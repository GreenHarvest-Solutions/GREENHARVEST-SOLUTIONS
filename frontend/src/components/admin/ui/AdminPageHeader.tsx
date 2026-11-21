'use client';

import React from 'react';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  icon?: string;
  badge?: string | number;
  badgeLabel?: string;
  actions?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  description,
  subtitle,
  breadcrumbs,
  icon = 'fa-sliders',
  badge,
  badgeLabel,
  actions,
}: AdminPageHeaderProps) {
  const displayDescription = description || subtitle;

  return (
    <header className="px-8 py-5 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-4 shrink-0">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-gray-400">/</span>}
                {b.href ? (
                  <a href={b.href} className="hover:text-[#007a6c] transition-colors">
                    {b.label}
                  </a>
                ) : (
                  <span className="font-semibold text-gray-800">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#286c00] flex items-center justify-center text-sm font-bold shrink-0">
            <i className={`fa-solid ${icon}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight [text-wrap:balance]">
                {title}
              </h1>
              {badge !== undefined && (
                <span className="text-xs font-bold text-[#1f5400] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tabular-nums">
                  {typeof badge === 'number' ? `${badge.toLocaleString()} ${badgeLabel || 'Records'}` : badge}
                </span>
              )}
            </div>
            {displayDescription && (
              <p className="text-xs text-gray-600 mt-0.5">
                {displayDescription}
              </p>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
}


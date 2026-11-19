'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface AdminNavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: string;
    badge?: string;
    badgeColor?: string;
  }[];
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminName, setAdminName] = useState('System Administrator');
  const [adminRole, setAdminRole] = useState('Superadmin • Tier 1');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed.full_name || parsed.name) {
            setAdminName(parsed.full_name || parsed.name);
          }
          if (parsed.role) {
            setAdminRole(`${parsed.role.toUpperCase()} • Master Access`);
          }
        }
      } catch {
        // Fallback to default admin title
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Clear local storage regardless of API response
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
      router.push('/login');
    }
  };

  const navSections: AdminNavSection[] = [
    {
      title: 'Command & Telemetry',
      items: [
        { label: 'Overview Dashboard', href: '/admin/dashboard', icon: 'fa-gauge-high' },
        { label: 'Platform Analytics', href: '/admin/analytics', icon: 'fa-chart-line' },
      ],
    },
    {
      title: 'Marketplace Governance',
      items: [
        {
          label: 'Farmer KYC Queue',
          href: '/admin/dashboard?tab=verifications',
          icon: 'fa-id-card',
          badge: '3',
          badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300',
        },
        {
          label: 'Product Moderation',
          href: '/admin/dashboard?tab=moderation',
          icon: 'fa-shield-halved',
          badge: '2',
          badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300',
        },
        {
          label: 'Dispute Mediation',
          href: '/admin/dashboard?tab=disputes',
          icon: 'fa-scale-balanced',
          badge: '2',
          badgeColor: 'bg-red-100 text-red-900 border border-red-300',
        },
        {
          label: 'User & Store Registry',
          href: '/admin/users',
          icon: 'fa-users-gear',
        },
      ],
    },
    {
      title: 'Logistics & Settlement',
      items: [
        {
          label: 'Cold-Chain Dispatch',
          href: '/admin/deliveries',
          icon: 'fa-truck-fast',
          badge: '14 Active',
          badgeColor: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        },
        {
          label: 'Escrow Settlements',
          href: '/admin/analytics',
          icon: 'fa-money-bill-transfer',
        },
      ],
    },
    {
      title: 'System & Security',
      items: [
        {
          label: 'Platform Settings',
          href: '/admin/settings',
          icon: 'fa-sliders',
        },
      ],
    },
  ];

  const isLinkActive = (href: string) => {
    const cleanHref = href.split('?')[0];
    if (cleanHref === '/admin/dashboard') {
      return pathname === '/admin/dashboard' && (!href.includes('?') || href === pathname);
    }
    return pathname.startsWith(cleanHref);
  };

  return (
    <aside className="w-64 bg-white flex flex-col h-full border-r border-gray-100 z-10 relative shrink-0">
      {/* Background Graphic */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/15 to-emerald-50/30 pointer-events-none" />

      {/* Header with Admin Console Authority */}
      <div className="px-5 py-5 flex flex-col gap-2 relative z-10 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid grid-cols-2 gap-1 w-6 h-6">
              <div className="w-2.5 h-2.5 rounded-full bg-[#286c00]" />
              <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-800" />
              <div className="w-2.5 h-2.5 rounded-full border-2 border-[#286c00]" />
              <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">
              Green<span className="text-[#286c00]">Harvest</span>
            </span>
          </div>

          <span className="text-xs font-bold text-[#286c00] bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
            <i className="fa-solid fa-shield-halved text-[11px]" />
            Admin
          </span>
        </div>

        {/* System Sub-Label */}
        <div className="flex items-center justify-between text-xs text-gray-600 font-medium px-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            Enterprise Control
          </span>
          <span className="font-mono text-gray-500">v1.2</span>
        </div>
      </div>

      {/* Structured Admin Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto hide-scrollbar relative z-10 min-h-0 space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <span className="px-3 text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">
              {section.title}
            </span>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isLinkActive(item.href);
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium text-xs ${
                        active
                          ? 'bg-[#286c00] text-white shadow-md shadow-[#286c00]/25 font-semibold'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-emerald-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <i
                          className={`fa-solid ${item.icon} w-4 text-center text-xs shrink-0 ${
                            active ? 'text-white' : 'text-gray-500'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${
                            active
                              ? 'bg-white/20 text-white'
                              : item.badgeColor || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Admin Profile & Session Footer */}
      <div className="p-3.5 relative z-10 shrink-0 border-t border-gray-100 bg-[#FCF9F8]">
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#286c00] flex items-center justify-center font-bold text-xs shrink-0">
              <i className="fa-solid fa-user-shield text-sm" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900 truncate">{adminName}</p>
              <p className="text-xs text-gray-600 truncate">{adminRole}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            aria-label="Sign out of administrative session"
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

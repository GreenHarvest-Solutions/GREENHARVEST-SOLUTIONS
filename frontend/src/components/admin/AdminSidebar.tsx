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
  const [adminRole, setAdminRole] = useState('Super Admin');
  const [counts, setCounts] = useState({
    kyc: 0,
    moderation: 0,
    disputes: 0,
    fleetBreaches: 0,
  });

  useEffect(() => {
    const fetchAdminInfo = async () => {
      try {
        const meRes = await api.getAdminMe();
        if (meRes?.admin) {
          setAdminName(meRes.admin.name || 'System Administrator');
          const roleDisplay = (meRes.admin.admin_role?.name || meRes.admin.role || 'Admin')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          setAdminRole(roleDisplay);
        }
      } catch {
        // Fallback to local storage if API call fails
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem('user');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.name || parsed.full_name) setAdminName(parsed.name || parsed.full_name);
              if (parsed.role) setAdminRole(parsed.role.toUpperCase());
            }
          } catch {}
        }
      }
    };

    const fetchCounts = async () => {
      try {
        const res = await api.getAdminDashboard();
        if (res && res.metrics) {
          setCounts({
            kyc: Number(res.metrics.kyc_pending_count || 0),
            moderation: Number(res.metrics.moderation_pending_count || 0),
            disputes: Number(res.metrics.disputes_open_count || 0),
            fleetBreaches: Number(res.metrics.fleet_breaches_count || 0),
          });
        }
      } catch {
        // Keep 0 on error
      }
    };

    fetchAdminInfo();
    fetchCounts();
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
        { label: 'Alerts & SLA', href: '/admin/alerts', icon: 'fa-bell' },
        { label: 'Platform Analytics', href: '/admin/analytics', icon: 'fa-chart-line' },
      ],
    },
    {
      title: 'Marketplace Governance',
      items: [
        {
          label: 'Farmer KYC',
          href: '/admin/kyc',
          icon: 'fa-id-card',
          badge: counts.kyc > 0 ? String(counts.kyc) : undefined,
          badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300',
        },
        {
          label: 'Products & Moderation',
          href: '/admin/products',
          icon: 'fa-shield-halved',
          badge: counts.moderation > 0 ? String(counts.moderation) : undefined,
          badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300',
        },
        { label: 'Categories & Attributes', href: '/admin/categories', icon: 'fa-tags' },
        { label: 'Reviews', href: '/admin/reviews', icon: 'fa-star-half-stroke' },
        { label: 'Campaigns', href: '/admin/campaigns', icon: 'fa-bullhorn' },
        { label: 'Price Governance', href: '/admin/pricing', icon: 'fa-chart-simple' },
      ],
    },
    {
      title: 'Commerce & Settlement',
      items: [
        { label: 'Orders', href: '/admin/orders', icon: 'fa-cart-shopping' },
        { label: 'Payments', href: '/admin/payments', icon: 'fa-credit-card' },
        { label: 'Escrow & Payouts', href: '/admin/escrow', icon: 'fa-money-bill-transfer' },
        {
          label: 'Disputes',
          href: '/admin/disputes',
          icon: 'fa-scale-balanced',
          badge: counts.disputes > 0 ? String(counts.disputes) : undefined,
          badgeColor: 'bg-red-100 text-red-900 border border-red-300',
        },
        { label: 'Returns', href: '/admin/returns', icon: 'fa-arrow-rotate-left' },
      ],
    },
    {
      title: 'Logistics',
      items: [
        {
          label: 'Fleet & Telemetry',
          href: '/admin/deliveries',
          icon: 'fa-truck-fast',
          badge: counts.fleetBreaches > 0 ? `${counts.fleetBreaches} Alert` : undefined,
          badgeColor: 'bg-red-100 text-red-900 border border-red-300',
        },
        { label: 'Carriers', href: '/admin/logistics/carriers', icon: 'fa-building-shield' },
        { label: 'Hubs & Routes', href: '/admin/logistics/hubs', icon: 'fa-route' },
        { label: 'Incidents', href: '/admin/logistics/incidents', icon: 'fa-triangle-exclamation' },
      ],
    },
    {
      title: 'People',
      items: [
        { label: 'Users', href: '/admin/users', icon: 'fa-users-gear' },
        { label: 'Field Agents', href: '/admin/field-agents', icon: 'fa-user-pen' },
        { label: 'Delivery Partners', href: '/admin/delivery-partners', icon: 'fa-people-carry-box' },
        { label: 'Admin Team', href: '/admin/team', icon: 'fa-user-shield' },
      ],
    },
    {
      title: 'Engagement',
      items: [
        { label: 'Announcements', href: '/admin/announcements', icon: 'fa-tower-broadcast' },
        { label: 'Support Inbox', href: '/admin/support', icon: 'fa-headset' },
      ],
    },
    {
      title: 'Risk & System',
      items: [
        { label: 'Risk & Fraud', href: '/admin/risk', icon: 'fa-shield-virus' },
        { label: 'Reports', href: '/admin/reports', icon: 'fa-file-invoice' },
        { label: 'System Health', href: '/admin/system/health', icon: 'fa-heart-pulse' },
        { label: 'Audit Log', href: '/admin/system/audit', icon: 'fa-clock-rotate-left' },
        { label: 'Platform Settings', href: '/admin/settings', icon: 'fa-sliders' },
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
          <span className="font-mono text-gray-500">v2.0</span>
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
                          ? 'bg-[#1f5400] text-white shadow-sm font-semibold'
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
                              ? 'bg-white text-[#1f5400]'
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

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

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

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: 'fa-border-all' },
    { label: 'Marketplace', href: '/marketplace', icon: 'fa-briefcase' },
    { label: 'Orders', href: '/admin/orders', icon: 'fa-boxes-packing' },
    { label: 'Inventory', href: '/admin/inventory', icon: 'fa-warehouse' },
    { label: 'Analytics', href: '/admin/analytics', icon: 'fa-chart-pie' },
  ];

  const adminOpsItems = [
    { label: 'User Directory', href: '/admin/users', icon: 'fa-users-gear' },
    { label: 'Logistics & Dispatch', href: '/admin/deliveries', icon: 'fa-truck-fast' },
  ];

  const isLinkActive = (href: string) => {
    if (href === '/admin/dashboard') {
      return pathname === '/admin/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-white flex flex-col h-full border-r border-gray-100 z-10 relative shrink-0">
      {/* Background Graphic */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/15 to-emerald-50/30 pointer-events-none" />

      {/* Logo */}
      <div className="px-6 py-6 flex items-center justify-between relative z-10 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-1 w-6 h-6">
            <div className="w-2.5 h-2.5 rounded-full bg-[#286c00]" />
            <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-800" />
            <div className="w-2.5 h-2.5 rounded-full border-2 border-[#286c00]" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Green<span className="text-[#286c00]">Harvest</span>
          </span>
        </div>
        <span className="text-xs font-bold text-[#286c00] bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-5 overflow-y-auto hide-scrollbar relative z-10 min-h-0 space-y-6">
        <div>
          <span className="px-3 text-xs font-bold text-gray-600 uppercase tracking-wider">
            Management
          </span>
          <ul className="mt-2 space-y-1.5">
            {navItems.map((item) => {
              const active = isLinkActive(item.href);
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm ${
                      active
                        ? 'bg-[#286c00] text-white shadow-md shadow-[#286c00]/25 font-semibold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <i
                        className={`fa-solid ${item.icon} w-5 text-center ${
                          active ? 'text-white' : 'text-gray-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {active && <i className="fa-solid fa-chevron-right text-xs text-white/80" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <span className="px-3 text-xs font-bold text-gray-600 uppercase tracking-wider">
            Platform Ops
          </span>
          <ul className="mt-2 space-y-1.5">
            {adminOpsItems.map((item) => {
              const active = isLinkActive(item.href);
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm ${
                      active
                        ? 'bg-[#286c00] text-white shadow-md shadow-[#286c00]/25 font-semibold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-emerald-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <i
                        className={`fa-solid ${item.icon} w-5 text-center ${
                          active ? 'text-white' : 'text-gray-600'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {active && <i className="fa-solid fa-chevron-right text-xs text-white/80" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* System Status / Logout Box */}
      <div className="p-4 relative z-10 shrink-0 border-t border-gray-100">
        <div className="bg-gradient-to-br from-emerald-50/60 to-white rounded-2xl p-3.5 border border-emerald-100/60 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
              <span className="text-xs font-semibold text-gray-800">Platform Live</span>
            </div>
            <span className="text-xs text-gray-600 font-mono">v1.2</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
          >
            <i className="fa-solid fa-arrow-right-from-bracket" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

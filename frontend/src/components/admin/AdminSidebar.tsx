'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface AdminNavSection {
  id: string;
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

  // Admin user state
  const [adminName, setAdminName] = useState('System Administrator');
  const [adminRole, setAdminRole] = useState('Super Admin');
  const [counts, setCounts] = useState({
    kyc: 0,
    moderation: 0,
    disputes: 0,
    fleetBreaches: 0,
  });

  // Sidebar Collapse State (entire sidebar width: w-64 vs w-20)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Section Accordion Collapse State (which category groups are collapsed)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Active hover item for collapsed tooltip
  const [hoveredItem, setHoveredItem] = useState<{
    label: string;
    section: string;
    badge?: string;
    badgeColor?: string;
    y: number;
  } | null>(null);

  // Initialize collapsed states from localStorage on mount
  useEffect(() => {
    try {
      const savedSidebarCollapsed = localStorage.getItem('gh_admin_sidebar_collapsed');
      if (savedSidebarCollapsed !== null) {
        setIsCollapsed(savedSidebarCollapsed === 'true');
      }

      const savedSections = localStorage.getItem('gh_admin_collapsed_sections');
      if (savedSections) {
        setCollapsedSections(JSON.parse(savedSections));
      }
    } catch {
      // Ignore local storage error
    }
  }, []);

  // Fetch admin profile and real dashboard telemetry counts
  useEffect(() => {
    let isMounted = true;

    const fetchAdminInfo = async () => {
      try {
        const meRes = await api.getAdminMe();
        if (isMounted && meRes?.admin) {
          setAdminName(meRes.admin.name || 'System Administrator');
          const roleDisplay = (meRes.admin.admin_role?.name || meRes.admin.role || 'Admin')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          setAdminRole(roleDisplay);
        }
      } catch {
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem('user');
            if (stored && isMounted) {
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
        if (isMounted && res && res.metrics) {
          setCounts({
            kyc: Number(res.metrics.kyc_pending_count || 0),
            moderation: Number(res.metrics.moderation_pending_count || 0),
            disputes: Number(res.metrics.disputes_open_count || 0),
            fleetBreaches: Number(res.metrics.fleet_breaches_count || 0),
          });
        }
      } catch {
        // Keep fallback 0 on error
      }
    };

    fetchAdminInfo();
    fetchCounts();

    return () => {
      isMounted = false;
    };
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

  const toggleSidebarCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gh_admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem('gh_admin_collapsed_sections', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const navSections: AdminNavSection[] = useMemo(
    () => [
      {
        id: 'telemetry',
        title: 'Command & Telemetry',
        items: [
          { label: 'Overview Dashboard', href: '/admin/dashboard', icon: 'fa-gauge-high' },
          { label: 'Platform Analytics', href: '/admin/analytics', icon: 'fa-chart-line' },
        ],
      },
      {
        id: 'governance',
        title: 'Marketplace Governance',
        items: [
          {
            label: 'Farmer KYC',
            href: '/admin/kyc',
            icon: 'fa-id-card',
            badge: counts.kyc > 0 ? String(counts.kyc) : undefined,
            badgeColor: 'bg-amber-50 text-amber-900 border border-amber-300',
          },
          {
            label: 'Products & Moderation',
            href: '/admin/products',
            icon: 'fa-shield-halved',
            badge: counts.moderation > 0 ? String(counts.moderation) : undefined,
            badgeColor: 'bg-blue-50 text-blue-900 border border-blue-300',
          },
          { label: 'Categories & Attributes', href: '/admin/categories', icon: 'fa-tags' },
          { label: 'Reviews & Ratings', href: '/admin/reviews', icon: 'fa-star-half-stroke' },
          { label: 'Promotional Campaigns', href: '/admin/campaigns', icon: 'fa-bullhorn' },
          { label: 'Price Corridors', href: '/admin/pricing', icon: 'fa-chart-simple' },
        ],
      },
      {
        id: 'commerce',
        title: 'Commerce & Settlement',
        items: [
          { label: 'Orders & Fulfillment', href: '/admin/orders', icon: 'fa-cart-shopping' },
          { label: 'Payments & Ledger', href: '/admin/payments', icon: 'fa-credit-card' },
          { label: 'Escrow Clearinghouse', href: '/admin/escrow', icon: 'fa-money-bill-transfer' },
          {
            label: 'Dispute Arbitration',
            href: '/admin/disputes',
            icon: 'fa-scale-balanced',
            badge: counts.disputes > 0 ? String(counts.disputes) : undefined,
            badgeColor: 'bg-red-50 text-red-900 border border-red-300',
          },
          { label: 'Reverse Returns', href: '/admin/returns', icon: 'fa-arrow-rotate-left' },
        ],
      },
      {
        id: 'logistics',
        title: 'Cold-Chain Logistics',
        items: [
          {
            label: 'Fleet & IoT Telemetry',
            href: '/admin/deliveries',
            icon: 'fa-truck-fast',
            badge: counts.fleetBreaches > 0 ? `${counts.fleetBreaches} Alert` : undefined,
            badgeColor: 'bg-red-50 text-red-900 border border-red-300',
          },
          { label: 'Carrier Partners', href: '/admin/logistics/carriers', icon: 'fa-building-shield' },
          { label: 'Hubs & Depots', href: '/admin/logistics/hubs', icon: 'fa-route' },
          { label: 'Incident Queue', href: '/admin/logistics/incidents', icon: 'fa-triangle-exclamation' },
        ],
      },
      {
        id: 'people',
        title: 'Platform People',
        items: [
          { label: 'User Registry', href: '/admin/users', icon: 'fa-users-gear' },
          { label: 'Admin Team & Roles', href: '/admin/team', icon: 'fa-user-shield' },
        ],
      },
      {
        id: 'engagement',
        title: 'Communications',
        items: [
          { label: 'Broadcast Center', href: '/admin/announcements', icon: 'fa-tower-broadcast' },
          { label: 'Support Queue', href: '/admin/support', icon: 'fa-headset' },
        ],
      },
      {
        id: 'risk',
        title: 'Risk & System Admin',
        items: [
          { label: 'Risk & Fraud Surveillance', href: '/admin/risk', icon: 'fa-shield-virus' },
          { label: 'Reports & CSV Export', href: '/admin/reports', icon: 'fa-file-invoice' },
          { label: 'System Health & Ping', href: '/admin/system/health', icon: 'fa-heart-pulse' },
          { label: 'Immutable Audit Log', href: '/admin/system/audit', icon: 'fa-clock-rotate-left' },
          { label: 'Platform Settings', href: '/admin/settings', icon: 'fa-sliders' },
        ],
      },
    ],
    [counts]
  );

  const isLinkActive = useCallback(
    (href: string) => {
      const cleanHref = href.split('?')[0];
      if (cleanHref === '/admin/dashboard') {
        return pathname === '/admin/dashboard' && (!href.includes('?') || href === pathname);
      }
      return pathname.startsWith(cleanHref);
    },
    [pathname]
  );

  // Auto-expand any section that contains the currently active route
  useEffect(() => {
    navSections.forEach((section) => {
      const hasActive = section.items.some((item) => isLinkActive(item.href));
      if (hasActive && collapsedSections[section.id]) {
        setCollapsedSections((prev) => ({ ...prev, [section.id]: false }));
      }
    });
  }, [pathname, navSections, isLinkActive, collapsedSections]);

  return (
    <aside
      className={`bg-white border-r border-gray-300 flex flex-col h-full z-20 relative shrink-0 transition-all duration-200 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      style={{
        boxShadow: 'none',
      }}
    >
      {/* Sidebar Header: Brand & Collapse Toggle */}
      <div className="px-4 py-4 border-b border-gray-300 bg-white flex items-center justify-between shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Geometric Brand Emblem */}
            <div className="grid grid-cols-2 gap-0.5 w-6 h-6 shrink-0">
              <div className="w-2.5 h-2.5 rounded-none bg-[#1f5400]" />
              <div className="w-2.5 h-2.5 rounded-none border border-gray-800" />
              <div className="w-2.5 h-2.5 rounded-none border border-[#1f5400]" />
              <div className="w-2.5 h-2.5 rounded-none bg-gray-800" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold tracking-tight text-gray-900 block truncate">
                Green<span className="text-[#1f5400]">Harvest</span>
              </span>
              <span className="text-[10px] font-bold text-[#007a6c] uppercase tracking-wider block">
                Operations Console
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid grid-cols-2 gap-0.5 w-6 h-6 shrink-0">
            <div className="w-2.5 h-2.5 rounded-none bg-[#1f5400]" />
            <div className="w-2.5 h-2.5 rounded-none border border-gray-800" />
            <div className="w-2.5 h-2.5 rounded-none border border-[#1f5400]" />
            <div className="w-2.5 h-2.5 rounded-none bg-gray-800" />
          </div>
        )}

        {/* Master Sidebar Collapse/Expand Toggle Button */}
        <button
          onClick={toggleSidebarCollapse}
          title={isCollapsed ? 'Expand Sidebar (Full Navigation)' : 'Collapse Sidebar (Mini View)'}
          aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className={`w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 rounded-none transition-colors shrink-0 ${
            isCollapsed ? 'mx-auto mt-2' : ''
          }`}
        >
          <i
            className={`fa-solid ${
              isCollapsed ? 'fa-angles-right text-xs' : 'fa-angles-left text-xs'
            }`}
          />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto hide-scrollbar space-y-4 min-h-0">
        {navSections.map((section) => {
          const isSectionCollapsed = Boolean(collapsedSections[section.id]);
          const hasActiveItem = section.items.some((item) => isLinkActive(item.href));

          return (
            <div key={section.id} className="space-y-1">
              {/* Section Header: Clickable in expanded view to collapse/expand elements */}
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!isSectionCollapsed}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-left group hover:bg-gray-50 border-b border-transparent hover:border-gray-200 transition-colors"
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                      hasActiveItem ? 'text-[#007a6c]' : 'text-gray-500 group-hover:text-gray-800'
                    }`}
                  >
                    {section.title}
                  </span>
                  <i
                    className={`fa-solid fa-chevron-down text-[10px] text-gray-400 group-hover:text-gray-700 transition-transform duration-200 ${
                      isSectionCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                </button>
              ) : (
                /* Collapsed mode subtle section separator */
                <div className="my-2 border-t border-gray-200 mx-2" title={section.title} />
              )}

              {/* Items List (Collapsible in expanded mode) */}
              {(!isSectionCollapsed || isCollapsed) && (
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isLinkActive(item.href);

                    return (
                      <li key={item.label} className="relative">
                        <Link
                          href={item.href}
                          onMouseEnter={(e) => {
                            if (isCollapsed) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredItem({
                                label: item.label,
                                section: section.title,
                                badge: item.badge,
                                badgeColor: item.badgeColor,
                                y: rect.top,
                              });
                            }
                          }}
                          onMouseLeave={() => {
                            if (isCollapsed) setHoveredItem(null);
                          }}
                          className={`flex items-center text-xs font-medium transition-colors ${
                            isCollapsed
                              ? 'justify-center w-full h-10 px-0'
                              : 'justify-between px-2.5 py-2'
                          } ${
                            active
                              ? 'bg-[#1f5400] text-white font-bold rounded-none'
                              : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100/80 rounded-none'
                          }`}
                        >
                          <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}>
                            <i
                              className={`fa-solid ${item.icon} text-xs w-4 text-center shrink-0 ${
                                active ? 'text-white' : 'text-gray-500'
                              }`}
                            />
                            {!isCollapsed && (
                              <span className="truncate text-xs">{item.label}</span>
                            )}
                          </div>

                          {/* Badge indicator in Expanded View */}
                          {!isCollapsed && item.badge && (
                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.2 rounded-none tabular-nums border shrink-0 ${
                                active
                                  ? 'bg-white text-[#1f5400] border-white'
                                  : item.badgeColor || 'bg-gray-100 text-gray-700 border-gray-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}

                          {/* Dot indicator in Collapsed View when badge is present */}
                          {isCollapsed && item.badge && (
                            <span className="absolute top-2 right-3 w-2 h-2 rounded-none bg-red-600 ring-2 ring-white" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Floating Tooltip for Collapsed Sidebar Navigation */}
      {isCollapsed && hoveredItem && (
        <div
          className="fixed left-20 z-50 ml-1.5 bg-white border border-gray-300 shadow-md rounded-none px-3 py-1.5 text-xs pointer-events-none whitespace-nowrap animate-in fade-in duration-100"
          style={{ top: hoveredItem.y }}
        >
          <div className="font-bold text-gray-900 flex items-center gap-2">
            <span>{hoveredItem.label}</span>
            {hoveredItem.badge && (
              <span
                className={`text-[10px] font-bold px-1 py-0.2 rounded-none border tabular-nums ${
                  hoveredItem.badgeColor || 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
              >
                {hoveredItem.badge}
              </span>
            )}
          </div>
          <div className="text-[10px] uppercase font-bold text-[#007a6c] tracking-wider mt-0.5">
            {hoveredItem.section}
          </div>
        </div>
      )}

      {/* User Session & Logout Footer */}
      <div className="p-3 border-t border-gray-300 bg-[#FCF9F8] shrink-0">
        {!isCollapsed ? (
          <div className="bg-white border border-gray-300 rounded-none p-3 space-y-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-none bg-emerald-100 text-[#1f5400] border border-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                <i className="fa-solid fa-user-shield text-xs" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">{adminName}</p>
                <p className="text-[11px] text-gray-500 font-medium truncate">{adminRole}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              aria-label="Sign out of administrative session"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-none transition-colors"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-none bg-emerald-100 text-[#1f5400] border border-emerald-300 flex items-center justify-center font-bold text-xs"
              title={`${adminName} (${adminRole})`}
            >
              <i className="fa-solid fa-user-shield text-xs" />
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="w-8 h-8 flex items-center justify-center text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-none transition-colors"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

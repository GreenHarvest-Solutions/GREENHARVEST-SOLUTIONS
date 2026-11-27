'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFarmerContext } from '@/contexts/FarmerContext';
import { api } from '@/lib/api';

export default function FarmerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { dashboardData } = useFarmerContext();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const pendingShipments = dashboardData?.pending_shipments?.length || 0;
  const totalOrdersReceived = dashboardData?.summary?.total_orders_received || 0;

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Continue
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
      router.push('/login');
    }
  };

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-white border-r border-gray-300 flex flex-col h-full shrink-0 z-30 transition-all duration-200 ease-in-out`}
    >
      {/* Header: Brand & Collapse Toggle (Admin-Inspired Lined Architecture) */}
      <div className="px-4 py-4 border-b border-gray-300 bg-white flex items-center justify-between shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-[#1f5400] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[19px]">agriculture</span>
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold tracking-tight text-gray-900 block truncate">
                Green<span className="text-[#1f5400]">Harvest</span>
              </span>
              <span className="text-[10px] font-bold text-[#007a6c] uppercase tracking-wider block">
                Seller Center
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-8 h-8 bg-[#1f5400] flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[19px]">agriculture</span>
          </div>
        )}

        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 rounded-none transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">keyboard_double_arrow_left</span>
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="px-2 py-2 border-b border-gray-200 flex justify-center">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            title="Expand Sidebar"
            aria-label="Expand Sidebar"
            className="w-8 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 rounded-none transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">keyboard_double_arrow_right</span>
          </button>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className={`flex-1 overflow-y-auto custom-scrollbar py-3 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <div
          className={`mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${
            isCollapsed ? 'text-center px-0' : 'px-2'
          }`}
        >
          {isCollapsed ? '•••' : 'Main Menu'}
        </div>

        <NavItem
          href="/farmer/dashboard"
          icon="dashboard"
          label="Dashboard"
          isActive={pathname === '/farmer/dashboard'}
          isCollapsed={isCollapsed}
        />

        <NavGroup
          icon="inventory_2"
          label="Products"
          activePaths={['/farmer/products', '/farmer/products/new']}
          pathname={pathname}
          isCollapsed={isCollapsed}
          onExpand={() => setIsCollapsed(false)}
        >
          <SubNavItem
            href="/farmer/products"
            label="Manage Products"
            isActive={pathname === '/farmer/products' || pathname.startsWith('/farmer/products/edit')}
          />
          <SubNavItem
            href="/farmer/products/new"
            label="Add New Product"
            isActive={pathname === '/farmer/products/new'}
          />
        </NavGroup>

        <NavGroup
          icon="receipt_long"
          label="Orders"
          activePaths={['/farmer/orders', '/farmer/shipping', '/farmer/returns']}
          pathname={pathname}
          isCollapsed={isCollapsed}
          onExpand={() => setIsCollapsed(false)}
        >
          <SubNavItem
            href="/farmer/orders"
            label="All Orders"
            isActive={pathname === '/farmer/orders'}
            badge={totalOrdersReceived}
          />
          <SubNavItem
            href="/farmer/shipping"
            label="Shipping"
            isActive={pathname === '/farmer/shipping'}
            badge={pendingShipments > 0 ? pendingShipments : undefined}
          />
          <SubNavItem
            href="/farmer/returns"
            label="Returns"
            isActive={pathname === '/farmer/returns'}
          />
        </NavGroup>

        <NavGroup
          icon="campaign"
          label="Marketing"
          activePaths={['/farmer/campaigns', '/farmer/store']}
          pathname={pathname}
          isCollapsed={isCollapsed}
          onExpand={() => setIsCollapsed(false)}
        >
          <SubNavItem
            href="/farmer/campaigns"
            label="Campaigns"
            isActive={pathname === '/farmer/campaigns'}
          />
          <SubNavItem
            href="/farmer/store"
            label="Store Decoration"
            isActive={pathname === '/farmer/store'}
          />
        </NavGroup>

        <NavGroup
          icon="bar_chart"
          label="Analytics"
          activePaths={['/farmer/advisor', '/farmer/market']}
          pathname={pathname}
          isCollapsed={isCollapsed}
          onExpand={() => setIsCollapsed(false)}
        >
          <SubNavItem
            href="/farmer/advisor"
            label="Business Advisor"
            isActive={pathname === '/farmer/advisor'}
          />
          <SubNavItem
            href="/farmer/market"
            label="Market Insights"
            isActive={pathname === '/farmer/market'}
          />
        </NavGroup>

        <div
          className={`mt-4 pt-3 border-t border-gray-200 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${
            isCollapsed ? 'text-center px-0' : 'px-2'
          }`}
        >
          {isCollapsed ? '•••' : 'Farm Center'}
        </div>

        <NavItem
          href="/farmer/verification"
          icon="verified_user"
          label="Verification Center"
          isActive={pathname === '/farmer/verification'}
          isCollapsed={isCollapsed}
        />

        <NavItem
          href="/farmer/profile"
          icon="badge"
          label="Farm Profile & KYC"
          isActive={pathname === '/farmer/profile'}
          isCollapsed={isCollapsed}
        />
      </nav>

      {/* Footer Actions */}
      <div className="mt-auto border-t border-gray-300 p-3 bg-white shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center py-2 text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-none transition-colors text-xs font-bold ${
            isCollapsed ? 'justify-center px-0' : 'px-3'
          }`}
          title="Sign Out of Seller Center"
        >
          <span className="material-symbols-outlined text-[18px] shrink-0">logout</span>
          {!isCollapsed && <span className="ml-2.5">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  isActive,
  isCollapsed,
}: {
  href: string;
  icon: string;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={`flex items-center py-2.5 mb-0.5 rounded-none transition-colors relative text-xs ${
        isActive
          ? 'bg-[#1f5400] text-white font-bold'
          : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-950 font-medium'
      } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
    >
      <span
        className={`material-symbols-outlined text-[19px] shrink-0 ${
          isCollapsed ? '' : 'mr-2.5'
        } ${isActive ? 'text-white' : 'text-gray-500'}`}
      >
        {icon}
      </span>
      {!isCollapsed && <span className="whitespace-nowrap overflow-hidden truncate">{label}</span>}
    </Link>
  );
}

function NavGroup({
  icon,
  label,
  children,
  activePaths,
  pathname,
  isCollapsed,
  onExpand,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
  activePaths: string[];
  pathname: string;
  isCollapsed: boolean;
  onExpand: () => void;
}) {
  const isChildActive = activePaths.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );
  const [isOpen, setIsOpen] = useState(isChildActive);

  const handleClick = () => {
    if (isCollapsed) {
      onExpand();
      setIsOpen(true);
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={handleClick}
        title={isCollapsed ? label : undefined}
        className={`w-full flex items-center py-2.5 rounded-none transition-colors relative text-xs ${
          isChildActive
            ? 'text-[#007a6c] font-bold bg-gray-50'
            : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-950 font-medium'
        } ${isCollapsed ? 'justify-center px-0' : 'px-3 justify-between'}`}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <span
            className={`material-symbols-outlined text-[19px] shrink-0 ${
              isChildActive ? 'text-[#007a6c]' : 'text-gray-500'
            } ${isCollapsed ? '' : 'mr-2.5'}`}
          >
            {icon}
          </span>
          {!isCollapsed && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
        </div>
        {!isCollapsed && (
          <span
            className="material-symbols-outlined text-[16px] text-gray-400 transition-transform duration-200 shrink-0"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        )}
      </button>

      {/* Sub items */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen && !isCollapsed ? 'max-h-64 opacity-100 mt-0.5' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="ml-[20px] pl-3 border-l border-gray-300 flex flex-col gap-0.5 py-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}

function SubNavItem({
  href,
  label,
  badge,
  isActive,
}: {
  href: string;
  label: string;
  badge?: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <Link href={href} className="group flex items-center justify-between relative">
      <div
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-none transition-colors text-xs ${
          isActive
            ? 'bg-emerald-50 text-[#1f5400] font-bold border-l-2 border-[#1f5400]'
            : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100/70'
        }`}
      >
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
        {badge !== undefined && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-none tabular-nums border shrink-0 ml-2 ${
              isActive
                ? 'bg-white text-[#1f5400] border-[#1f5400]'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

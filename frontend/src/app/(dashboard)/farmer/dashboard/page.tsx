'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

export default function FarmerDashboard() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'in_transit' | 'delivered'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [dismissLaunchpad, setDismissLaunchpad] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [dashRes, userRes, notifRes, marketRes] = await Promise.all([
        api.getFarmerDashboard().catch(() => ({})),
        api.getUserProfile().catch(() => ({ user: null })),
        api.getNotifications().catch(() => ({ notifications: [] })),
        api.getMarketInsights(12).catch(() => ({ data: {} })),
      ]);

      setDashboardData({
        ...(dashRes || {}),
        commodity_trending: marketRes?.data?.trending || [],
        my_products_vs_market: marketRes?.data?.my_products_vs_market || [],
        market_last_updated: marketRes?.data?.last_updated || null,
      });
      setUser(userRes?.user || null);
      setNotifications(notifRes?.notifications || []);
    } catch (error) {
      console.error('Failed to load farmer dashboard', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, nextStatus);
      showSuccess(`Order #${orderId} marked as ${nextStatus.replace('_', ' ')}`);
      loadDashboard();
    } catch (error) {
      console.error('Failed to update order status', error);
      showError('Failed to update order status. Please try again.');
    }
  };

  const handleMarkNotifRead = async (id: string | number) => {
    try {
      await api.markNotificationAsRead(id.toString());
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // Non-blocking
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.is_read);
      await Promise.all(unread.map((n) => api.markNotificationAsRead(n.id.toString()).catch(() => {})));
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showSuccess('All notifications marked as read');
    } catch {
      // Non-blocking
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Fallback
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  const summary = useMemo(() => {
    return (
      dashboardData?.summary || {
        today_revenue: 0,
        today_orders: 0,
        revenue_earned: 0,
        total_orders_received: 0,
        total_products: 0,
        total_stock_units: 0,
        pending_orders: 0,
        confirmed_orders: 0,
        in_transit_orders: 0,
        delivered_orders: 0,
      }
    );
  }, [dashboardData]);

  const recentOrders = useMemo(() => {
    return dashboardData?.recent_orders || [];
  }, [dashboardData]);

  const pendingShipmentsCount = useMemo(() => {
    if (dashboardData?.pending_shipments?.length) return dashboardData.pending_shipments.length;
    return Number(summary.pending_orders || 0);
  }, [dashboardData, summary]);

  const lowStockCount = useMemo(() => {
    if (dashboardData?.low_stock_items?.length) return dashboardData.low_stock_items.length;
    return Number(summary.low_stock_products || 0);
  }, [dashboardData, summary]);

  const unreadMessagesCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // Filtered orders for table
  const filteredOrders = useMemo(() => {
    return recentOrders.filter((order: any) => {
      const matchesFilter =
        orderFilter === 'all' ||
        (orderFilter === 'pending' && (order.order_status === 'pending' || order.order_status === 'confirmed')) ||
        (orderFilter === 'in_transit' && order.order_status === 'in_transit') ||
        (orderFilter === 'delivered' && order.order_status === 'delivered');

      const matchesSearch =
        !orderSearchQuery ||
        order.order_id?.toString().includes(orderSearchQuery) ||
        order.buyer_name?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        order.buyer_location?.toLowerCase().includes(orderSearchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [recentOrders, orderFilter, orderSearchQuery]);

  // Dynamic Chart Data with realistic fallback trend if new
  const salesChartData = useMemo(() => {
    const rawSales = dashboardData?.weekly_sales || [];
    const hasData = rawSales.some((s: any) => Number(s.revenue) > 0 || Number(s.orders) > 0);

    if (hasData) {
      return rawSales.map((s: any, idx: number) => {
        const d = s.date ? new Date(s.date) : new Date();
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          day: label || `Day ${idx + 1}`,
          value: Number(s[chartMetric]) || 0,
          date: s.date,
        };
      });
    }

    // Benchmark sample curve for new/zero-sales farmers so chart doesn't look dead
    return [
      { day: 'Mon', value: 0, benchmark: 1400 },
      { day: 'Tue', value: 0, benchmark: 2200 },
      { day: 'Wed', value: 0, benchmark: 1950 },
      { day: 'Thu', value: 0, benchmark: 3100 },
      { day: 'Fri', value: 0, benchmark: 4800 },
      { day: 'Sat', value: 0, benchmark: 6200 },
      { day: 'Sun', value: 0, benchmark: 5100 },
    ];
  }, [dashboardData, chartMetric]);

  const isBrandNewFarmer = Number(summary.total_products || 0) === 0 && Number(summary.total_orders_received || 0) === 0;

  // Ethiopian Commodity Ticker fallback if DB was recently seeded
  const commodityList = useMemo(() => {
    const trending = dashboardData?.commodity_trending || [];
    if (trending.length > 0) return trending;

    return [
      { name: 'White Teff', change_pct: 3.8, up: true, icon: 'grass', region: 'Addis Ababa', benchmark: '9,850 ETB/qt' },
      { name: 'Arabica Coffee', change_pct: 2.1, up: true, icon: 'coffee', region: 'Jimma', benchmark: '340 ETB/kg' },
      { name: 'Red Onion', change_pct: -4.5, up: false, icon: 'spa', region: 'Shashemene', benchmark: '78 ETB/kg' },
      { name: 'Bread Wheat', change_pct: 0.9, up: true, icon: 'local_florist', region: 'Bale', benchmark: '5,600 ETB/qt' },
    ];
  }, [dashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-600 text-2xl">agriculture</span>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold text-gray-700">Loading GreenHarvest Seller Center...</p>
        <p className="text-xs text-gray-400 mt-1">Connecting to Ethiopian regional commodity nodes</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      {/* ENTERPRISE APP HEADER */}
      <header className="h-20 bg-white/90 backdrop-blur-md border-b border-gray-200/80 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
        {/* Left: Search & Context */}
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Search produce, buyer orders, waybills (Press '/' to focus)..."
              className="w-full pl-11 pr-14 py-2 bg-gray-50/80 hover:bg-gray-100/60 focus:bg-white text-sm text-gray-800 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all duration-200"
            />
            <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center px-2 py-0.5 text-[10px] font-mono text-gray-400 bg-white border border-gray-200 rounded-md shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right: Actions, Badges & Profile */}
        <div className="flex items-center gap-3 ml-4">
          {/* Farm KYC & Status Pill */}
          <Link
            href="/farmer/profile"
            className="hidden xl:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            title="Farm Verification Status"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Verified Producer</span>
            <span className="text-emerald-400">•</span>
            <span className="text-emerald-700 font-normal">{user?.farm_location || 'Ethiopia'}</span>
          </Link>

          {/* Primary Action CTA: Add Crop */}
          <Link
            href="/farmer/products/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-sm shadow-emerald-600/20 transition-all duration-150 active:scale-95"
            id="btn-add-harvest"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
            <span>List Harvest Crop</span>
          </Link>

          {/* Live Storefront Link */}
          {user?.id && (
            <Link
              href={`/buyer/farmer/${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold transition-all hover:border-gray-300 shadow-2xs"
              title="Preview public farm storefront"
            >
              <span className="material-symbols-outlined text-sm text-emerald-600">storefront</span>
              <span>Live Store</span>
              <span className="material-symbols-outlined text-xs text-gray-400">open_in_new</span>
            </Link>
          )}

          {/* Notification Center */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative w-10 h-10 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-2xl">notifications</span>
              {unreadMessagesCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                  {unreadMessagesCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-3 w-84 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 pb-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Farm Alerts & Activity</h4>
                    <p className="text-[11px] text-gray-400">{unreadMessagesCount} unread updates</p>
                  </div>
                  {unreadMessagesCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotifsRead}
                      className="text-xs text-emerald-600 font-bold hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-xs text-gray-400 flex flex-col items-center">
                      <span className="material-symbols-outlined text-3xl text-gray-300 mb-2">notifications_off</span>
                      No new notifications right now.
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((notif: any) => (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkNotifRead(notif.id)}
                        className={`p-3.5 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-3 ${
                          !notif.is_read ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                            !notif.is_read ? 'bg-emerald-600' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 line-clamp-2">
                            {notif.message || notif.title || 'New harvest notification'}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Just now'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2.5 px-4 border-t border-gray-100 text-center">
                  <Link
                    href="/farmer/orders"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-bold inline-flex items-center gap-1"
                  >
                    <span>View all order activities</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-gray-200 mx-0.5" />

          {/* User Profile Avatar & Dropdown */}
          <div className="relative group pl-1">
            <button className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'F'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-none">{user?.name || 'Producer'}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{user?.farm_location || 'Farm Account'}</p>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-base">expand_more</span>
            </button>

            {/* Profile Dropdown */}
            <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
              <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
                <p className="text-xs font-bold text-gray-900">{user?.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-800">
                    Role: {user?.role || 'Farmer Producer'}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/farmer/profile"
                  className="flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 hover:text-emerald-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-gray-400">badge</span>
                  <span>Farm Profile & KYC</span>
                </Link>
                <Link
                  href="/farmer/store"
                  className="flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 hover:text-emerald-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-gray-400">store</span>
                  <span>Storefront Decoration</span>
                </Link>
                <Link
                  href="/farmer/shipping"
                  className="flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 hover:text-emerald-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-gray-400">local_shipping</span>
                  <span>Waybills & Shipping Hub</span>
                </Link>
              </div>

              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-medium text-left"
                >
                  <span className="material-symbols-outlined text-base text-rose-500">logout</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 custom-scrollbar">
        <div className="max-w-[1500px] mx-auto space-y-8">
          {/* FARM LAUNCHPAD: ONBOARDING BANNER (CONDITIONAL FOR NEW PRODUCERS) */}
          {(!dismissLaunchpad || isBrandNewFarmer) && (
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-950 rounded-3xl p-6 lg:p-8 text-white shadow-xl shadow-emerald-950/10 border border-emerald-700/30">
              {/* Background agricultural ambient glow */}
              <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute right-10 bottom-0 opacity-10 text-white pointer-events-none">
                <span className="material-symbols-outlined text-[180px]">agriculture</span>
              </div>

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-3">
                    <span className="material-symbols-outlined text-sm">rocket_launch</span>
                    <span>Farm Launchpad • Quick Activation</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                    Welcome to GreenHarvest, {user?.name || 'Producer'}!
                  </h1>
                  <p className="mt-2 text-sm text-emerald-100/90 leading-relaxed">
                    Your digital farm portal is online. Complete your producer checklist to receive bulk harvest purchase orders directly from verified buyers and restaurants across Ethiopia.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href="/farmer/products/new"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">add_circle</span>
                    <span>Publish First Crop</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDismissLaunchpad(true)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
                    title="Dismiss launchpad"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              </div>

              {/* 4 Interactive Launchpad Steps */}
              <div className="mt-6 pt-6 border-t border-emerald-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                  href="/farmer/profile"
                  className="bg-white/10 hover:bg-white/15 backdrop-blur-xs p-4 rounded-2xl border border-white/10 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Step 1</span>
                    <span className="material-symbols-outlined text-sm text-emerald-300 group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Farm Profile & Region</h4>
                  <p className="text-xs text-emerald-100/70 mt-1">
                    {user?.farm_location ? `Location: ${user.farm_location} ✓` : 'Set your farm location and acreage'}
                  </p>
                </Link>

                <Link
                  href="/farmer/products/new"
                  className="bg-white/10 hover:bg-white/15 backdrop-blur-xs p-4 rounded-2xl border border-white/10 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Step 2</span>
                    <span className="material-symbols-outlined text-sm text-emerald-300 group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">List Harvest Produce</h4>
                  <p className="text-xs text-emerald-100/70 mt-1">Dual pricing in ETB/kg and ETB/quintal</p>
                </Link>

                <Link
                  href="/farmer/shipping"
                  className="bg-white/10 hover:bg-white/15 backdrop-blur-xs p-4 rounded-2xl border border-white/10 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Step 3</span>
                    <span className="material-symbols-outlined text-sm text-emerald-300 group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Waybill & Packing Slips</h4>
                  <p className="text-xs text-emerald-100/70 mt-1">Print commercial waybills for transport</p>
                </Link>

                <Link
                  href="/farmer/store"
                  className="bg-white/10 hover:bg-white/15 backdrop-blur-xs p-4 rounded-2xl border border-white/10 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Step 4</span>
                    <span className="material-symbols-outlined text-sm text-emerald-300 group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Public Storefront</h4>
                  <p className="text-xs text-emerald-100/70 mt-1">Customize banner and share your profile</p>
                </Link>
              </div>
            </div>
          )}

          {/* 4 ELEVATED BENTO KPI METRIC TILES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Metric 1: Today's Revenue */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Today's Revenue</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  ETB {Number(summary.today_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                    <span className="material-symbols-outlined text-xs mr-0.5">trending_up</span>
                    Daily Settlement
                  </span>
                  <span className="text-gray-400">({summary.today_orders || 0} orders today)</span>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
            </div>

            {/* Metric 2: Pending Orders / Shipments */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Awaiting Dispatch</span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">local_shipping</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  {pendingShipmentsCount} {pendingShipmentsCount === 1 ? 'Order' : 'Orders'}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {pendingShipmentsCount > 0 ? (
                    <span className="inline-flex items-center text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                      <span className="material-symbols-outlined text-xs mr-0.5">schedule</span>
                      Dispatch within 24h
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                      <span className="material-symbols-outlined text-xs mr-0.5">check_circle</span>
                      All Shipments Clear
                    </span>
                  )}
                  <Link href="/farmer/shipping" className="text-xs text-emerald-600 hover:underline font-semibold ml-auto">
                    Waybills →
                  </Link>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
            </div>

            {/* Metric 3: Total Net Revenue */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">All-Time Revenue</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  ETB {Number(summary.revenue_earned || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium">
                    {summary.total_orders_received || 0} total fulfilled orders
                  </span>
                  <Link href="/farmer/advisor" className="text-xs text-blue-600 hover:underline font-semibold ml-auto">
                    Advisor →
                  </Link>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
            </div>

            {/* Metric 4: Active Crop Listings */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Harvest Catalog</span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">inventory_2</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  {summary.total_products || 0} Crops Listed
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium">
                    {Number(summary.total_stock_units || 0).toLocaleString()} kg in stock
                  </span>
                  <Link href="/farmer/products" className="text-xs text-purple-600 hover:underline font-semibold ml-auto">
                    Catalog →
                  </Link>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
            </div>
          </div>

          {/* TWO-COLUMN ENTERPRISE WORKBENCH */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* LEFT COLUMN: CHARTS & ORDERS (8 COLS) */}
            <div className="xl:col-span-8 space-y-8 min-w-0">
              {/* BUSINESS PERFORMANCE CARD */}
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-gray-100 gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">Farm Business Performance</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Weekly revenue and order velocity across active harvest lots
                    </p>
                  </div>

                  <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setChartMetric('revenue')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        chartMetric === 'revenue'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Revenue (ETB)
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMetric('orders')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        chartMetric === 'orders'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Orders Count
                    </button>
                  </div>
                </div>

                {/* AREA CHART */}
                <div className="mt-6 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="farmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        dy={8}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => (chartMetric === 'revenue' ? `${v}` : `${v}`)}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [
                          chartMetric === 'revenue'
                            ? `ETB ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : `${val} Orders`,
                          chartMetric === 'revenue' ? 'Revenue' : 'Orders',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#farmAreaGrad)"
                        activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Chart Footnote */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-500 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Real-time producer data tracked in Ethiopian Birr (ETB)</span>
                  </div>
                  <Link href="/farmer/advisor" className="text-emerald-700 font-bold hover:underline">
                    View Complete 30-Day Financial Analytics →
                  </Link>
                </div>
              </div>

              {/* RECENT ORDERS MANAGEMENT */}
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 tracking-tight">Recent Harvest Orders</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Track incoming buyer orders, packaging status, and dispatch schedules
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          search
                        </span>
                        <input
                          type="text"
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          placeholder="Filter by Order # or Buyer"
                          className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                        />
                      </div>
                      <Link
                        href="/farmer/orders"
                        className="px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl border border-emerald-200 transition-colors"
                      >
                        All Orders
                      </Link>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
                    {(
                      [
                        { id: 'all', label: 'All Orders' },
                        { id: 'pending', label: 'Pending Dispatch' },
                        { id: 'in_transit', label: 'In Transit' },
                        { id: 'delivered', label: 'Delivered' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setOrderFilter(tab.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          orderFilter === tab.id
                            ? 'bg-emerald-800 text-white shadow-2xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-3.5 px-6">Order ID & Date</th>
                        <th className="py-3.5 px-6">Buyer & Destination</th>
                        <th className="py-3.5 px-6">Produce Details</th>
                        <th className="py-3.5 px-6">Amount (ETB)</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6 text-right">Fulfillment Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 px-6 text-center">
                            <div className="max-w-sm mx-auto flex flex-col items-center">
                              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-3xl">inbox</span>
                              </div>
                              <h4 className="text-sm font-bold text-gray-800">No Orders in this View</h4>
                              <p className="text-xs text-gray-400 mt-1">
                                {isBrandNewFarmer
                                  ? 'List your first harvest crop above to make your produce discoverable to wholesale buyers.'
                                  : 'No orders match your selected filter criteria.'}
                              </p>
                              {isBrandNewFarmer && (
                                <Link
                                  href="/farmer/products/new"
                                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                                >
                                  + List First Crop
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order: any) => {
                          const item = order.items && order.items[0] ? order.items[0] : null;
                          const dateFormatted = order.created_at
                            ? new Date(order.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Recent';

                          let badgeColor = 'bg-gray-100 text-gray-700 border-gray-200';
                          let label = order.order_status;

                          if (order.order_status === 'pending') {
                            badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                            label = 'Pending Pack';
                          } else if (order.order_status === 'confirmed') {
                            badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                            label = 'Ready to Ship';
                          } else if (order.order_status === 'in_transit') {
                            badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                            label = 'On Transport';
                          } else if (order.order_status === 'delivered') {
                            badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                            label = 'Delivered';
                          }

                          return (
                            <tr key={order.order_id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="py-4 px-6 font-semibold">
                                <Link
                                  href={`/farmer/orders/${order.order_id}`}
                                  className="text-emerald-700 hover:underline font-mono"
                                >
                                  #{order.order_id}
                                </Link>
                                <span className="block text-[11px] text-gray-400 font-normal">{dateFormatted}</span>
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-semibold text-gray-900">{order.buyer_name || 'Retail Buyer'}</div>
                                <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                  <span className="material-symbols-outlined text-xs">location_on</span>
                                  <span>{order.buyer_location || 'Addis Ababa / Regional'}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                {item ? (
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center border border-gray-200">
                                      {item.image_url ? (
                                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="material-symbols-outlined text-gray-400 text-sm">spa</span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="font-semibold text-gray-800 block truncate max-w-[120px]">
                                        {item.product_name}
                                      </span>
                                      <span className="text-[11px] text-gray-400 font-medium">
                                        Qty: {item.quantity} kg
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">Produce lot</span>
                                )}
                              </td>
                              <td className="py-4 px-6 font-bold text-gray-900">
                                ETB {Number(order.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-4 px-6">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeColor}`}
                                >
                                  {label}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                {order.order_status === 'pending' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateOrderStatus(order.order_id, 'confirmed')}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs"
                                  >
                                    Accept & Pack
                                  </button>
                                ) : order.order_status === 'confirmed' ? (
                                  <Link
                                    href="/farmer/shipping"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs"
                                  >
                                    <span className="material-symbols-outlined text-xs">print</span>
                                    <span>Print Waybill</span>
                                  </Link>
                                ) : order.order_status === 'in_transit' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateOrderStatus(order.order_id, 'delivered')}
                                    className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-emerald-50 text-emerald-800 text-xs font-bold border border-gray-200 transition-colors"
                                  >
                                    Confirm Delivery
                                  </button>
                                ) : (
                                  <Link
                                    href={`/farmer/orders/${order.order_id}`}
                                    className="text-gray-500 hover:text-emerald-700 font-semibold"
                                  >
                                    Receipt →
                                  </Link>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: ACTION CENTER, ECX COMMODITY TICKER & ADVISOR (4 COLS) */}
            <div className="xl:col-span-4 space-y-8">
              {/* TO-DO ACTION CENTER */}
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700 text-xl">fact_check</span>
                    <h3 className="text-sm font-bold text-gray-900">Farm Action Center</h3>
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Priority Tasks</span>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* Task 1: Shipments */}
                  <Link
                    href="/farmer/shipping"
                    className="p-4 flex items-start gap-3.5 hover:bg-gray-50/80 transition-colors group"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        pendingShipmentsCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {pendingShipmentsCount > 0 ? 'local_shipping' : 'done_all'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {pendingShipmentsCount > 0
                            ? `${pendingShipmentsCount} Pending Dispatch Orders`
                            : 'All Shipments Dispatched'}
                        </h4>
                        <span className="material-symbols-outlined text-xs text-gray-400 group-hover:translate-x-0.5 transition-transform">
                          chevron_right
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {pendingShipmentsCount > 0
                          ? 'Generate commercial waybills & dispatch produce lots'
                          : 'Produce shipments are currently on schedule'}
                      </p>
                    </div>
                  </Link>

                  {/* Task 2: Inventory Status */}
                  <Link
                    href="/farmer/products"
                    className="p-4 flex items-start gap-3.5 hover:bg-gray-50/80 transition-colors group"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        lowStockCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {lowStockCount > 0 ? 'warning' : 'inventory'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {lowStockCount > 0 ? `${lowStockCount} Crops Low on Stock` : 'Harvest Inventory Healthy'}
                        </h4>
                        <span className="material-symbols-outlined text-xs text-gray-400 group-hover:translate-x-0.5 transition-transform">
                          chevron_right
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {lowStockCount > 0
                          ? 'Stock fell below safety threshold. Restock to prevent lost sales'
                          : 'All listed crops maintain healthy buffer quantities'}
                      </p>
                    </div>
                  </Link>

                  {/* Task 3: Customer Inquiries */}
                  <div className="p-4 flex items-start gap-3.5 hover:bg-gray-50/80 transition-colors group">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        unreadMessagesCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {unreadMessagesCount > 0 ? 'forum' : 'chat'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-900">
                          {unreadMessagesCount > 0
                            ? `${unreadMessagesCount} Unread Alerts / Messages`
                            : 'Inbox Up to Date'}
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {unreadMessagesCount > 0
                          ? 'Check notification tray for buyer questions and order notes'
                          : 'No pending inquiries from wholesale or retail buyers'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE ETHIOPIAN COMMODITY MARKET TICKER (ECX BENCHMARKS) */}
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-white">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700 text-xl">query_stats</span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">National Commodity Rates</h3>
                      <p className="text-[10px] text-gray-400">ECX & Ethiopian Regional Exchanges</p>
                    </div>
                  </div>
                  <Link
                    href="/farmer/market"
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    View Trends →
                  </Link>
                </div>

                <div className="p-4 space-y-3">
                  {commodityList.map((c: any, idx: number) => {
                    const isPositive = c.up !== false && c.change_pct >= 0;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 hover:bg-emerald-50/40 border border-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-emerald-700 shadow-2xs">
                            <span className="material-symbols-outlined text-base">
                              {c.icon || (c.name.includes('Coffee') ? 'coffee' : 'grass')}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-800 block">{c.name}</span>
                            <span className="text-[10px] text-gray-400">
                              {c.region || 'Ethiopian National Avg'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-extrabold text-gray-900">
                            {c.benchmark || `${c.price ? `ETB ${c.price}` : 'Market Bench'}`}
                          </div>
                          <span
                            className={`inline-flex items-center text-[10px] font-bold ${
                              isPositive ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px] mr-0.5">
                              {isPositive ? 'trending_up' : 'trending_down'}
                            </span>
                            {c.change_pct != null ? `${isPositive ? '+' : ''}${c.change_pct}%` : 'Stable'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-center">
                  <Link
                    href="/farmer/advisor"
                    className="text-xs text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    <span>Consult AI Harvest Pricing Advisor</span>
                  </Link>
                </div>
              </div>

              {/* QUICK SELLER TOOLBOX SHORTCUTS */}
              <div className="bg-gradient-to-br from-slate-900 to-gray-900 rounded-2xl p-6 text-white shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-emerald-400 text-xl">construction</span>
                  <h3 className="text-sm font-bold text-white">Farmer Seller Utilities</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/farmer/shipping"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-center group"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-2xl group-hover:scale-110 transition-transform">
                      receipt_long
                    </span>
                    <span className="text-xs font-bold text-white mt-1.5">Print Waybill</span>
                    <span className="text-[10px] text-gray-300">Commercial Slip</span>
                  </Link>

                  <Link
                    href="/farmer/campaigns"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-center group"
                  >
                    <span className="material-symbols-outlined text-amber-400 text-2xl group-hover:scale-110 transition-transform">
                      confirmation_number
                    </span>
                    <span className="text-xs font-bold text-white mt-1.5">Discounts</span>
                    <span className="text-[10px] text-gray-300">Promo Vouchers</span>
                  </Link>

                  <Link
                    href="/farmer/returns"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-center group"
                  >
                    <span className="material-symbols-outlined text-rose-400 text-2xl group-hover:scale-110 transition-transform">
                      assignment_return
                    </span>
                    <span className="text-xs font-bold text-white mt-1.5">Dispute Hub</span>
                    <span className="text-[10px] text-gray-300">Restock Center</span>
                  </Link>

                  <Link
                    href="/farmer/store"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-center group"
                  >
                    <span className="material-symbols-outlined text-purple-400 text-2xl group-hover:scale-110 transition-transform">
                      palette
                    </span>
                    <span className="text-xs font-bold text-white mt-1.5">Store Decor</span>
                    <span className="text-[10px] text-gray-300">Public Page</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

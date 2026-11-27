'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  SellerMetricStrip,
  SellerMetricCard,
  SellerDonutCard,
  type SellerDonutSegment,
} from '@/components/farmer/SellerCards';

const CATEGORY_COLORS = ['#1f5400', '#007a6c', '#10B981', '#F59E0B', '#3B82F6'];

export default function FarmerDashboard() {
  const router = useRouter();
  const { showSuccess } = useToast();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [isNotifOpen, setIsNotifOpen] = useState(false);

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
      await Promise.all(
        unread.map((n) => api.markNotificationAsRead(n.id.toString()).catch(() => {}))
      );
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
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
        low_stock_products: 0,
        out_of_stock_products: 0,
        pending_orders: 0,
        confirmed_orders: 0,
        in_transit_orders: 0,
        delivered_orders: 0,
      }
    );
  }, [dashboardData]);

  const pendingShipmentsCount = useMemo(() => {
    if (dashboardData?.pending_shipments?.length) return dashboardData.pending_shipments.length;
    return Number(summary.pending_orders || 0) + Number(summary.confirmed_orders || 0);
  }, [dashboardData, summary]);

  const unreadMessagesCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const fulfillmentRate = useMemo(() => {
    const total = Number(summary.total_orders_received || 0);
    if (total <= 0) return 100;
    const delivered = Number(summary.delivered_orders || 0);
    return Math.round((delivered / total) * 1000) / 10;
  }, [summary]);

  // Weekly Sales Trend Data (Line/Area Graph)
  const salesChartData = useMemo(() => {
    const rawSales = dashboardData?.weekly_sales || [];
    if (rawSales.length > 0) {
      return rawSales.map((s: any, idx: number) => {
        const d = s.date ? new Date(s.date) : new Date();
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          day: label || `D${idx + 1}`,
          value: Number(s[chartMetric]) || 0,
          date: s.date,
        };
      });
    }
    return [
      { day: 'Mon', value: 0 },
      { day: 'Tue', value: 0 },
      { day: 'Wed', value: 0 },
      { day: 'Thu', value: 0 },
      { day: 'Fri', value: 0 },
      { day: 'Sat', value: 0 },
      { day: 'Sun', value: 0 },
    ];
  }, [dashboardData, chartMetric]);

  // Category Breakdown Bar Chart Data (Old Commit Graph Restored + Enhanced)
  const categoryBarData = useMemo(() => {
    const cats = dashboardData?.category_breakdown || [];
    return cats.slice(0, 5).map((c: any) => ({
      name: (c.category_name || 'Other').slice(0, 12),
      units: Number(c.units_sold) || 0,
    }));
  }, [dashboardData]);

  // Donut 1: Order Pipeline Breakdown (Admin DonutBreakdownCard Style)
  const orderDonutSegments: SellerDonutSegment[] = useMemo(() => {
    const pending = Number(summary.pending_orders || 0);
    const confirmed = Number(summary.confirmed_orders || 0);
    const inTransit = Number(summary.in_transit_orders || 0);
    const delivered = Number(summary.delivered_orders || 0);
    const total = pending + confirmed + inTransit + delivered;

    const pct = (val: number) => (total > 0 ? (val / total) * 100 : 0);

    return [
      { id: 'pending', label: 'Pending Pack', value: pending, color: '#F59E0B', percent: pct(pending) },
      { id: 'confirmed', label: 'Confirmed / Ready', value: confirmed, color: '#3B82F6', percent: pct(confirmed) },
      { id: 'in_transit', label: 'In Transit', value: inTransit, color: '#007a6c', percent: pct(inTransit) },
      { id: 'delivered', label: 'Delivered', value: delivered, color: '#10B981', percent: pct(delivered) },
    ];
  }, [summary]);

  // Donut 2: Crop Category Allocation (Units Sold or Inventory Count fallback)
  const categoryDonutInfo = useMemo(() => {
    const breakdown = dashboardData?.category_breakdown || [];
    const totalSold = breakdown.reduce((acc: number, c: any) => acc + Number(c.units_sold || 0), 0);

    if (totalSold > 0) {
      const segments: SellerDonutSegment[] = breakdown.slice(0, 5).map((c: any, i: number) => {
        const val = Number(c.units_sold || 0);
        return {
          id: `cat-sold-${i}`,
          label: c.category_name || 'Other',
          value: val,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          percent: (val / totalSold) * 100,
        };
      });
      return {
        title: 'Sales by Category',
        subtitle: 'Units sold across crop categories',
        totalValue: totalSold.toLocaleString(),
        totalLabel: 'Units sold',
        segments,
      };
    }

    // Fallback to listed inventory breakdown by category so farmer sees real catalog donut
    const inventory = dashboardData?.inventory || [];
    const grouped: Record<string, number> = {};
    inventory.forEach((p: any) => {
      const key = p.category_name || 'Uncategorized';
      grouped[key] = (grouped[key] || 0) + 1;
    });
    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const totalListings = entries.reduce((acc, [, v]) => acc + v, 0);

    const segments: SellerDonutSegment[] = entries.map(([name, count], i) => ({
      id: `cat-inv-${i}`,
      label: name,
      value: count,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      percent: totalListings > 0 ? (count / totalListings) * 100 : 0,
    }));

    return {
      title: 'Catalog Category Mix',
      subtitle: 'Active produce distribution by category',
      totalValue: totalListings.toLocaleString(),
      totalLabel: 'Listed crops',
      segments,
    };
  }, [dashboardData]);

  // Ethiopian Commodity Ticker (live API or baseline fallback)
  const commodityList = useMemo(() => {
    const trending = dashboardData?.commodity_trending || [];
    if (trending.length > 0) return trending;

    const platformTrends = dashboardData?.market_insights?.trending_keywords || [];
    if (platformTrends.length > 0) return platformTrends;

    return [
      { name: 'White Teff', change_pct: 3.8, up: true, icon: 'grass', region: 'Addis Ababa', benchmark: '9,850 ETB/qt' },
      { name: 'Arabica Coffee', change_pct: 2.1, up: true, icon: 'coffee', region: 'Jimma', benchmark: '340 ETB/kg' },
      { name: 'Red Onion', change_pct: -4.5, up: false, icon: 'spa', region: 'Shashemene', benchmark: '78 ETB/kg' },
      { name: 'Bread Wheat', change_pct: 0.9, up: true, icon: 'local_florist', region: 'Bale', benchmark: '5,600 ETB/qt' },
    ];
  }, [dashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-10 h-10 border-2 border-gray-300 border-t-[#1f5400] rounded-full animate-spin" />
        <p className="mt-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Loading Seller Center...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white text-gray-900">
      {/* ════════════════ TOP COMMAND HEADER (WHITE + LINED BORDERS) ════════════════ */}
      <header className="h-18 bg-white border-b border-gray-300 px-6 lg:px-8 flex items-center justify-between shrink-0 z-20 sticky top-0">
        {/* Page Title */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
            Seller Center
          </span>
          {user?.farm_name && (
            <>
              <span className="text-gray-300 hidden sm:inline">|</span>
              <span className="text-xs text-gray-500 hidden sm:inline truncate max-w-[220px]">
                {user.farm_name}
              </span>
            </>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 ml-4">
        
          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative w-9 h-9 flex items-center justify-center rounded-none text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-300 transition-colors"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[20px]">notifications_none</span>
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border border-white tabular-nums">
                  {unreadMessagesCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-none border border-gray-300 shadow-lg py-2 z-50">
                <div className="px-4 py-2.5 border-b border-gray-300 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Notifications
                    </h4>
                    <p className="text-[11px] text-gray-500">{unreadMessagesCount} unread alerts</p>
                  </div>
                  {unreadMessagesCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotifsRead}
                      className="text-[11px] text-[#007a6c] font-bold hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-gray-200">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((notif: any) => (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkNotifRead(notif.id)}
                        className={`p-3.5 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-3 ${
                          !notif.is_read ? 'bg-emerald-50/40' : 'bg-white'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            !notif.is_read ? 'bg-[#1f5400]' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 line-clamp-2">
                            {notif.message || notif.title || 'New harvest notification'}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {notif.created_at
                              ? new Date(notif.created_at).toLocaleString()
                              : 'Just now'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2.5 pb-1 px-4 border-t border-gray-200 text-center">
                  <Link
                    href="/farmer/orders"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs text-[#007a6c] hover:underline font-bold inline-flex items-center gap-1"
                  >
                    <span>View all activities</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-gray-300 mx-0.5 hidden sm:block" />

          {/* User Profile Avatar & Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-2.5 px-2 py-1 border border-transparent hover:border-gray-300 rounded-none transition-colors"
            >
              <div className="w-8 h-8 bg-[#1f5400] flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                {user?.image_url ? (
                  <img src={user.image_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.name?.charAt(0).toUpperCase() || 'F'}</span>
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-none">
                  {user?.name || 'Producer'}
                </p>
                <span
                  className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                    user?.is_verified
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      user?.is_verified ? 'bg-[#10B981]' : 'bg-amber-500'
                    }`}
                  />
                  {user?.is_verified ? 'Verified' : 'Provisional'}
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-[18px]">expand_more</span>
            </button>

            <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-none border border-gray-300 shadow-lg py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
              <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50/50">
                <p className="text-xs font-bold text-gray-900">{user?.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
              </div>
              <Link
                href="/farmer/profile"
                className="flex items-center px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-[#1f5400] transition-colors"
              >
                <span className="material-symbols-outlined text-[17px] mr-2.5 text-gray-400">
                  person
                </span>
                My Profile
              </Link>
              <Link
                href="/farmer/verification"
                className="flex items-center px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-[#1f5400] transition-colors"
              >
                <span className="material-symbols-outlined text-[17px] mr-2.5 text-gray-400">
                  verified_user
                </span>
                Verification Center
              </Link>
              <Link
                href="/farmer/store"
                className="flex items-center px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-[#1f5400] transition-colors"
              >
                <span className="material-symbols-outlined text-[17px] mr-2.5 text-gray-400">
                  store
                </span>
                Store Decoration
              </Link>
              <div className="h-px bg-gray-200 my-1" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[17px] mr-2.5">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════ MAIN SCROLLABLE WORKSPACE (WHITE + LINED BORDERS) ════════════════ */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-white">
        <div className="w-full max-w-[1480px] mx-auto p-6 lg:p-8 space-y-6">
          {/* 1. KYC VERIFICATION BANNER */}
          {user && !user.is_verified && (
            <div
              className={`rounded-none p-4 border border-gray-300 border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white ${
                user.kyc_status === 'changes_requested'
                  ? 'border-l-amber-500'
                  : user.kyc_status === 'under_review' || user.kyc_status === 'field_visit'
                  ? 'border-l-blue-600'
                  : user.kyc_status === 'rejected'
                  ? 'border-l-rose-600'
                  : 'border-l-[#1f5400]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`material-symbols-outlined text-xl mt-0.5 ${
                    user.kyc_status === 'changes_requested'
                      ? 'text-amber-600'
                      : user.kyc_status === 'under_review' || user.kyc_status === 'field_visit'
                      ? 'text-blue-600'
                      : user.kyc_status === 'rejected'
                      ? 'text-rose-600'
                      : 'text-[#1f5400]'
                  }`}
                >
                  {user.kyc_status === 'changes_requested'
                    ? 'warning'
                    : user.kyc_status === 'under_review' || user.kyc_status === 'field_visit'
                    ? 'hourglass_top'
                    : user.kyc_status === 'rejected'
                    ? 'cancel'
                    : 'verified_user'}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-xs sm:text-sm">
                      {user.kyc_status === 'changes_requested' &&
                        'Action Required: Update KYC Documents'}
                      {(user.kyc_status === 'under_review' ||
                        user.kyc_status === 'field_visit') &&
                        'KYC Application Under Review'}
                      {user.kyc_status === 'rejected' && 'Verification Application Rejected'}
                      {(!user.kyc_status ||
                        user.kyc_status === 'not_submitted' ||
                        user.kyc_status === 'pending') &&
                        'Complete Farmer Verification (Provisional Selling)'}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-gray-300 bg-gray-50 text-gray-700">
                      {user.kyc_tier || 'Provisional'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 max-w-3xl leading-relaxed">
                    {user.kyc_status === 'changes_requested' &&
                      'Review officers requested modifications. View feedback notes and upload corrected credentials.'}
                    {(user.kyc_status === 'under_review' ||
                      user.kyc_status === 'field_visit') &&
                      'Your credentials are currently under operational review. You can save drafts and fulfill active orders meanwhile.'}
                    {user.kyc_status === 'rejected' &&
                      'Your previous application was declined. Review notes and resubmit valid verification records.'}
                    {(!user.kyc_status ||
                      user.kyc_status === 'not_submitted' ||
                      user.kyc_status === 'pending') &&
                      'Provisional sellers can create drafts and submit listings for admin approval. Verify your farm identity to unlock automatic hybrid publication.'}
                  </p>
                </div>
              </div>

              <Link
                href="/farmer/verification"
                className="self-start sm:self-center shrink-0 bg-[#1f5400] hover:bg-[#173f00] text-white text-xs font-bold px-4 py-2 rounded-none transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>
                  {user.kyc_status === 'changes_requested'
                    ? 'Update Documents'
                    : 'Verification Center'}
                </span>
              </Link>
            </div>
          )}

          {/* 2. TODAY'S SNAPSHOT STRIP (ADMIN METRICSTRIP INSPIRATION) */}
          <SellerMetricStrip
            headerLeft={
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#007a6c] text-[18px]">
                  calendar_today
                </span>
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Today&apos;s Snapshot
                </span>
                
                
              </div>
            }
            headerRight={
              <Link
                href="/farmer/advisor"
                className="text-xs font-bold text-[#007a6c] hover:text-[#1f5400] hover:underline inline-flex items-center gap-1"
              >
                <span>Detailed Analytics</span>
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              </Link>
            }
          >
            <SellerMetricCard
              label="Today's Revenue"
              value={Number(summary.today_revenue || 0)}
              prefix="ETB "
              decimals={2}
              subText="since midnight"
            />
            <SellerMetricCard
              label="Today's Orders"
              value={Number(summary.today_orders || 0)}
              subText="placed today"
              href="/farmer/orders"
            />
            <SellerMetricCard
              label="Total Revenue"
              value={Number(summary.revenue_earned || 0)}
              prefix="ETB "
              decimals={2}
              subText="paid orders earned"
              href="/farmer/advisor"
            />
            <SellerMetricCard
              label="Total Orders"
              value={Number(summary.total_orders_received || 0)}
              subText={`${summary.delivered_orders || 0} delivered`}
              href="/farmer/orders"
            />
            <SellerMetricCard
              label="Active Crops"
              value={Number(summary.total_products || 0)}
              subText={`${Number(summary.total_stock_units || 0).toLocaleString()} units in stock`}
              href="/farmer/products"
            />
            <SellerMetricCard
              label="Fulfillment Rate"
              value={fulfillmentRate}
              suffix="%"
              decimals={1}
              subText={`${pendingShipmentsCount} awaiting dispatch`}
              href="/farmer/shipping"
            />
          </SellerMetricStrip>

          {/* 3. OLD SELLER CENTER TWO-COLUMN WORKBENCH + ADMIN GRAPHS & DONUTS */}
          <div className="flex flex-col xl:flex-row gap-6">
            {/* ──────────────── LEFT / MAIN COLUMN ──────────────── */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">
              {/* A. BUSINESS PERFORMANCE: LINE/AREA TREND + TOP SELLING CATEGORIES BAR GRAPH */}
              <div className="bg-white rounded-none border border-gray-300 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-300 flex flex-wrap justify-between items-center gap-4 bg-white">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 tracking-tight">
                      Business Performance
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Weekly sales velocity &amp; top performing crop categories
                    </p>
                  </div>

                  {/* Crisp Lined Metric Toggle */}
                  <div className="flex border border-gray-300 rounded-none divide-x divide-gray-300 bg-white">
                    <button
                      type="button"
                      onClick={() => setChartMetric('revenue')}
                      className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                        chartMetric === 'revenue'
                          ? 'bg-[#1f5400] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Revenue (ETB)
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMetric('orders')}
                      className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                        chartMetric === 'orders'
                          ? 'bg-[#1f5400] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Orders
                    </button>
                  </div>
                </div>

                {/* Graphs Split: 7-day Sales Trend + Top Categories Bar Graph */}
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-300">
                  {/* Line / Area Chart: Weekly Sales Trend */}
                  <div className="lg:col-span-8 p-5 bg-white flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Weekly Sales Trend (7 Days)
                      </span>
                      <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1.5">
                        <span className="w-2.5 h-0.5 bg-[#007a6c] inline-block" />
                        {chartMetric === 'revenue' ? 'Daily Revenue (ETB)' : 'Daily Orders'}
                      </span>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={salesChartData}
                          margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="sellerLineGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#007a6c" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="#007a6c" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 11, fill: '#4B5563' }}
                            axisLine={{ stroke: '#D1D5DB' }}
                            tickLine={false}
                            dy={6}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#4B5563' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              borderRadius: '0px',
                              border: '1px solid #D1D5DB',
                              boxShadow: 'none',
                              fontSize: '12px',
                            }}
                            formatter={(val: any) => [
                              chartMetric === 'revenue'
                                ? `ETB ${Number(val).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                  })}`
                                : `${val} Orders`,
                              chartMetric === 'revenue' ? 'Revenue' : 'Orders',
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#007a6c"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#sellerLineGrad)"
                            dot={{ r: 3.5, fill: '#007a6c', stroke: '#ffffff', strokeWidth: 1.5 }}
                            activeDot={{ r: 5.5, fill: '#1f5400', stroke: '#ffffff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Bar Chart: Top Selling Categories (Old Commit Graph Style) */}
                  <div className="lg:col-span-4 p-5 bg-white flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Top Selling Categories
                      </span>
                      <span className="text-[11px] text-gray-400">Units Sold</span>
                    </div>

                    <div className="flex-1 min-h-[220px] w-full flex items-center justify-center">
                      {categoryBarData.length === 0 ||
                      categoryBarData.every((c: any) => c.units === 0) ? (
                        <div className="text-center px-4">
                          <span className="material-symbols-outlined text-3xl text-gray-300 block mb-1.5">
                            bar_chart
                          </span>
                          <p className="text-xs font-semibold text-gray-600">No category sales yet</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Category bars populate automatically as buyer orders complete.
                          </p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart
                            data={categoryBarData}
                            margin={{ top: 10, right: 6, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10, fill: '#4B5563' }}
                              axisLine={{ stroke: '#D1D5DB' }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: '#4B5563' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: '#ffffff',
                                borderRadius: '0px',
                                border: '1px solid #D1D5DB',
                                boxShadow: 'none',
                                fontSize: '12px',
                              }}
                            />
                            <Bar dataKey="units" radius={[0, 0, 0, 0]}>
                              {categoryBarData.map((_entry: any, i: number) => (
                                <Cell
                                  key={i}
                                  fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Merged Lower Row: Order Fulfillment Allocation & Sales by Category Donuts */}
                <div className="border-t border-gray-300 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-300">
                  <SellerDonutCard
                    embedded
                    index={1}
                    title="Order Fulfillment Allocation"
                    subtitle="Real-time order pipeline breakdown"
                    totalValue={Number(summary.total_orders_received || 0).toLocaleString()}
                    totalLabel="Total orders"
                    segments={orderDonutSegments}
                    emptyMessage="No incoming buyer orders recorded yet"
                    action={
                      <Link
                        href="/farmer/orders"
                        className="text-[11px] font-bold text-[#007a6c] hover:underline"
                      >
                        Manage →
                      </Link>
                    }
                  />

                  <SellerDonutCard
                    embedded
                    index={2}
                    title={categoryDonutInfo.title}
                    subtitle={categoryDonutInfo.subtitle}
                    totalValue={categoryDonutInfo.totalValue}
                    totalLabel={categoryDonutInfo.totalLabel}
                    segments={categoryDonutInfo.segments}
                    emptyMessage="Add harvest products to inspect category mix"
                    action={
                      <Link
                        href="/farmer/products"
                        className="text-[11px] font-bold text-[#007a6c] hover:underline"
                      >
                        Catalog →
                      </Link>
                    }
                  />
                </div>

                {/* Unified Performance Footer */}
                <div className="px-6 py-3 border-t border-gray-300 bg-white flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#007a6c]" />
                    <span>
                      Live telemetry across {summary.total_orders_received || 0} orders &amp;{' '}
                      {summary.total_products || 0} active listings (ETB)
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link
                      href="/farmer/orders"
                      className="font-bold text-[#007a6c] hover:underline inline-flex items-center gap-1"
                    >
                      <span>All Orders</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                    <Link
                      href="/farmer/advisor"
                      className="font-bold text-[#1f5400] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Detailed Analytics</span>
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* ──────────────── RIGHT SIDEBAR WIDGETS (340PX) ──────────────── */}
            <div className="w-full xl:w-[340px] flex flex-col gap-6 shrink-0">
              {/* 1. SELLER RESOURCES & UTILITIES (WHITE LINED GRID) */}
              <div className="bg-white rounded-none border border-gray-300 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-300 bg-white">
                  <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                    Seller Resources &amp; Tools
                  </h3>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 border-b border-gray-200">
                  <Link
                    href="/farmer/resources/training"
                    className="p-3.5 flex items-center justify-center flex-col gap-1.5 hover:bg-gray-50 transition-colors text-gray-700 hover:text-[#1f5400]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#007a6c]">
                      school
                    </span>
                    <span className="text-[11px] font-semibold text-center">Training Hub</span>
                  </Link>
                  <Link
                    href="/farmer/support"
                    className="p-3.5 flex items-center justify-center flex-col gap-1.5 hover:bg-gray-50 transition-colors text-gray-700 hover:text-[#1f5400]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#007a6c]">
                      headset_mic
                    </span>
                    <span className="text-[11px] font-semibold text-center">Contact Support</span>
                  </Link>
                  <Link
                    href="/farmer/resources/rules"
                    className="p-3.5 flex items-center justify-center flex-col gap-1.5 hover:bg-gray-50 transition-colors text-gray-700 hover:text-[#1f5400]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#007a6c]">
                      gavel
                    </span>
                    <span className="text-[11px] font-semibold text-center">Platform Rules</span>
                  </Link>
                  <Link
                    href="/farmer/forum"
                    className="p-3.5 flex items-center justify-center flex-col gap-1.5 hover:bg-gray-50 transition-colors text-gray-700 hover:text-[#1f5400]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#007a6c]">
                      forum
                    </span>
                    <span className="text-[11px] font-semibold text-center">Seller Forum</span>
                  </Link>
                </div>

                {/* Quick Operations Bar */}
                <div className="grid grid-cols-4 divide-x divide-gray-200 bg-white">
                  <Link
                    href="/farmer/shipping"
                    className="py-2.5 flex flex-col items-center justify-center gap-0.5 text-gray-600 hover:text-[#1f5400] hover:bg-gray-50 transition-colors"
                    title="Waybills & Shipping"
                  >
                    <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                    <span className="text-[10px] font-semibold">Waybills</span>
                  </Link>
                  <Link
                    href="/farmer/campaigns"
                    className="py-2.5 flex flex-col items-center justify-center gap-0.5 text-gray-600 hover:text-[#1f5400] hover:bg-gray-50 transition-colors"
                    title="Campaigns & Vouchers"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      confirmation_number
                    </span>
                    <span className="text-[10px] font-semibold">Promos</span>
                  </Link>
                  <Link
                    href="/farmer/returns"
                    className="py-2.5 flex flex-col items-center justify-center gap-0.5 text-gray-600 hover:text-[#1f5400] hover:bg-gray-50 transition-colors"
                    title="Returns & Restocking"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      assignment_return
                    </span>
                    <span className="text-[10px] font-semibold">Returns</span>
                  </Link>
                  <Link
                    href="/farmer/store"
                    className="py-2.5 flex flex-col items-center justify-center gap-0.5 text-gray-600 hover:text-[#1f5400] hover:bg-gray-50 transition-colors"
                    title="Store Decoration"
                  >
                    <span className="material-symbols-outlined text-[16px]">palette</span>
                    <span className="text-[10px] font-semibold">Storefront</span>
                  </Link>
                </div>
              </div>

              {/* 3. MARKET INSIGHTS (COMMODITY TRENDS + PRICE BENCHMARK) */}
              <div className="bg-white rounded-none border border-gray-300 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-300 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#007a6c] text-[18px]">
                      query_stats
                    </span>
                    <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                      Market Insights
                    </h3>
                  </div>
                  <Link
                    href="/farmer/market"
                    className="text-[11px] font-bold text-[#007a6c] hover:underline"
                  >
                    View All
                  </Link>
                </div>

                <div className="p-4">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">
                    Commodity Trends
                  </p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {commodityList.slice(0, 6).map((t: any, i: number) => {
                      const isUp = t.up !== false && (t.change_pct == null || t.change_pct >= 0);
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-1 rounded-none border border-gray-300 bg-white text-[11px] font-semibold text-gray-800"
                        >
                          <span>{t.name}</span>
                          {t.change_pct != null && (
                            <span className="ml-1 tabular-nums text-gray-600">
                              {isUp ? '+' : ''}
                              {t.change_pct}%
                            </span>
                          )}
                          <span
                            className={`material-symbols-outlined text-[14px] ml-1 ${
                              isUp ? 'text-[#10B981]' : 'text-rose-600'
                            }`}
                          >
                            {isUp ? 'trending_up' : 'trending_down'}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">
                    Price Benchmark
                  </p>
                  {(() => {
                    const pb = dashboardData?.market_insights?.price_benchmark;
                    const marketCompare = dashboardData?.my_products_vs_market?.[0];
                    const compareProduct = marketCompare?.market_price
                      ? {
                          product_name: marketCompare.product_name,
                          my_price: marketCompare.farmer_price,
                          avg_category_price: marketCompare.market_price,
                          category_name: marketCompare.commodity_name || 'Market',
                        }
                      : pb;

                    if (!compareProduct) {
                      return (
                        <div className="bg-white border border-gray-300 p-3 text-xs text-gray-500">
                          Add harvest products to compare your pricing against the regional market
                          average.
                        </div>
                      );
                    }

                    const myPrice = Number(compareProduct.my_price) || 0;
                    const avgPrice = Number(compareProduct.avg_category_price) || 0;
                    const diff = myPrice - avgPrice;
                    const diffPct =
                      avgPrice > 0 ? Math.round((Math.abs(diff) / avgPrice) * 100) : 0;

                    let message = '';
                    let subtext = '';
                    let accentText = 'text-amber-700';
                    let borderLeft = 'border-l-amber-500';
                    let actionText = 'Adjust Price';

                    if (diff > 0) {
                      message = `Your ${compareProduct.product_name} price is ${diffPct}% higher`;
                      subtext = `Consider adjusting pricing to stay competitive in ${compareProduct.category_name}.`;
                    } else if (diff < 0) {
                      message = `Your ${compareProduct.product_name} price is ${diffPct}% lower`;
                      subtext = `Competitive pricing in ${compareProduct.category_name}!`;
                      accentText = 'text-[#1f5400]';
                      borderLeft = 'border-l-[#10B981]';
                      actionText = 'View Market';
                    } else {
                      message = `Your ${compareProduct.product_name} matches market average`;
                      subtext = `Pricing aligned with the ${compareProduct.category_name} benchmark.`;
                      accentText = 'text-[#007a6c]';
                      borderLeft = 'border-l-[#007a6c]';
                      actionText = 'View Market';
                    }

                    return (
                      <div
                        className={`bg-white border border-gray-300 border-l-4 ${borderLeft} p-3 relative`}
                      >
                        <span
                          className={`material-symbols-outlined ${accentText} absolute top-3 left-3 text-[17px]`}
                        >
                          info
                        </span>
                        <div className="pl-6">
                          <p className="text-xs font-bold text-gray-900">{message}</p>
                          <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                            {subtext}
                          </p>
                          <Link
                            href={
                              actionText === 'View Market' ? '/farmer/market' : '/farmer/products'
                            }
                            className={`mt-2 inline-block text-[11px] font-bold ${accentText} hover:underline uppercase`}
                          >
                            {actionText} →
                          </Link>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50/40 text-center">
                  <Link
                    href="/farmer/advisor"
                    className="text-xs font-bold text-[#007a6c] hover:underline inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">psychology</span>
                    <span>Consult Pricing &amp; Business Advisor</span>
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

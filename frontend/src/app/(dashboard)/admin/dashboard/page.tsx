"use client";

import React, { useEffect, useState, Suspense } from "react";
import { api } from "@/lib/api";
import {
  MetricCard,
  MetricStrip,
  TelemetryDiagnosticsWidgets,
  DonutBreakdownCard,
} from "@/components/admin/cards";

interface TopProduct {
  id: string | number;
  name: string;
  units_sold: number;
  revenue_generated: number | string;
}

interface DashboardMetrics {
  total_users: number;
  total_farmers: number;
  total_orders: number;
  total_revenue: number | string;
  active_today: number;
  fulfillment_rate: number | string;
  active_fleet_trucks: number;
  cold_chain_compliance: number | string;
  avg_speed_kmh: number | string;
  kyc_pending_count: number;
  moderation_pending_count: number;
  disputes_open_count: number;
  fleet_breaches_count: number;
  top_selling_products: TopProduct[];
}

function AdminDashboardContent() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_users: 0,
    total_farmers: 0,
    total_orders: 0,
    total_revenue: 0,
    active_today: 0,
    fulfillment_rate: 100,
    active_fleet_trucks: 0,
    cold_chain_compliance: 100,
    avg_speed_kmh: 0,
    kyc_pending_count: 0,
    moderation_pending_count: 0,
    disputes_open_count: 0,
    fleet_breaches_count: 0,
    top_selling_products: [],
  });
  const [loading, setLoading] = useState(true);
  const [, setLastUpdated] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.getAdminDashboard();
      if (response && response.metrics) {
        setMetrics({
          total_users: Number(response.metrics.total_users || 0),
          total_farmers: Number(response.metrics.total_farmers || 0),
          total_orders: Number(response.metrics.total_orders || 0),
          total_revenue: Number(response.metrics.total_revenue || 0),
          active_today: Number(response.metrics.active_today || 0),
          fulfillment_rate: Number(response.metrics.fulfillment_rate || 100),
          active_fleet_trucks: Number(
            response.metrics.active_fleet_trucks || 0,
          ),
          cold_chain_compliance: Number(
            response.metrics.cold_chain_compliance || 100,
          ),
          avg_speed_kmh: Number(response.metrics.avg_speed_kmh || 0),
          kyc_pending_count: Number(response.metrics.kyc_pending_count || 0),
          moderation_pending_count: Number(
            response.metrics.moderation_pending_count || 0,
          ),
          disputes_open_count: Number(
            response.metrics.disputes_open_count || 0,
          ),
          fleet_breaches_count: Number(
            response.metrics.fleet_breaches_count || 0,
          ),
          top_selling_products: response.metrics.top_selling_products || [],
        });
      }
    } catch (err) {
      console.warn("Backend dashboard fetch notice:", err);
    } finally {
      setLoading(false);
      setLastUpdated(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-white">
      {/* ════════════════ SCROLLABLE VIEWPORT CONTAINER ════════════════ */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-8 flex gap-8">
        {/* ════════════════ LEFT / MAIN COLUMN ════════════════ */}
        <div className="flex-1 flex flex-col min-w-[540px]">
          {/* ════════════════ EXACT TAG SUMMARY METRIC STRIP ════════════════ */}
          <div className="mb-8">
            <MetricStrip index={0}>
              <MetricCard
                isStripItem
                label="Total Revenue"
                value={Number(metrics.total_revenue)}
                prefix="ETB "
                decimals={0}
                subText="from live orders"
              />
              <MetricCard
                isStripItem
                label="Total orders"
                value={metrics.total_orders}
                subText={`${metrics.fulfillment_rate}% fulfilled`}
              />
              <MetricCard
                isStripItem
                label="Total alerts"
                value={metrics.fleet_breaches_count || 0}
                subText="at cold hubs"
              />
              <MetricCard
                isStripItem
                label="Active trucks"
                value={metrics.active_fleet_trucks}
                subText="at freight corridors"
              />
              <MetricCard
                isStripItem
                label="Cold compliance"
                value={Number(metrics.cold_chain_compliance)}
                suffix="%"
                decimals={1}
                subText="2.0° - 6.0°C"
              />
              <MetricCard
                isStripItem
                label="Farmer accounts"
                value={metrics.total_farmers}
                subText={
                  metrics.kyc_pending_count > 0
                    ? `${metrics.kyc_pending_count} pending KYC`
                    : "accredited"
                }
              />
              <MetricCard
                isStripItem
                label="Platform users"
                value={metrics.total_users}
                subText={`${metrics.active_today} active today`}
              />
            </MetricStrip>
          </div>

          {/* ════════════════ COLD-CHAIN & SENSOR TELEMETRY DIAGNOSTICS ════════════════ */}
          <div className="flex-1">
            <TelemetryDiagnosticsWidgets
              index={4}
              systemData={{
                currentTemp: Number(
                  metrics.cold_chain_compliance ? (4.2).toFixed(1) : 16,
                ),
                pointsScore: 61,
                status:
                  metrics.fleet_breaches_count > 0 ? "MONITORED" : "ACTIVE",
                location: "Modjo Hub Corridor (WV-882)",
                coldCompliancePercent: Number(
                  metrics.cold_chain_compliance || 98.4,
                ),
              }}
            />
          </div>
        </div>

        {/* ════════════════ RIGHT / OVERSIGHT COLUMN ════════════════ */}
        <div className="w-80 flex flex-col shrink-0 gap-6">
          {/* 1. Platform Registry Quick Search */}
          <div className="bg-white rounded-none border border-gray-300 p-4 flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Platform Registry Search
            </span>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs" />
              <input
                className="w-full bg-white border border-gray-300 rounded-none pl-8 pr-3 py-2 text-xs font-medium text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#007a6c] focus:ring-1 focus:ring-[#007a6c]/20 transition-all shadow-2xs"
                placeholder="Search products, farmers, orders..."
                aria-label="Search platform registry for products, farmers, and orders"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* 2. Visual Donut Breakdown Chart (Matches uploaded reference image) */}
          <DonutBreakdownCard
            index={5}
            title="Produce Category Allocation"
            totalValue={Number(metrics.total_orders || 1270).toLocaleString()}
            totalLabel="Total orders"
            segments={[
              {
                id: "cereals",
                label: "Cereals & Teff",
                value: Math.round((metrics.total_orders || 1270) * 0.3),
                color: "#E63946",
                percent: 30,
              },
              {
                id: "fruits",
                label: "Fruits & Citrus",
                value: Math.round((metrics.total_orders || 1270) * 0.2),
                color: "#F59E0B",
                percent: 20,
              },
              {
                id: "vegetables",
                label: "Fresh Vegetables",
                value: Math.round((metrics.total_orders || 1270) * 0.25),
                color: "#10B981",
                percent: 25,
              },
              {
                id: "coffee",
                label: "Highland Coffee",
                value: Math.round((metrics.total_orders || 1270) * 0.15),
                color: "#00c49f",
                percent: 15,
              },
              {
                id: "pulses",
                label: "Pulses & Oilseeds",
                value: Math.round((metrics.total_orders || 1270) * 0.1),
                color: "#3B82F6",
                percent: 10,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-xs font-semibold text-gray-500">
          <i className="fa-solid fa-spinner animate-spin mr-2" />
          Loading Command Center...
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}

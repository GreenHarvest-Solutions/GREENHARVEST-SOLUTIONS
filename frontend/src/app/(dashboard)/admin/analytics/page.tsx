'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface RegionalMetric {
  region: string;
  top_crop: string;
  volume_kg: number;
  gmv: number;
  commission: number;
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [fulfillmentRate, setFulfillmentRate] = useState(100);
  const [regionalData, setRegionalData] = useState<RegionalMetric[]>([]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [dashRes, analyticsRes]: [any, any] = await Promise.all([
        api.getAdminDashboard(),
        api.getAdminAnalytics(),
      ]);

      if (dashRes?.metrics) {
        setTotalRevenue(Number(dashRes.metrics.total_revenue || 0));
        setTotalOrders(Number(dashRes.metrics.total_orders || 0));
        setFulfillmentRate(Number(dashRes.metrics.fulfillment_rate || 100));
      }

      const rows = analyticsRes?.analytics || dashRes?.metrics?.regional_analytics || [];
      if (Array.isArray(rows)) {
        setRegionalData(
          rows.map((r: any) => ({
            region: r.region || 'Central Ethiopia',
            top_crop: r.top_crop || 'Agricultural Goods',
            volume_kg: Number(r.volume_kg || 0),
            gmv: Number(r.gmv || 0),
            commission: Number(r.commission || 0),
          }))
        );
      }
    } catch (err) {
      console.warn('Analytics fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalVolume = regionalData.reduce((acc, curr) => acc + curr.volume_kg, 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Top Header */}
      <header className="px-8 py-5 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Platform Financials &amp; Analytics</h1>
            <span className="text-xs font-bold text-[#1f5400] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase">
              Live PostgreSQL Telemetry
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            Regional trade volumes, Gross Merchandise Value (GMV), and 5% escrow clearance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            <span>Command Center</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">Cumulative Platform GMV</span>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              ETB {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-emerald-800 font-medium mt-1">
              Active marketplace volume transacted
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">Net Platform Commission (5%)</span>
            <p className="text-2xl font-bold text-[#1f5400] mt-1 tabular-nums">
              ETB {(totalRevenue * 0.05).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-600 mt-1">Chapa automated escrow deduction</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">Total Produce Transacted</span>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {totalVolume.toLocaleString('en-US')} kg
            </p>
            <p className="text-xs text-emerald-800 font-medium mt-1 tabular-nums">
              {fulfillmentRate}% delivered without dispute ({totalOrders} orders)
            </p>
          </div>
        </div>

        {/* Regional Trade Volume Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <i className="fa-solid fa-chart-pie text-[#1f5400]" />
              Regional Trade Volume &amp; Marketplace Distribution
            </h2>
            <span className="text-xs text-gray-600 font-mono">Currency: ETB</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FCF9F8] border-b border-gray-100 text-gray-700 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="py-3 px-4">Agricultural Region</th>
                  <th className="py-3 px-4">Primary Produce Category</th>
                  <th className="py-3 px-4">Volume Cleared</th>
                  <th className="py-3 px-4">Gross Trade GMV</th>
                  <th className="py-3 px-4">Platform Fee (5%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-gray-600">
                      <i className="fa-solid fa-spinner animate-spin mr-2 text-sm text-[#1f5400]" />
                      Aggregating regional commodity data...
                    </td>
                  </tr>
                ) : regionalData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-gray-600">
                      No regional trade transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  regionalData.map((row, idx) => (
                    <tr key={`${row.region}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-900">{row.region}</td>
                      <td className="py-3.5 px-4 text-gray-700">{row.top_crop}</td>
                      <td className="py-3.5 px-4 text-gray-700 tabular-nums">
                        {row.volume_kg.toLocaleString('en-US')} kg
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900 tabular-nums">
                        ETB {row.gmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1f5400] tabular-nums">
                        ETB {row.commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

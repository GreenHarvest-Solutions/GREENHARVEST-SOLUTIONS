'use client';

import React from 'react';
import Link from 'next/link';

export default function AdminAnalyticsPage() {
  const regionalData = [
    { region: 'Oromia (Bishoftu & Ambo)', volumeKg: '14,200 kg', gmv: 486000, commission: 24300, topCrop: 'Highland Potatoes & Onions' },
    { region: 'Sidama (Hawassa Corridor)', volumeKg: '8,400 kg', gmv: 395000, commission: 19750, topCrop: 'Hass Avocados & Sweet Fruit' },
    { region: 'Afar (Awash Valley)', volumeKg: '6,100 kg', gmv: 210000, commission: 10500, topCrop: 'Citrus, Watermelons & Papayas' },
    { region: 'Addis Ababa (Commercial Depots)', volumeKg: '28,700 kg', gmv: 1091000, commission: 54550, topCrop: 'Cross-Docked Distribution' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Top Header */}
      <header className="px-8 py-5 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Platform Financials &amp; Analytics</h1>
            <span className="text-xs font-bold text-[#286c00] bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full uppercase">
              Q4 FY2026 Audit
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            Regional trade volumes, Gross Merchandise Value (GMV), and 5% escrow clearance
          </p>
        </div>

        <div className="flex items-center gap-3">
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
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">ETB 2,182,000</p>
            <p className="text-xs text-emerald-800 font-medium mt-1">+14.2% vs previous quarter</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">Net Platform Commission (5%)</span>
            <p className="text-2xl font-bold text-[#286c00] mt-1 tabular-nums">ETB 109,100</p>
            <p className="text-xs text-gray-600 mt-1">Chapa automated escrow deduction</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">Total Produce Transacted</span>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">57,400 kg</p>
            <p className="text-xs text-emerald-800 font-medium mt-1">98.4% delivered without dispute</p>
          </div>
        </div>

        {/* Regional Trade Volume Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <i className="fa-solid fa-chart-pie text-[#286c00]" />
              Regional Trade Volume &amp; Marketplace Distribution
            </h2>
            <span className="text-xs text-gray-600 font-mono">Currency: ETB</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FCF9F8] border-b border-gray-100 text-gray-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Agricultural Region</th>
                  <th className="py-3 px-4">Primary Produce Category</th>
                  <th className="py-3 px-4">Weight Cleared</th>
                  <th className="py-3 px-4">Gross Trade GMV</th>
                  <th className="py-3 px-4">Platform Fee (5%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {regionalData.map((row) => (
                  <tr key={row.region} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900">{row.region}</td>
                    <td className="py-3 px-4 text-gray-700">{row.topCrop}</td>
                    <td className="py-3 px-4 text-gray-700 tabular-nums">{row.volumeKg}</td>
                    <td className="py-3 px-4 font-bold text-gray-900 tabular-nums">
                      ETB {row.gmv.toLocaleString('en-US')}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#286c00] tabular-nums">
                      ETB {row.commission.toLocaleString('en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


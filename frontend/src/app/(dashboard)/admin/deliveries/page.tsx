'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface FleetTruck {
  id: string;
  driverName: string;
  vehiclePlate: string;
  route: string;
  cargo: string;
  tempCelsius: number;
  status: 'transit' | 'loading' | 'completed' | 'delayed';
  eta: string;
}

export default function AdminDeliveriesPage() {
  const [trucks] = useState<FleetTruck[]>([
    { id: 'FL-201', driverName: 'Kassahun Worku', vehiclePlate: 'ET-3-48192', route: 'Bishoftu → Addis Ababa (Bole)', cargo: 'Highland Vegetables (1,200 kg)', tempCelsius: 3.4, status: 'transit', eta: '45 mins' },
    { id: 'FL-202', driverName: 'Girma Tilahun', vehiclePlate: 'ET-3-88291', route: 'Mojo Dry Port → Hawassa', cargo: 'Fresh Avocados & Papayas (4,000 kg)', tempCelsius: 4.1, status: 'transit', eta: '1.8 hours' },
    { id: 'FL-203', driverName: 'Mesfin Desta', vehiclePlate: 'ET-3-19302', route: 'Ambo → Addis Ababa (Mercato)', cargo: 'Red Highland Potatoes (3,500 kg)', tempCelsius: 5.2, status: 'transit', eta: '2.1 hours' },
    { id: 'FL-204', driverName: 'Yared Bekele', vehiclePlate: 'ET-3-67120', route: 'Awash → Adama Hub', cargo: 'Citrus & Sweet Melons (2,800 kg)', tempCelsius: 3.9, status: 'loading', eta: 'Departing 14:00' },
  ]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Top Header */}
      <header className="px-8 py-5 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Logistics &amp; Cold-Chain Dispatch</h1>
            <span className="text-xs font-bold text-[#286c00] bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full uppercase">
              14 Active Trucks
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            Real-time telemetry, temperature compliance, and regional cargo dispatch
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
        {/* Fleet KPI Banner */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">Fleet Active on Road</span>
            <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">14 Carriers</p>
            <span className="text-xs text-emerald-800 font-medium">100% telemetry linked</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">Cold-Chain Compliance</span>
            <p className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">99.2%</p>
            <span className="text-xs text-gray-600">Standard range 2.0°C - 6.0°C</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">Avg Regional Transit</span>
            <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">2.4 Hours</p>
            <span className="text-xs text-emerald-800 font-medium">-18 mins vs target</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
            <span className="text-xs font-semibold text-gray-700">On-Time Delivery Rate</span>
            <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">96.8%</p>
            <span className="text-xs text-gray-600">Zero spoiled claims today</span>
          </div>
        </div>

        {/* Live Truck Fleet Dispatch Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <i className="fa-solid fa-truck-fast text-[#286c00]" />
              Active Refrigerated Fleet Tracking
            </h2>
            <span className="text-xs text-gray-600 font-mono">GPS Ping: Active</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FCF9F8] border-b border-gray-100 text-gray-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Truck / Plate</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Transit Route</th>
                  <th className="py-3 px-4">Cargo Batch</th>
                  <th className="py-3 px-4">Reefer Temp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Estimated ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trucks.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-gray-900">{t.id}</p>
                      <p className="text-xs font-mono text-gray-600">{t.vehiclePlate}</p>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">{t.driverName}</td>
                    <td className="py-3 px-4 text-gray-700">{t.route}</td>
                    <td className="py-3 px-4 text-gray-700">{t.cargo}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                        {t.tempCelsius}°C
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 uppercase">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800 tabular-nums">{t.eta}</td>
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


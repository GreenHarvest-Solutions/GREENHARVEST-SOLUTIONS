'use client';

import React from 'react';
import Image from 'next/image';

export default function AdminSidebar() {
  return (
    <aside className="w-64 bg-white/80 flex flex-col h-full border-r border-gray-100 z-10 relative shrink-0">
      {/* Background Graphic */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-50/50 pointer-events-none" />

      {/* Logo */}
      <div className="px-8 py-10 flex items-center gap-3 relative z-10">
        <div className="grid grid-cols-2 gap-1 w-6 h-6">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
          <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-800" />
          <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-800" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
        </div>
        <span className="text-xl font-bold tracking-tight">
          Green <span className="text-[#7C3AED]">Solution</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto hide-scrollbar relative z-10 min-h-0">
        <ul className="space-y-2">
          <li>
            <a className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium" href="#">
              <i className="fa-solid fa-border-all w-6 text-center text-gray-400" />
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a className="flex items-center justify-between px-4 py-3 bg-[#7C3AED] text-white rounded-xl shadow-lg shadow-[#7C3AED]/30 transition-all font-medium" href="#">
              <div className="flex items-center">
                <i className="fa-solid fa-briefcase w-6 text-center text-white/90" />
                <span>Marketplace</span>
              </div>
              <i className="fa-solid fa-arrow-right text-sm" />
            </a>
          </li>
          <li>
            <a className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium" href="#">
              <i className="fa-solid fa-book w-6 text-center text-gray-400" />
              <span>Orders</span>
            </a>
          </li>
          <li>
            <a className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium" href="#">
              <i className="fa-solid fa-chart-pie w-6 text-center text-gray-400" />
              <span>Inventory</span>
            </a>
          </li>
          <li>
            <a className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium" href="#">
              <i className="fa-solid fa-file-invoice w-6 text-center text-gray-400" />
              <span>Analytics</span>
            </a>
          </li>
        </ul>

        <div className="mt-8">
          <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">SUPPLY CHAIN</span>
          <ul className="mt-3 space-y-2">
            <li>
              <a className="flex items-center justify-between px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium" href="#">
                <div className="flex items-center">
                  <i className="fa-solid fa-envelope-open-text w-6 text-center text-gray-400" />
                  <span>MESSAGES</span>
                </div>
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">6</span>
              </a>
            </li>
            <li>
              <a className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium" href="#">
                <i className="fa-solid fa-bolt w-6 text-center text-gray-400" />
                <span>Activities</span>
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* Go Pro Widget */}
      <div className="p-6 relative z-10 shrink-0">
        <div className="bg-white rounded-2xl p-5 shadow-xl shadow-purple-100/50 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-transparent" />
          <div className="w-24 h-24 mb-4 relative z-10 flex items-center justify-center">
            <Image
              alt="Harvest Pro"
              className="w-full h-full object-contain relative z-10"
              src="/images/admin/stitch/go-pro_v3.png"
              width={96}
              height={96}
            />
          </div>
          <a className="text-sm font-semibold text-[#7C3AED] hover:text-[#6D28D9] transition-colors relative z-10 flex items-center gap-1" href="#">
            Get Harvest Pro <i className="fa-solid fa-arrow-right text-xs" />
          </a>
        </div>
      </div>
    </aside>
  );
}

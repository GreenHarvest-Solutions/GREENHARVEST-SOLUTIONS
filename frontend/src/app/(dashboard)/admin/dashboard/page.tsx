'use client';

import React from 'react';
import Image from 'next/image';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminDashboardPage() {
  return (
    <div className="flex w-full h-full rounded-[2.5rem] bg-white overflow-hidden shadow-2xl shadow-purple-200/50 relative">

      {/* ════════════════ SIDEBAR ════════════════ */}
      <AdminSidebar />

      {/* ════════════════ MAIN CONTENT ════════════════ */}
      <main className="flex-1 flex flex-col bg-[#FDFCFE] rounded-l-3xl shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-20">
        <div className="flex-1 overflow-y-auto hide-scrollbar p-10 flex gap-10">

          {/* Left Column (Hero & Schedule) */}
          <div className="flex-1 flex flex-col min-w-[500px]">

            {/* Hero Section */}
            <section className="bg-[#F8F9FF] rounded-[2rem] p-10 flex flex-wrap md:flex-nowrap items-center justify-between gap-6 relative overflow-hidden mb-8 shrink-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
              <div className="absolute bottom-0 right-32 w-48 h-48 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 translate-y-1/3 pointer-events-none" />
              <div className="max-w-sm relative z-10 shrink-1">
                <h1 className="text-4xl font-bold leading-tight mb-4 text-gray-900">
                  Get Fresh Harvest Delivered.
                </h1>
                <p className="text-gray-500 mb-8 text-sm">
                  Order organic produce directly from local farms. Sustainable, fresh, and fair. 🔥
                </p>
                <button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-[#7C3AED]/30 transition-all flex items-center gap-2">
                  Upgrade Now <i className="fa-solid fa-arrow-right text-sm" />
                </button>
              </div>
              {/* 3D Graphic */}
              <div className="relative w-72 h-64 z-10 flex items-center justify-center shrink-0">
                <Image
                  alt="Premium Courses"
                  className="w-full h-full object-contain relative z-10"
                  src="/images/admin/stitch/hero_v3.png"
                  width={288}
                  height={256}
                  priority
                />
              </div>
            </section>

            {/* Schedule Section */}
            <section className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Monday <span className="font-normal text-gray-600">31 Aug</span>
                  <i className="fa-solid fa-chevron-down text-sm text-gray-400 ml-1" />
                </h2>
              </div>

              <div className="flex-1 relative flex">
                {/* Timeline Axis */}
                <div className="w-24 flex flex-col justify-between text-xs text-gray-400 font-medium py-4 relative z-0">
                  <div className="h-8 flex items-center justify-end pr-10 text-gray-800 relative">
                    08:00
                    <div className="absolute right-0 top-1/2 w-8 h-[1px] bg-purple-300 transform -translate-y-1/2" />
                    <div className="absolute right-8 top-1/2 w-2 h-2 rounded-full bg-[#7C3AED] transform -translate-y-1/2 translate-x-1/2" />
                  </div>
                  <div className="h-8 flex items-center justify-end pr-10 relative">
                    09:00
                    <div className="absolute right-0 top-1/2 w-4 h-[1px] bg-gray-200 transform -translate-y-1/2" />
                  </div>
                  <div className="h-8 flex items-center justify-end pr-10 relative">
                    10:00
                    <div className="absolute right-0 top-1/2 w-4 h-[1px] bg-gray-200 transform -translate-y-1/2" />
                  </div>
                  <div className="h-8 flex items-center justify-end pr-10 relative">
                    11:00
                    <div className="absolute right-0 top-1/2 w-4 h-[1px] bg-gray-200 transform -translate-y-1/2" />
                  </div>
                  <div className="h-8 flex items-center justify-end pr-10 relative">
                    12:00
                    <div className="absolute right-0 top-1/2 w-4 h-[1px] bg-gray-200 transform -translate-y-1/2" />
                  </div>
                </div>

                {/* Schedule Cards */}
                <div className="flex-1 flex flex-col gap-4 relative z-10 pl-4 py-2 border-l border-gray-100">
                  {/* Card 1 */}
                  <div className="bg-purple-50 rounded-2xl p-5 flex items-stretch relative overflow-hidden h-40">
                    <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-[#7C3AED] rounded-r-lg" />
                    <div className="w-32 flex items-end justify-center pb-2 relative">
                      <Image
                        alt="Fresh Produce"
                        className="w-24 h-24 object-contain relative z-10"
                        src="/images/admin/stitch/card1_v3.png"
                        width={96}
                        height={96}
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-center py-2 pr-12 relative">
                      <div className="text-xs text-[#7C3AED] font-semibold mb-1 flex items-center gap-1">
                        <i className="fa-regular fa-clock" /> 08:00 - 09:30
                      </div>
                      <h3 className="text-lg font-bold text-[#6D28D9] leading-tight mb-2">
                        Fresh Produce Batch #201
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                        Review quality control for the morning vegetable harvest.
                      </p>
                      <button className="absolute bottom-4 right-0 w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors">
                        <i className="fa-solid fa-arrow-right text-xs" />
                      </button>
                      <div className="absolute top-0 right-0 w-10 h-10 rounded-full border-[3px] border-orange-400 border-l-gray-200 flex items-center justify-center bg-white">
                        <span className="text-[10px] font-bold text-gray-700">75</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2 (Small) */}
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-100">
                    <div className="text-xs text-[#7C3AED] font-semibold flex items-center gap-1">
                      <i className="fa-regular fa-clock" /> 09:30 - 10:30
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700">Logistics Sync</h3>
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <span className="text-sm">😎</span>
                    </div>
                  </div>

                  {/* Card 3 (Active/Dark) */}
                  <div className="bg-[#7B2CBF] rounded-2xl p-5 flex items-stretch relative overflow-hidden h-40 shadow-xl shadow-purple-500/20">
                    <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-white/40 rounded-r-lg" />
                    <div className="w-32 flex items-end justify-center pb-2 relative z-10">
                      <Image
                        alt="Soil Health"
                        className="w-24 h-24 object-contain relative z-10"
                        src="/images/admin/stitch/card3_v3.png"
                        width={96}
                        height={96}
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-center py-2 pr-12 relative z-10">
                      <div className="text-xs text-purple-200 font-medium mb-1 flex items-center gap-1">
                        <i className="fa-regular fa-clock" /> 11:00 - 12:30
                      </div>
                      <h3 className="text-lg font-bold text-white leading-tight mb-2">
                        Soil Health Analysis
                      </h3>
                      <p className="text-xs text-purple-200/80 leading-relaxed max-w-[200px]">
                        Detailed report on nutrient levels for upcoming planting season.
                      </p>
                      <button className="absolute bottom-4 right-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                        <i className="fa-solid fa-arrow-right text-xs" />
                      </button>
                      <div className="absolute top-0 right-0 w-10 h-10 rounded-full border-[3px] border-white border-b-white/20 flex items-center justify-center bg-white/10 backdrop-blur-sm text-white">
                        <span className="text-[10px] font-bold">85</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ════════════════ RIGHT COLUMN ════════════════ */}
          <div className="w-80 flex flex-col">
            {/* Top Bar (Search & Profile) */}
            <div className="flex items-center justify-between mb-10">
              <div className="relative flex-1 mr-6">
                <i className="fa-solid fa-search absolute left-0 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  className="w-full bg-transparent border-none focus:ring-0 pl-7 text-sm font-medium text-gray-600 placeholder-gray-400 p-0"
                  placeholder="Search"
                  type="text"
                />
              </div>
              <button className="w-10 h-10 rounded-full bg-[#7C3AED] flex items-center justify-center shadow-lg shadow-[#7C3AED]/30 shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-700 to-purple-400" />
                <i className="fa-solid fa-shield-halved text-white relative z-10 text-sm" />
              </button>
            </div>

            {/* Class Details */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-wider">TOP HARVEST</span>
                <button className="text-gray-400 hover:text-gray-600">
                  <i className="fa-solid fa-ellipsis" />
                </button>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
                Organic Kale &amp;<br />Spinach
              </h2>

              <div className="flex items-center justify-between text-sm text-gray-500 border-b border-gray-100 pb-6 mb-6">
                <span>Organic Kale &amp; Spinach</span>
                <i className="fa-solid fa-chevron-down text-xs" />
              </div>

              {/* Participants */}
              <div className="mb-8">
                <h4 className="text-xs font-semibold text-gray-400 mb-3">Recent Buyers</h4>
                <div className="flex items-center">
                  {[1, 2, 3, 4].map((i) => (
                    <Image
                      key={i}
                      alt="Participant"
                      className={`w-8 h-8 rounded-full border-2 border-white shadow-sm ${i > 1 ? '-ml-2' : ''} relative`}
                      src={`/images/admin/stitch/avatar${i}_v2.png`}
                      width={32}
                      height={32}
                      style={{ zIndex: 50 - (i * 10) }}
                    />
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center -ml-2 relative z-50 shadow-sm">
                    3+
                  </div>
                </div>
              </div>

              {/* Info List */}
              <div className="space-y-6 flex-1">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#7C3AED] flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-calendar-day" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium mb-1">Monday, August 2020</p>
                    <p className="text-sm font-bold text-gray-900">08:00 - 10:00 AM</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-clock-rotate-left" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium mb-1">Duration</p>
                    <p className="text-sm font-bold text-gray-900">2 hours</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-layer-group" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium mb-1">Level</p>
                    <p className="text-sm font-bold text-gray-900">Grade A Premium</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6">
                <button className="w-full bg-[#7B2CBF] hover:bg-[#6D28D9] text-white py-4 rounded-xl font-medium shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2">
                  Join Now <i className="fa-solid fa-arrow-right text-sm" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

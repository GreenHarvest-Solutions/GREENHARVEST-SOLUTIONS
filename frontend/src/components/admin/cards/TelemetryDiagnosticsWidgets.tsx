'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatedSvgLine, AnimatedSvgBar } from './ChartCard';

export interface TelemetryDiagnosticsProps {
  index?: number;
  className?: string;
  // Live system overrides if provided
  systemData?: {
    currentTemp?: number;
    pointsScore?: number;
    status?: 'STOPPED' | 'ACTIVE' | 'MONITORED';
    location?: string;
    lastSeenDate?: string;
    coldCompliancePercent?: number;
  };
}

export const TelemetryDiagnosticsWidgets: React.FC<TelemetryDiagnosticsProps> = ({
  index = 4,
  className = '',
  systemData,
}) => {
  // Mode switcher: Reference Image exact telemetry vs Live Freight Corridor Telemetry
  const [useLiveTelemetry, setUseLiveTelemetry] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Reference visual data matching the uploaded image exactly
  const refData = {
    temp: 16,
    points: 61,
    status: 'STOPPED' as const,
    location: 'GaryS-WV',
    date: '30th Sept, 2026',
    timePoints: ['31 May 10:00 AM', '31 May 10:30 AM', '31 May 11:00 AM', '31 May 11:30 AM', '31 May 12:00 PM'],
  };

  // Live GreenHarvest system data
  const liveData = {
    temp: systemData?.currentTemp ?? 4.2,
    points: systemData?.pointsScore ?? 98,
    status: (systemData?.status || 'MONITORED') as 'STOPPED' | 'ACTIVE' | 'MONITORED',
    location: systemData?.location || 'Modjo Hub Corridor (WV-882)',
    date: systemData?.lastSeenDate || new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    timePoints: ['08:00 AM', '09:30 AM', '11:00 AM', '12:30 PM', 'Live (EAT)'],
  };

  const current = useLiveTelemetry ? liveData : refData;

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* ════════════════ TOP CARD: DUAL-AXIS TEMPERATURE & LIFE REMAINING CHART ════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] as const }}
        className="bg-white  border border-gray-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col"
      >
        {/* Optional Control Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#007a6c]" />
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Temperature &amp; Life Remaining Telemetry
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 font-medium">Source:</span>
            <button
              onClick={() => setUseLiveTelemetry(!useLiveTelemetry)}
              className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-[#007a6c] font-semibold hover:border-[#007a6c] transition-colors shadow-2xs"
            >
              {useLiveTelemetry ? 'Live Freight Telemetry' : 'Reference Tag Mode'}
            </button>
          </div>
        </div>

        {/* Dual Axis Chart Area + Sidebar Legend */}
        <div className="flex flex-col lg:flex-row items-stretch">
          {/* Main Chart SVG Viewport (~75% width) */}
          <div className="flex-1 p-4 md:p-6 relative">
            {activeTooltip && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg z-20 pointer-events-none">
                {activeTooltip}
              </div>
            )}

            <div className="relative w-full h-[260px] md:h-[300px]">
              <svg
                viewBox="0 0 680 280"
                className="w-full h-full overflow-visible select-none"
              >
                {/* ── Left Y-Axis: Temperature (°C) ── */}
                <text
                  x="-120"
                  y="20"
                  transform="rotate(-90)"
                  fontSize="12"
                  fontWeight="600"
                  fill="#4B5563"
                  textAnchor="middle"
                >
                  Temperature(°C)
                </text>
                <text x="50" y="35" fontSize="12" fill="#4B5563" textAnchor="end" className="tabular-nums">20</text>
                <text x="50" y="115" fontSize="12" fill="#4B5563" textAnchor="end" className="tabular-nums">19</text>
                <text x="50" y="195" fontSize="12" fill="#4B5563" textAnchor="end" className="tabular-nums">18</text>

                {/* ── Right Y-Axis: Life Remaining ── */}
                <text
                  x="120"
                  y="-620"
                  transform="rotate(90)"
                  fontSize="12"
                  fontWeight="600"
                  fill="#4B5563"
                  textAnchor="middle"
                >
                  Life Remaining
                </text>
                <text x="585" y="35" fontSize="12" fill="#4B5563" textAnchor="start" className="tabular-nums">100</text>
                <text x="585" y="75" fontSize="12" fill="#4B5563" textAnchor="start" className="tabular-nums">80</text>
                <text x="585" y="115" fontSize="12" fill="#4B5563" textAnchor="start" className="tabular-nums">60</text>
                <text x="585" y="155" fontSize="12" fill="#4B5563" textAnchor="start" className="tabular-nums">40</text>
                <text x="585" y="195" fontSize="12" fill="#4B5563" textAnchor="start" className="tabular-nums">20</text>
                <text x="585" y="235" fontSize="12" fill="#4B5563" textAnchor="start" className="tabular-nums">0</text>

                {/* Horizontal Grid lines */}
                <line x1="60" y1="35" x2="575" y2="35" stroke="#F3F4F6" strokeWidth="1" />
                <line x1="60" y1="75" x2="575" y2="75" stroke="#F3F4F6" strokeWidth="1" />
                <line x1="60" y1="115" x2="575" y2="115" stroke="#F3F4F6" strokeWidth="1" />
                <line x1="60" y1="155" x2="575" y2="155" stroke="#F3F4F6" strokeWidth="1" />
                <line x1="60" y1="195" x2="575" y2="195" stroke="#F3F4F6" strokeWidth="1" />
                <line x1="60" y1="235" x2="575" y2="235" stroke="#E5E7EB" strokeWidth="1.5" />

                {/* Vertical Checkpoint / Handover Lines (thin dashed amber) */}
                <line x1="230" y1="30" x2="230" y2="235" stroke="#FCD34D" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="330" y1="30" x2="330" y2="235" stroke="#FCD34D" strokeWidth="1" strokeDasharray="3 3" />

                {/* ── Line 1: High Temperature (Red Line) ── */}
                <AnimatedSvgLine
                  d="M 60 215 L 100 218 L 160 220 L 230 216 L 300 210 L 370 205 L 430 170 L 480 80 L 530 45 L 565 60"
                  stroke="#E63946"
                  strokeWidth={2}
                  duration={1.8}
                  delay={0.1}
                />

                {/* ── Line 2: Low Temperature (Blue Line) ── */}
                <AnimatedSvgLine
                  d="M 60 225 L 80 215 L 115 228 L 160 226 L 230 227 L 300 225 L 350 220 L 400 210 L 440 185 L 480 115 L 520 40 L 545 25 L 565 42"
                  stroke="#2563EB"
                  strokeWidth={2}
                  duration={1.8}
                  delay={0.2}
                />

                {/* ── Line 3: Temperature Log (Purple Line) ── */}
                <AnimatedSvgLine
                  d="M 60 220 L 95 228 L 130 226 L 160 225 L 200 224 L 230 225 L 270 222 L 310 215 L 340 212 L 370 218 L 400 212 L 430 175 L 460 110 L 490 85 L 530 50 L 565 48"
                  stroke="#7C3AED"
                  strokeWidth={2.5}
                  duration={2.0}
                  delay={0.3}
                />

                {/* ── Line 4: Life Remaining (Teal Line Descending) ── */}
                <AnimatedSvgLine
                  d="M 60 28 L 130 38 L 230 55 L 330 75 L 440 98 L 520 120 L 565 135"
                  stroke="#00A896"
                  strokeWidth={2.5}
                  duration={1.8}
                  delay={0.15}
                />

                {/* ── Markers Plotted on Curves ── */}
                {/* 1. Handover marker (Yellow square at 130, 38) */}
                <rect
                  x="126"
                  y="34"
                  width="8"
                  height="8"
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() => setActiveTooltip('Handover: Cold-Chain Custody Transfer Verified')}
                  onMouseLeave={() => setActiveTooltip(null)}
                />

                {/* 2. Checkpoint marker (Amber triangle at 230, 55) */}
                <polygon
                  points="230,49 235,59 225,59"
                  fill="#D97706"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() => setActiveTooltip('Checkpoint 1: Modjo Depot Weight & Sensor Sync')}
                  onMouseLeave={() => setActiveTooltip(null)}
                />

                {/* 3. Checkpoint marker (Amber triangle at 330, 75) */}
                <polygon
                  points="330,69 335,79 325,79"
                  fill="#D97706"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() => setActiveTooltip('Checkpoint 2: Expressway Waypoint Calibration')}
                  onMouseLeave={() => setActiveTooltip(null)}
                />

                {/* 4. Handover marker (Yellow square at 440, 98) */}
                <rect
                  x="436"
                  y="94"
                  width="8"
                  height="8"
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() => setActiveTooltip('Handover: Secondary Distribution Depot')}
                  onMouseLeave={() => setActiveTooltip(null)}
                />

                {/* 5. Points alert (Red circles on Life Remaining line) */}
                <circle
                  cx="115"
                  cy="36"
                  r="4"
                  fill="#991B1B"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() => setActiveTooltip('Points Alert: Shelf-Life Gradient Alert')}
                  onMouseLeave={() => setActiveTooltip(null)}
                />
                <circle
                  cx="280"
                  cy="65"
                  r="4"
                  fill="#991B1B"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() => setActiveTooltip('Points Alert: Thermal Cycle Fluctuations')}
                  onMouseLeave={() => setActiveTooltip(null)}
                />
                <circle
                  cx="370"
                  cy="83"
                  r="4"
                  fill="#991B1B"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() => setActiveTooltip('Points Alert: Sensor Threshold Excursion')}
                  onMouseLeave={() => setActiveTooltip(null)}
                />
                <circle
                  cx="520"
                  cy="120"
                  r="4"
                  fill="#991B1B"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onMouseEnter={() => setActiveTooltip('Points Alert: Final Destination Intake Audit')}
                  onMouseLeave={() => setActiveTooltip(null)}
                />

                {/* 6. Temperature alert (Concentric red ring with center dot on purple log) */}
                <circle cx="95" cy="228" r="5" fill="none" stroke="#EF4444" strokeWidth="1.5" />
                <circle cx="95" cy="228" r="2.5" fill="#DC2626" />

                <circle cx="400" cy="212" r="5" fill="none" stroke="#EF4444" strokeWidth="1.5" />
                <circle cx="400" cy="212" r="2.5" fill="#DC2626" />

                {/* ── Bottom X-Axis: Time ── */}
                <text x="60" y="254" fontSize="11" fill="#4B5563" textAnchor="start">
                  {current.timePoints[0]}
                </text>
                <text x="180" y="254" fontSize="11" fill="#4B5563" textAnchor="middle">
                  {current.timePoints[1]}
                </text>
                <text x="310" y="254" fontSize="11" fill="#4B5563" textAnchor="middle">
                  {current.timePoints[2]}
                </text>
                <text x="440" y="254" fontSize="11" fill="#4B5563" textAnchor="middle">
                  {current.timePoints[3]}
                </text>
                <text x="565" y="254" fontSize="11" fill="#4B5563" textAnchor="end">
                  {current.timePoints[4]}
                </text>

                {/* X-Axis Main Title */}
                <text x="310" y="274" fontSize="12" fontWeight="600" fill="#374151" textAnchor="middle">
                  Time
                </text>
              </svg>
            </div>
          </div>

          {/* Right Legend Sidebar (~25% width) matching uploaded image */}
          <div className="w-full lg:w-56 border-t lg:border-t-0 lg:border-l border-gray-200/90 bg-white flex flex-col text-xs shrink-0">
            {/* Lines Section */}
            <div className="border-b border-gray-100">
              <div className="bg-gray-50/90 py-2 px-4 text-center font-bold text-gray-700 tracking-wide border-b border-gray-100">
                Lines
              </div>
              <div className="p-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-0.5 bg-[#E63946] shrink-0" />
                  <span className="text-gray-700 font-medium">High temperature</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-0.5 bg-[#2563EB] shrink-0" />
                  <span className="text-gray-700 font-medium">Low temperature</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-0.5 bg-[#7C3AED] shrink-0" />
                  <span className="text-gray-700 font-medium">Temperature log</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-0.5 bg-[#00A896] shrink-0" />
                  <span className="text-gray-700 font-medium">Life remaining</span>
                </div>
              </div>
            </div>

            {/* Markers Section */}
            <div className="flex-1">
              <div className="bg-gray-50/90 py-2 px-4 text-center font-bold text-gray-700 tracking-wide border-b border-gray-100">
                Markers
              </div>
              <div className="p-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#991B1B] shrink-0 inline-block" />
                  <span className="text-gray-700 font-medium">Points alert</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="relative w-3 h-3 flex items-center justify-center shrink-0">
                    <span className="w-3 h-3 rounded-full border border-red-500 absolute" />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 absolute" />
                  </span>
                  <span className="text-gray-700 font-medium">Temperature alert</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-amber-600 shrink-0 inline-block" />
                  <span className="text-gray-700 font-medium">Checkpoint</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-2xs shrink-0 inline-block" />
                  <span className="text-gray-700 font-medium">Handover</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ════════════════ BOTTOM ROW: HISTOGRAM & LAST SEEN CARDS ════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left Card: Thermal Exposure Distribution Histogram (7 of 10 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: index * 0.07, ease: [0.25, 0.1, 0.25, 1] as const }}
          className="lg:col-span-7 bg-white border border-gray-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] p-5 md:p-6 flex flex-col justify-between"
        >
          <div className="relative w-full h-[190px]">
            <svg viewBox="0 0 540 190" className="w-full h-full select-none">
              {/* Left Y-Axis: Time(Hours) */}
              <text
                x="-90"
                y="18"
                transform="rotate(-90)"
                fontSize="12"
                fontWeight="600"
                fill="#4B5563"
                textAnchor="middle"
              >
                Time(Hours)
              </text>
              <text x="45" y="25" fontSize="12" fill="#4B5563" textAnchor="end" className="tabular-nums">60</text>
              <text x="45" y="70" fontSize="12" fill="#4B5563" textAnchor="end" className="tabular-nums">40</text>
              <text x="45" y="115" fontSize="12" fill="#4B5563" textAnchor="end" className="tabular-nums">20</text>
              <text x="45" y="155" fontSize="12" fill="#4B5563" textAnchor="end" className="tabular-nums">0</text>

              {/* Grid lines */}
              <line x1="55" y1="20" x2="520" y2="20" stroke="#F3F4F6" strokeWidth="1" />
              <line x1="55" y1="65" x2="520" y2="65" stroke="#F3F4F6" strokeWidth="1" />
              <line x1="55" y1="110" x2="520" y2="110" stroke="#F3F4F6" strokeWidth="1" />
              <line x1="55" y1="155" x2="520" y2="155" stroke="#E5E7EB" strokeWidth="1.5" />

              {/* Histogram Bars in bright Teal (#00A896 / #00c49f) matching reference image */}
              {/* Bar at 20°C: ~20 hours */}
              <AnimatedSvgBar
                x={410}
                y={110}
                width={36}
                height={45}
                fill="#00c49f"
                rx={1}
                delay={0.2}
              />

              {/* Bar at 70°C / high dwell: ~65 hours */}
              <AnimatedSvgBar
                x={465}
                y={15}
                width={36}
                height={140}
                fill="#00c49f"
                rx={1}
                delay={0.35}
              />

              {/* X-Axis Temperature (°C) Buckets */}
              <text x="65" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">-30</text>
              <text x="105" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">-25</text>
              <text x="145" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">-18</text>
              <text x="185" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">-10</text>
              <text x="225" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">0</text>
              <text x="265" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">1</text>
              <text x="305" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">2</text>
              <text x="345" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">3.3</text>
              <text x="385" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">8</text>
              <text x="428" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">20</text>
              <text x="483" y="170" fontSize="11" fill="#4B5563" textAnchor="middle">70</text>

              {/* X-Axis Main Title */}
              <text x="285" y="186" fontSize="12" fontWeight="600" fill="#374151" textAnchor="middle">
                Temperature(°C)
              </text>
            </svg>
          </div>
        </motion.div>

        {/* Right Card: Last Seen Card (3 of 10 cols) matching uploaded image */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: index * 0.09, ease: [0.25, 0.1, 0.25, 1] as const }}
          className="lg:col-span-3 bg-white rounded-2xl border border-gray-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col"
        >
          {/* Card Header */}
          <div className="py-2.5 px-4 text-center font-bold text-gray-800 text-xs border-b border-gray-100 bg-gray-50/80 uppercase tracking-wider">
            Last Seen
          </div>

          {/* Card Content Body */}
          <div className="p-5 flex flex-col justify-between flex-1 gap-4">
            {/* Top Metric Row: Big Temp + Radial Gauge */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-4xl md:text-5xl font-normal text-gray-900 tracking-tight tabular-nums block">
                  {current.temp}°C
                </span>
              </div>

              {/* Circular Arc Radial Gauge with Score */}
              <div className="relative w-18 h-18 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {/* Subtle track background */}
                  <path
                    className="text-gray-100"
                    strokeWidth="3.2"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Active arc stroke */}
                  <motion.path
                    className="text-[#00c49f]"
                    strokeDasharray="100, 100"
                    initial={{ strokeDashoffset: 100 }}
                    animate={{ strokeDashoffset: 100 - (current.points) }}
                    transition={{ duration: 1.4, delay: 0.3 }}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>

                <div className="absolute flex flex-col items-center justify-center text-center leading-none">
                  <span className="text-base font-bold text-gray-900 tabular-nums">
                    {current.points}
                  </span>
                  <span className="text-xs font-medium text-gray-600 mt-0.5">
                    points
                  </span>
                </div>
              </div>
            </div>

            {/* Status Button / Badge */}
            <div className="w-full">
              <span
                className={`w-full block py-1.5 px-3 rounded-md text-xs font-semibold text-center uppercase tracking-widest border ${
                  current.status === 'STOPPED'
                    ? 'border-red-300 text-red-700 bg-red-50/40'
                    : 'border-emerald-300 text-emerald-800 bg-emerald-50/40'
                }`}
              >
                {current.status}
              </span>
            </div>

            {/* Location & Date Rows with Icons */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-gray-100 text-xs">
              <div className="flex items-center gap-3 text-gray-800">
                <i className="fa-solid fa-location-dot text-gray-900 text-base shrink-0" aria-hidden="true" />
                <span className="font-semibold text-gray-900 truncate">
                  {current.location}
                </span>
              </div>

              <div className="flex items-center gap-3 text-gray-700">
                <i className="fa-solid fa-calendar-days text-gray-900 text-base shrink-0" aria-hidden="true" />
                <span className="font-medium text-gray-700">
                  {current.date}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};


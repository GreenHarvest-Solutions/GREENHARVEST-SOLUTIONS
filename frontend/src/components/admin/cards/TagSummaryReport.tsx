'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BaseCard } from './BaseCard';
import { MetricCard, MetricStrip } from './MetricCard';
import { DataListCard } from './DataListCard';
import { ChartCard, AnimatedSvgLine, AnimatedSvgBar } from './ChartCard';

export interface TagSummaryData {
  tagId: string;
  vehiclePlate: string;
  carrier: string;
  cargoBatch: string;
  cargoWeightKg: number;
  origin: string;
  destination: string;
  currentCheckpoint: string;
  reeferTemp: number;
  minTemp: number;
  maxTemp: number;
  totalAlerts: number;
  checkpointsCount: number;
  totalHours: number;
  status: string;
  lastSeenTime?: string;
  pointsScore?: number;
}

export const TagSummaryReport: React.FC<{
  data: TagSummaryData;
  onClose?: () => void;
}> = ({ data, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 15 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const }}
      className="bg-white rounded-3xl p-6 md:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-gray-200/90 shadow-2xl flex flex-col gap-6"
    >
      {/* ════════════════ TOP REPORT HEADER (EXACT TAG SUMMARY INSPIRATION) ════════════════ */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-indigo-950 tracking-tighter">
              LOGO
            </span>
            <div className="h-5 w-px bg-gray-200" />
            <h2 className="text-2xl font-bold text-[#00A896] tracking-tight">
              Tag Summary
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Automated Reefer IoT Telemetry Dossier • Consignment {data.tagId}
          </p>
        </div>

        {/* Right Metadata Box */}
        <div className="flex items-center gap-4">
          <div className="border border-gray-200/80 rounded-xl px-3.5 py-2 text-xs text-gray-600 bg-gray-50/50 space-y-0.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-400">Published:</span>
              <span className="font-semibold text-gray-800">
                {data.lastSeenTime || '21st Nov 2026, 11:30'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-400">Time Zone:</span>
              <span className="font-semibold text-gray-800">East Africa (EAT)</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-400">Metric Scale:</span>
              <span className="font-semibold text-gray-800">Celsius (°C)</span>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
              aria-label="Close Tag Summary"
            >
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          )}
        </div>
      </div>

      {/* ════════════════ SECTION 1: EVENT INFO & DOCUMENT CARDS ════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col (1 of 3): Event info & Tag Info */}
        <div className="flex flex-col gap-6">
          <DataListCard
            title="Event info"
            index={0}
            items={[
              { label: 'Date', value: '21st Nov, 2026' },
              { label: 'Carrier', value: data.carrier },
              { label: 'Bizlocation', value: data.currentCheckpoint },
              { label: 'Bizstep', value: 'in_transit' },
              { label: 'Readpoint', value: 'Expressway Gate' },
            ]}
          />

          <DataListCard
            title="Tag Info"
            index={1}
            items={[
              { label: 'Tag Type', value: 'Cryo-Sensor' },
              { label: 'Tag What', value: 'Produce Reefer' },
              {
                label: 'Temperature Range',
                value: '2.0° - 6.0°C',
                badge: (
                  <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 text-xs font-bold border border-teal-200">
                    Cold
                  </span>
                ),
              },
              { label: 'Sensing Model', value: 'Continuous 5m' },
              { label: 'Sense What', value: 'Fresh Crop' },
            ]}
          />
        </div>

        {/* Right Col (2 of 3): Document Metadata */}
        <div className="md:col-span-2">
          <DataListCard
            title="Document"
            index={2}
            maxVisibleItems={10}
            items={[
              { label: 'Tag ID', value: data.tagId },
              { label: 'Plate Number', value: data.vehiclePlate },
              { label: 'Consignor Enterprise', value: 'GreenHarvest Agricultural Clearinghouse' },
              { label: 'Consignment Batch', value: data.cargoBatch },
              { label: 'Harvest Dispatch Date', value: 'Nov 21 2026 06:00:00 AM' },
              { label: 'Country of Origin', value: 'Ethiopia' },
              { label: 'Agricultural Hub', value: data.origin },
              { label: 'Destination Terminal', value: data.destination },
              { label: 'Declared Net Weight', value: `${data.cargoWeightKg.toLocaleString()} kg` },
              { label: 'Nearest Cold Backup', value: 'Debre Zeit Cold Consolidation Depot' },
              { label: 'Seal Verification', value: '#ES-8821 (Intact)' },
            ]}
          />
        </div>
      </div>

      {/* ════════════════ SECTION 2: METRIC STRIP (CENTERED METRICS) ════════════════ */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          Operational Threshold Diagnostics
        </h3>
        <MetricStrip index={3}>
          <MetricCard
            isStripItem
            label="Total Time"
            value={data.totalHours || 6}
            suffix=" hrs"
            subText="from dispatch"
          />
          <MetricCard
            isStripItem
            label="Checkpoints"
            value={data.checkpointsCount || 4}
            subText="cleared"
          />
          <MetricCard
            isStripItem
            label="Total Alerts"
            value={data.totalAlerts || 0}
            accentColor="#E63946"
            subText="spoilage risk"
          />
          <MetricCard
            isStripItem
            label="Most Alerts"
            value={data.totalAlerts > 0 ? 1 : 0}
            subText="at rift valley"
          />
          <MetricCard
            isStripItem
            label="Points Used"
            value={data.pointsScore || 61}
            subText="sensor capacity"
          />
          <MetricCard
            isStripItem
            label="Max Temp"
            value={Number(data.maxTemp || 5.8)}
            decimals={1}
            suffix="°C"
            subText="recorded"
          />
          <MetricCard
            isStripItem
            label="Min Temp"
            value={Number(data.minTemp || 2.4)}
            decimals={1}
            suffix="°C"
            subText="recorded"
          />
        </MetricStrip>
      </div>

      {/* ════════════════ SECTION 3: CHARTS & LAST SEEN GAUGES ════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dual Axis Line Chart (2 of 3) */}
        <div className="md:col-span-2">
          <ChartCard
            title="Temperature & Life Remaining Telemetry"
            index={4}
            height={220}
            legends={[
              { label: 'Temperature log', color: '#4338CA', icon: 'line' },
              { label: 'Life remaining', color: '#00A896', icon: 'line' },
              { label: 'Points alert', color: '#B91C1C', icon: 'dot' },
              { label: 'Checkpoint', color: '#D97706', icon: 'triangle' },
              { label: 'Handover', color: '#EAB308', icon: 'square' },
            ]}
          >
            {/* Native Animated SVG Chart */}
            <svg
              viewBox="0 0 600 200"
              className="w-full h-full overflow-visible"
            >
              {/* Grid Lines */}
              <line x1="50" y1="20" x2="550" y2="20" stroke="#F3F4F6" strokeWidth="1" />
              <line x1="50" y1="70" x2="550" y2="70" stroke="#F3F4F6" strokeWidth="1" />
              <line x1="50" y1="120" x2="550" y2="120" stroke="#F3F4F6" strokeWidth="1" />
              <line x1="50" y1="170" x2="550" y2="170" stroke="#E5E7EB" strokeWidth="1.5" />

              {/* Checkpoint vertical lines */}
              <line x1="160" y1="20" x2="160" y2="170" stroke="#FDE68A" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="280" y1="20" x2="280" y2="170" stroke="#FDE68A" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="390" y1="20" x2="390" y2="170" stroke="#FDE68A" strokeWidth="1" strokeDasharray="3 3" />

              {/* Axis Labels */}
              <text x="35" y="25" fontSize="10" fill="#9CA3AF" textAnchor="end">6°C</text>
              <text x="35" y="75" fontSize="10" fill="#9CA3AF" textAnchor="end">4°C</text>
              <text x="35" y="125" fontSize="10" fill="#9CA3AF" textAnchor="end">2°C</text>
              <text x="35" y="175" fontSize="10" fill="#9CA3AF" textAnchor="end">0°C</text>

              <text x="565" y="25" fontSize="10" fill="#00A896" textAnchor="start">100%</text>
              <text x="565" y="95" fontSize="10" fill="#00A896" textAnchor="start">60%</text>
              <text x="565" y="175" fontSize="10" fill="#00A896" textAnchor="start">0%</text>

              {/* Animated Path 1: Life Remaining (Cyan descending) */}
              <AnimatedSvgLine
                d="M 50 25 L 160 45 L 280 65 L 390 85 L 480 115 L 550 145"
                stroke="#00A896"
                strokeWidth={2.5}
                duration={1.8}
                delay={0.1}
              />

              {/* Animated Path 2: Temperature Log (Indigo trace) */}
              <AnimatedSvgLine
                d="M 50 145 L 100 152 L 160 148 L 220 145 L 280 140 L 330 135 L 390 128 L 440 90 L 480 60 L 520 50 L 550 52"
                stroke="#4338CA"
                strokeWidth={2.5}
                duration={1.8}
                delay={0.3}
              />

              {/* Markers */}
              <polygon points="160,42 165,50 155,50" fill="#D97706" />
              <polygon points="280,62 285,70 275,70" fill="#D97706" />
              <circle cx="100" cy="152" r="3.5" fill="#B91C1C" />
              <circle cx="330" cy="135" r="3.5" fill="#B91C1C" />
              <rect x="436" y="86" width="8" height="8" fill="#EAB308" rx="1" />

              {/* Time X-Axis */}
              <text x="50" y="190" fontSize="10" fill="#9CA3AF">06:00 AM</text>
              <text x="160" y="190" fontSize="10" fill="#9CA3AF">07:30 AM</text>
              <text x="280" y="190" fontSize="10" fill="#9CA3AF">09:00 AM</text>
              <text x="390" y="190" fontSize="10" fill="#9CA3AF">10:30 AM</text>
              <text x="520" y="190" fontSize="10" fill="#9CA3AF">Live</text>
            </svg>
          </ChartCard>
        </div>

        {/* Right Col: Last Seen Widget inspired by Tag Summary */}
        <BaseCard index={5} title="Last Seen" subtitle="Live Sensor Ping">
          <div className="flex flex-col items-center justify-center text-center gap-4 py-2">
            <div className="flex items-center justify-around w-full">
              <div>
                <span className="text-3xl font-black text-gray-900 tabular-nums block">
                  {Number(data.reeferTemp).toFixed(1)}°C
                </span>
                <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {data.status || 'Active'}
                </span>
              </div>

              {/* Circular Gauge */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <motion.path
                    className="text-[#00A896]"
                    strokeDasharray="100, 100"
                    initial={{ strokeDashoffset: 100 }}
                    animate={{ strokeDashoffset: 100 - (data.pointsScore || 61) }}
                    transition={{ duration: 1.2, delay: 0.4 }}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-[10px] font-bold text-gray-800 leading-none">
                  <span className="text-xs">{data.pointsScore || 61}</span>
                  <span className="text-[9px] text-gray-400">pts</span>
                </div>
              </div>
            </div>

            <div className="w-full border-t border-gray-100 pt-3 flex flex-col gap-2 text-xs text-left">
              <div className="flex items-center gap-2 text-gray-700">
                <i className="fa-solid fa-location-dot text-[#00A896] text-xs" />
                <span className="font-semibold truncate">{data.currentCheckpoint}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <i className="fa-solid fa-calendar-day text-xs" />
                <span>21st Nov 2026, 11:30 EAT</span>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      {/* ════════════════ SECTION 4: TEMPERATURE DISTRIBUTION HISTOGRAM ════════════════ */}
      <ChartCard
        title="Thermal Exposure Distribution (Hours vs Temperature)"
        index={6}
        height={160}
      >
        <svg viewBox="0 0 600 130" className="w-full h-full">
          <line x1="40" y1="100" x2="560" y2="100" stroke="#E5E7EB" strokeWidth="1" />

          {/* Histogram Bars */}
          <AnimatedSvgBar x={90} y={95} width={28} height={5} fill="#00A896" delay={0.1} />
          <AnimatedSvgBar x={160} y={98} width={28} height={2} fill="#00A896" delay={0.2} />
          <AnimatedSvgBar x={230} y={99} width={28} height={1} fill="#00A896" delay={0.3} />
          <AnimatedSvgBar x={300} y={99} width={28} height={1} fill="#00A896" delay={0.4} />
          <AnimatedSvgBar x={370} y={98} width={28} height={2} fill="#00A896" delay={0.5} />
          <AnimatedSvgBar x={440} y={60} width={28} height={40} fill="#00A896" delay={0.6} />
          <AnimatedSvgBar x={510} y={20} width={28} height={80} fill="#00A896" delay={0.7} />

          {/* Temperature Range Labels */}
          <text x="104" y="115" fontSize="10" fill="#9CA3AF" textAnchor="middle">-30</text>
          <text x="174" y="115" fontSize="10" fill="#9CA3AF" textAnchor="middle">-18</text>
          <text x="244" y="115" fontSize="10" fill="#9CA3AF" textAnchor="middle">0</text>
          <text x="314" y="115" fontSize="10" fill="#9CA3AF" textAnchor="middle">2.0</text>
          <text x="384" y="115" fontSize="10" fill="#9CA3AF" textAnchor="middle">3.5</text>
          <text x="454" y="115" fontSize="10" fill="#9CA3AF" textAnchor="middle">4.2</text>
          <text x="524" y="115" fontSize="10" fill="#00A896" fontWeight="bold" textAnchor="middle">5.8°C</text>
        </svg>
      </ChartCard>
    </motion.div>
  );
};

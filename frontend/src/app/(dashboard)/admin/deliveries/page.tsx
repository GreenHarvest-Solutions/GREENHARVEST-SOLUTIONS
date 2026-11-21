'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  ThermometerSnowflake,
  ShieldCheck,
  RotateCcw,
  Plus,
  ArrowRight,
  Eye,
  SlidersHorizontal,
  Activity,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminTable,
  AdminPagination,
  AdminEmptyState,
  AdminTabs,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminFleetDeliveriesPage() {
  const { showToast } = useToast();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<any>({
    total_shipments: 0,
    active_trucks: 0,
    optimal_count: 0,
    elevated_count: 0,
    breached_count: 0,
    avg_speed_kmh: 0,
    cold_chain_compliance_pct: 100,
    active_cargo_weight_kg: 0,
  });

  // Selected shipment for detailed telemetry inspection
  const [telemetryDossier, setTelemetryDossier] = useState<any | null>(null);
  const [isDossierLoading, setIsDossierLoading] = useState(false);

  // Emergency Diversion Modal
  const [diversionModal, setDiversionModal] = useState<{
    isOpen: boolean;
    shipment: any | null;
    diversionHub: string;
    notes: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    shipment: null,
    diversionHub: 'Mojo Dry Port Cold Intermodal Terminal',
    notes: '',
    isSubmitting: false,
  });

  // New Dispatch Modal
  const [dispatchModal, setDispatchModal] = useState<{
    isOpen: boolean;
    vehicle_plate: string;
    truck_type: string;
    driver_name: string;
    driver_phone: string;
    carrier_partner: string;
    cargo_batch: string;
    cargo_weight_kg: string;
    origin_hub: string;
    destination_hub: string;
    reefer_temp_celsius: string;
    target_temp_min: string;
    target_temp_max: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    vehicle_plate: 'ET-3-88412',
    truck_type: '10-Ton Refrigerated Reefer',
    driver_name: 'Desta Mengistu',
    driver_phone: '+251 91 551 0293',
    carrier_partner: 'Ethio Cold-Chain Logistics',
    cargo_batch: 'Highland Hydroponic Strawberries & Kale (1,500 kg)',
    cargo_weight_kg: '1500',
    origin_hub: 'Debre Zeit Cold Hub Depot',
    destination_hub: 'Addis Ababa Bole Cargo Depository',
    reefer_temp_celsius: '3.5',
    target_temp_min: '2.0',
    target_temp_max: '6.0',
    isSubmitting: false,
  });

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const res = await api.getFleetShipments({
        status: statusParam,
        carrier: carrierFilter === 'all' ? undefined : carrierFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setShipments(res.shipments || []);
        if (res.metrics) setMetrics(res.metrics);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch fleet telemetry', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, carrierFilter, search, page, showToast]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const handleInspectTelemetry = async (shipmentId: string) => {
    setIsDossierLoading(true);
    try {
      const res = await api.getShipmentDossier(shipmentId);
      if (res?.shipment) {
        setTelemetryDossier(res.shipment);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load telemetry dossier', 'error');
    } finally {
      setIsDossierLoading(false);
    }
  };

  const handleConfirmDiversion = async () => {
    if (!diversionModal.shipment) return;
    setDiversionModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await api.emergencyRerouteTruck(diversionModal.shipment.id, {
        diversion_hub: diversionModal.diversionHub,
        admin_notes: diversionModal.notes.trim() || 'Emergency cold-chain diversion to prevent product spoilage',
      });
      showToast(`Emergency diversion executed for ${diversionModal.shipment.id}`, 'success');
      setDiversionModal({ isOpen: false, shipment: null, diversionHub: 'Mojo Dry Port Cold Intermodal Terminal', notes: '', isSubmitting: false });
      fetchShipments();
    } catch (err: any) {
      showToast(err.message || 'Diversion dispatch failed', 'error');
      setDiversionModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleCreateDispatch = async () => {
    setDispatchModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await api.assignDispatchBatch({
        vehicle_plate: dispatchModal.vehicle_plate,
        truck_type: dispatchModal.truck_type,
        driver_name: dispatchModal.driver_name,
        driver_phone: dispatchModal.driver_phone,
        carrier_partner: dispatchModal.carrier_partner,
        cargo_batch: dispatchModal.cargo_batch,
        cargo_weight_kg: parseFloat(dispatchModal.cargo_weight_kg) || 1000,
        origin_hub: dispatchModal.origin_hub,
        destination_hub: dispatchModal.destination_hub,
        reefer_temp_celsius: parseFloat(dispatchModal.reefer_temp_celsius) || 3.5,
        target_temp_min: parseFloat(dispatchModal.target_temp_min) || 2.0,
        target_temp_max: parseFloat(dispatchModal.target_temp_max) || 6.0,
      });
      showToast('New refrigerated shipment dispatched successfully', 'success');
      setDispatchModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
      fetchShipments();
    } catch (err: any) {
      showToast(err.message || 'Dispatch creation failed', 'error');
      setDispatchModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const tabs = [
    { key: 'all', label: 'All Fleet Shipments', count: totalCount },
    { key: 'in_transit', label: 'In Cold Transit', count: metrics.active_trucks },
    { key: 'temp_breach', label: 'Temperature Breach Alerts', count: metrics.breached_count },
    { key: 'loading', label: 'Loading at Depot' },
    { key: 'completed', label: 'Delivered & Signed Off' },
  ];

  const columns = [
    {
      header: 'Truck & Reefer',
      accessor: (row: any) => (
        <div>
          <div className="font-mono font-bold text-gray-900 flex items-center gap-1.5">
            <span>{row.vehicle_plate}</span>
            <span className="text-[10px] text-gray-500 font-normal">({row.id})</span>
          </div>
          <div className="text-[11px] text-gray-500">{row.truck_type}</div>
        </div>
      ),
    },
    {
      header: 'Driver & Carrier',
      accessor: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.driver_name}</div>
          <div className="text-[11px] text-[#007a6c] font-medium">{row.carrier_partner}</div>
          <div className="text-[10px] text-gray-400 font-mono">{row.driver_phone}</div>
        </div>
      ),
    },
    {
      header: 'Cargo & Weight',
      accessor: (row: any) => (
        <div className="max-w-[200px]">
          <div className="font-medium text-gray-900 truncate" title={row.cargo_batch}>
            {row.cargo_batch}
          </div>
          <div className="text-[11px] text-gray-500 font-mono">
            {parseFloat(row.cargo_weight_kg).toLocaleString()} kg
          </div>
        </div>
      ),
    },
    {
      header: 'Corridor & Checkpoint',
      accessor: (row: any) => (
        <div className="max-w-[220px]">
          <div className="text-gray-900 font-semibold text-xs flex items-center gap-1">
            <span className="truncate">{row.origin_hub}</span>
            <ArrowRight className="w-2.5 h-2.5 shrink-0 text-gray-400" />
            <span className="truncate">{row.destination_hub}</span>
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
            <span className="truncate font-mono">{row.current_checkpoint}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Reefer Temp (°C)',
      accessor: (row: any) => {
        const temp = parseFloat(row.reefer_temp_celsius);
        const isBreach = row.compliance_status === 'breached' || row.status === 'temp_breach' || temp > parseFloat(row.target_temp_max);
        return (
          <div className="font-mono text-right">
            <div
              className={`text-sm font-bold tabular-nums inline-flex items-center gap-1 ${
                isBreach ? 'text-red-700 animate-pulse' : 'text-[#1f5400]'
              }`}
            >
              <ThermometerSnowflake className="w-3 h-3" />
              <span>{temp.toFixed(1)}°C</span>
            </div>
            <div className="text-[10px] text-gray-500 tabular-nums">
              Target: {row.target_temp_min}°C – {row.target_temp_max}°C
            </div>
          </div>
        );
      },
    },
    {
      header: 'Telemetry State',
      accessor: (row: any) => {
        const isBreach = row.compliance_status === 'breached' || row.status === 'temp_breach';
        return (
          <div>
            <span
              className={`inline-block px-2 py-0.5 text-[11px] font-bold border tabular-nums ${
                isBreach
                  ? 'bg-red-50 text-red-900 border-red-300'
                  : row.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-blue-50 text-blue-900 border-blue-300'
              }`}
            >
              {isBreach ? '⚠️ TEMP BREACH' : row.status?.replace('_', ' ').toUpperCase()}
            </span>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
              Speed: {row.speed_kmh} km/h • ETA: {row.eta}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleInspectTelemetry(row.id)}
            className="p-1.5 text-gray-600 hover:text-[#1f5400] hover:bg-emerald-50 border border-gray-200"
            title="Inspect Sensor Telemetry"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          {(row.status === 'in_transit' || row.status === 'temp_breach') && (
            <button
              onClick={() =>
                setDiversionModal({
                  isOpen: true,
                  shipment: row,
                  diversionHub: row.nearest_cold_hub || 'Mojo Dry Port Cold Intermodal Terminal',
                  notes: '',
                  isSubmitting: false,
                })
              }
              className="px-2 py-1 text-[11px] font-bold text-red-700 bg-white hover:bg-red-50 border border-red-300"
              title="Emergency Diversion"
            >
              <span>Reroute</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Fleet Telemetry & Cold-Chain Oversight"
        badge={`${metrics.active_trucks} Active Reefers`}
        subtitle="Real-time IoT temperature sensors, refrigerated freight dispatch, and automated diversion routing."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Logistics', href: '/admin/deliveries' },
          { label: 'Fleet & Telemetry', href: '/admin/deliveries' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/logistics/incidents"
              className="px-3 py-1.5 text-xs font-bold text-red-800 bg-red-50 border border-red-200 hover:bg-red-100 flex items-center gap-1.5 shadow-sm"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
              <span>Incidents Docket</span>
            </Link>
            <button
              onClick={() => setDispatchModal((prev) => ({ ...prev, isOpen: true }))}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dispatch Reefer</span>
            </button>
          </div>
        }
      />

      {/* KPI Metric Strip */}
      <div className="px-8 pt-6 pb-2 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-[#007a6c] uppercase tracking-wider">Cold-Chain Compliance</div>
            <div className="text-xl font-bold text-[#1f5400] font-mono mt-1 tabular-nums">
              {metrics.cold_chain_compliance_pct}%
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">SLA Adherence</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Active Reefers in Transit</div>
            <div className="text-xl font-bold text-blue-900 font-mono mt-1 tabular-nums">
              {metrics.active_trucks}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Live IoT Pings</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Optimal Temperature</div>
            <div className="text-xl font-bold text-emerald-900 font-mono mt-1 tabular-nums">
              {metrics.optimal_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">2.0°C – 6.0°C Target</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Temperature Breaches</div>
            <div className="text-xl font-bold text-red-900 font-mono mt-1 tabular-nums">
              {metrics.breached_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Immediate SLA Alert</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Average Fleet Speed</div>
            <div className="text-xl font-bold text-gray-900 font-mono mt-1 tabular-nums">
              {metrics.avg_speed_kmh} km/h
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Expressway Corridors</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Cargo Volume</div>
            <div className="text-lg font-bold text-gray-900 font-mono mt-1 tabular-nums">
              {parseFloat(metrics.active_cargo_weight_kg || 0).toLocaleString()} kg
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Refrigerated Produce</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4">
        {/* State Tabs */}
        <div className="bg-white border border-gray-300 px-4 pt-2 shadow-sm">
          <AdminTabs tabs={tabs} activeTab={tab} onChange={(k) => { setTab(k); setPage(1); }} />
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-gray-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vehicle plate, driver, cargo batch, corridor..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 bg-white font-medium text-gray-800 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/logistics/carriers"
              className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-300 hover:bg-gray-100 flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5 text-gray-600" />
              <span>Carrier Partners</span>
            </Link>
            <Link
              href="/admin/logistics/hubs"
              className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-300 hover:bg-gray-100 flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-gray-600" />
              <span>Cold Storage Depots</span>
            </Link>
          </div>
        </div>

        {/* Fleet Shipments Table */}
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Live Fleet Dispatches ({totalCount})
            </h2>
            <div className="text-[11px] text-gray-500">
              Page {page} of {totalPages}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-[#1f5400] border-t-transparent rounded-full" />
              <p className="text-xs text-gray-500 mt-2 font-mono">Synchronizing telemetry sensors...</p>
            </div>
          ) : shipments.length === 0 ? (
            <div className="py-16 text-center">
              <AdminEmptyState
                icon={<Truck className="w-8 h-8 text-gray-400 mx-auto" />}
                title="No fleet shipments found"
                description="No active refrigerated trucks matched your criteria."
              />
            </div>
          ) : (
            <>
              <AdminTable columns={columns} data={shipments} keyExtractor={(row) => row.id} />
              <div className="p-4 border-t border-gray-200">
                <AdminPagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={15}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Telemetry Inspection Dossier Modal */}
      {telemetryDossier && (
        <AdminModal
          isOpen={Boolean(telemetryDossier)}
          onClose={() => setTelemetryDossier(null)}
          title={`Telemetry Dossier — ${telemetryDossier.vehicle_plate} (${telemetryDossier.id})`}
          description="Live IoT temperature time-series logs, checkpoint readings, and incident diagnostics."
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
              <div className="p-2.5 bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase block">Current Temp</span>
                <span className={`text-base font-bold ${telemetryDossier.compliance_status === 'breached' ? 'text-red-700' : 'text-[#1f5400]'}`}>
                  {parseFloat(telemetryDossier.reefer_temp_celsius).toFixed(1)}°C
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase block">Speed</span>
                <span className="text-base font-bold text-gray-900">{telemetryDossier.speed_kmh} km/h</span>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase block">Driver</span>
                <span className="text-xs font-bold text-gray-800 truncate block">{telemetryDossier.driver_name}</span>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase block">Carrier</span>
                <span className="text-xs font-bold text-[#007a6c] truncate block">{telemetryDossier.carrier_partner}</span>
              </div>
            </div>

            {/* Time-Series Log Readings */}
            <div>
              <h4 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider mb-2">
                Recent Sensor Readings ({telemetryDossier.temperature_logs?.length || 0})
              </h4>
              <div className="border border-gray-300 max-h-44 overflow-y-auto divide-y divide-gray-200 font-mono text-[11px]">
                {telemetryDossier.temperature_logs?.map((log: any) => (
                  <div key={log.id} className="p-2 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{new Date(log.recorded_at).toLocaleTimeString()}</span>
                      <span className="text-gray-800">{log.location_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{log.speed_kmh} km/h</span>
                      <span className={`font-bold ${log.alert_flag ? 'text-red-600' : 'text-[#1f5400]'}`}>
                        {parseFloat(log.temp_celsius).toFixed(1)}°C
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setTelemetryDossier(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Emergency Diversion Modal */}
      {diversionModal.isOpen && diversionModal.shipment && (
        <AdminModal
          isOpen={diversionModal.isOpen}
          onClose={() => setDiversionModal({ isOpen: false, shipment: null, diversionHub: 'Mojo Dry Port Cold Intermodal Terminal', notes: '', isSubmitting: false })}
          title={`Emergency Cold-Chain Diversion — ${diversionModal.shipment.vehicle_plate}`}
          description="Reroute truck to nearest available regional cold storage depot to avoid thermal spoilage."
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 text-red-900 font-mono text-xs">
              <div className="flex justify-between">
                <span>Current Checkpoint:</span>
                <strong className="text-gray-900">{diversionModal.shipment.current_checkpoint}</strong>
              </div>
              <div className="flex justify-between mt-1">
                <span>Recorded Temp:</span>
                <strong className="text-red-700">{parseFloat(diversionModal.shipment.reefer_temp_celsius).toFixed(1)}°C</strong>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Emergency Cold Hub Destination
              </label>
              <select
                value={diversionModal.diversionHub}
                onChange={(e) => setDiversionModal((prev) => ({ ...prev, diversionHub: e.target.value }))}
                className="w-full border border-gray-300 p-2 bg-white text-gray-800 font-medium"
              >
                <option value="Mojo Dry Port Cold Intermodal Terminal">Mojo Dry Port Cold Intermodal Terminal (Addis-Adama Artery)</option>
                <option value="Debre Zeit Cold Hub Depot">Debre Zeit Cold Hub Depot (Bishoftu Valley)</option>
                <option value="Adama Regional Consolidation Hub">Adama Regional Consolidation Hub (East Interchange)</option>
                <option value="Hawassa Agro-Industrial Cold Facility">Hawassa Agro-Industrial Cold Facility (Sidama)</option>
                <option value="Addis Ababa Bole Cargo Depository">Addis Ababa Bole Cargo Depository (Bole Apron)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Carrier & Driver Diversion Notes
              </label>
              <textarea
                rows={3}
                placeholder="State the temperature spike, driver instructions, and emergency depot contact..."
                value={diversionModal.notes}
                onChange={(e) => setDiversionModal((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setDiversionModal({ isOpen: false, shipment: null, diversionHub: 'Mojo Dry Port Cold Intermodal Terminal', notes: '', isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={diversionModal.isSubmitting}
                onClick={handleConfirmDiversion}
                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
              >
                {diversionModal.isSubmitting ? 'Dispatching...' : 'Dispatch Emergency Diversion'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* New Dispatch Modal */}
      {dispatchModal.isOpen && (
        <AdminModal
          isOpen={dispatchModal.isOpen}
          onClose={() => setDispatchModal((prev) => ({ ...prev, isOpen: false }))}
          title="Dispatch Refrigerated Produce Shipment"
          description="Initiate cold-chain transport consignment with target temperature boundaries and GPS telemetry."
        >
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Vehicle Plate #</label>
                <input
                  type="text"
                  value={dispatchModal.vehicle_plate}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, vehicle_plate: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Carrier Partner</label>
                <select
                  value={dispatchModal.carrier_partner}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, carrier_partner: e.target.value }))}
                  className="w-full border border-gray-300 p-2 bg-white"
                >
                  <option value="Ethio Cold-Chain Logistics">Ethio Cold-Chain Logistics</option>
                  <option value="Abyssinia Agro-Freight">Abyssinia Agro-Freight</option>
                  <option value="Rift Valley Reefer Transport">Rift Valley Reefer Transport</option>
                  <option value="Awash Agro-Fleet Logistics">Awash Agro-Fleet Logistics</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Driver Name</label>
                <input
                  type="text"
                  value={dispatchModal.driver_name}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, driver_name: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Driver Phone</label>
                <input
                  type="text"
                  value={dispatchModal.driver_phone}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, driver_phone: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Origin Cold Hub</label>
                <input
                  type="text"
                  value={dispatchModal.origin_hub}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, origin_hub: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Destination Hub</label>
                <input
                  type="text"
                  value={dispatchModal.destination_hub}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, destination_hub: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Current (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={dispatchModal.reefer_temp_celsius}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, reefer_temp_celsius: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-bold text-[#1f5400]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Min Target (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={dispatchModal.target_temp_min}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, target_temp_min: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Max Target (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={dispatchModal.target_temp_max}
                  onChange={(e) => setDispatchModal((prev) => ({ ...prev, target_temp_max: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setDispatchModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={dispatchModal.isSubmitting}
                onClick={handleCreateDispatch}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50"
              >
                {dispatchModal.isSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

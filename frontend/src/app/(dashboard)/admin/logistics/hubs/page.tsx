'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Building2,
  Phone,
  ThermometerSnowflake,
  SlidersHorizontal,
  Layers,
  Boxes,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminTable,
  AdminEmptyState,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminLogisticsHubsPage() {
  const { showToast } = useToast();
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Hub Modal
  const [hubModal, setHubModal] = useState<{
    isOpen: boolean;
    hub: any | null;
    name: string;
    code: string;
    region: string;
    city: string;
    address: string;
    hub_type: string;
    cold_storage_capacity_m3: string;
    current_utilization_pct: string;
    temp_zone_min: string;
    temp_zone_max: string;
    manager_name: string;
    manager_phone: string;
    is_operational: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    hub: null,
    name: '',
    code: '',
    region: 'Oromia',
    city: 'Adama',
    address: '',
    hub_type: 'cold_storage_depot',
    cold_storage_capacity_m3: '1500',
    current_utilization_pct: '65',
    temp_zone_min: '0.0',
    temp_zone_max: '4.0',
    manager_name: '',
    manager_phone: '+251 91 100 0000',
    is_operational: true,
    isSubmitting: false,
  });

  const fetchHubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminHubs({
        region: regionFilter === 'all' ? undefined : regionFilter,
        hub_type: typeFilter === 'all' ? undefined : typeFilter,
        search: search.trim() || undefined,
      });

      if (res) {
        setHubs(res.hubs || []);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch logistics hubs', 'error');
    } finally {
      setLoading(false);
    }
  }, [regionFilter, typeFilter, search, showToast]);

  useEffect(() => {
    fetchHubs();
  }, [fetchHubs]);

  const handleSaveHub = async () => {
    if (!hubModal.name.trim() || !hubModal.city.trim() || !hubModal.address.trim()) {
      showToast('Hub name, city, and physical address are required', 'error');
      return;
    }

    setHubModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await api.upsertAdminHub({
        id: hubModal.hub?.id,
        name: hubModal.name.trim(),
        code: hubModal.code.trim().toUpperCase() || undefined,
        region: hubModal.region,
        city: hubModal.city.trim(),
        address: hubModal.address.trim(),
        hub_type: hubModal.hub_type,
        cold_storage_capacity_m3: parseFloat(hubModal.cold_storage_capacity_m3) || 500,
        current_utilization_pct: parseFloat(hubModal.current_utilization_pct) || 50,
        temp_zone_min: parseFloat(hubModal.temp_zone_min) || 0.0,
        temp_zone_max: parseFloat(hubModal.temp_zone_max) || 4.0,
        manager_name: hubModal.manager_name.trim(),
        manager_phone: hubModal.manager_phone.trim(),
        is_operational: hubModal.is_operational,
      });

      showToast('Logistics hub saved successfully', 'success');
      setHubModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
      fetchHubs();
    } catch (err: any) {
      showToast(err.message || 'Failed to save hub', 'error');
      setHubModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const columns = [
    {
      header: 'Hub Code & Name',
      accessor: (row: any) => (
        <div>
          <div className="font-bold text-gray-900 flex items-center gap-2">
            <span>{row.name}</span>
            <span className="font-mono text-[10px] text-gray-500 bg-gray-100 border border-gray-300 px-1.5 py-0.2">
              {row.code}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{row.address}</div>
        </div>
      ),
    },
    {
      header: 'Facility Type',
      accessor: (row: any) => (
        <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200 uppercase font-mono">
          {row.hub_type?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Region & City',
      accessor: (row: any) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-800">{row.city}</div>
          <div className="text-gray-500 text-[11px]">{row.region}</div>
        </div>
      ),
    },
    {
      header: 'Cold Storage Volume',
      accessor: (row: any) => (
        <div className="font-mono text-xs">
          <div className="font-bold text-gray-900">
            {parseFloat(row.cold_storage_capacity_m3).toLocaleString()} m³
          </div>
          <div className="text-[10px] text-gray-500">
            Utilized: {parseFloat(row.utilized_m3 || 0).toLocaleString()} m³
          </div>
        </div>
      ),
    },
    {
      header: 'Capacity Utilization',
      accessor: (row: any) => {
        const pct = parseFloat(row.current_utilization_pct || 50);
        return (
          <div className="w-32 space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="font-bold text-gray-800">{pct.toFixed(1)}%</span>
              <span className="text-gray-400">Full</span>
            </div>
            <div className="w-full bg-gray-200 h-1.5 rounded-none overflow-hidden">
              <div
                className={`h-full ${
                  pct > 85 ? 'bg-red-600' : pct > 70 ? 'bg-amber-600' : 'bg-[#1f5400]'
                }`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Temp Zone Bounds',
      accessor: (row: any) => (
        <div className="font-mono text-xs text-right">
          <div className="font-bold text-[#1f5400] inline-flex items-center gap-1">
            <ThermometerSnowflake className="w-3 h-3" />
            <span>{row.temp_zone_min}°C – {row.temp_zone_max}°C</span>
          </div>
          <div className="text-[10px] text-gray-400">Chilled Canopy</div>
        </div>
      ),
    },
    {
      header: 'Facility Manager',
      accessor: (row: any) => (
        <div className="text-xs">
          <div className="font-medium text-gray-900">{row.manager_name || 'Site Supervisor'}</div>
          <div className="text-gray-500 font-mono text-[11px]">{row.manager_phone}</div>
        </div>
      ),
    },
    {
      header: 'State',
      accessor: (row: any) => (
        <span
          className={`inline-block px-2 py-0.5 text-[10px] font-bold border tabular-nums ${
            row.is_operational
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}
        >
          {row.is_operational ? 'OPERATIONAL' : 'MAINTENANCE'}
        </span>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      accessor: (row: any) => (
        <button
          onClick={() => {
            setHubModal({
              isOpen: true,
              hub: row,
              name: row.name,
              code: row.code,
              region: row.region,
              city: row.city,
              address: row.address,
              hub_type: row.hub_type,
              cold_storage_capacity_m3: String(row.cold_storage_capacity_m3),
              current_utilization_pct: String(row.current_utilization_pct),
              temp_zone_min: String(row.temp_zone_min),
              temp_zone_max: String(row.temp_zone_max),
              manager_name: row.manager_name || '',
              manager_phone: row.manager_phone || '',
              is_operational: Boolean(row.is_operational),
              isSubmitting: false,
            });
          }}
          className="px-2 py-1 text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 flex items-center gap-1 ml-auto"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Configure</span>
        </button>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Regional Cold Storage Hubs & Depots"
        badge={`${hubs.length} Active Nodes`}
        subtitle="Consolidation points, dry port refrigerated aprons, and multi-temperature cold storage nodes across Ethiopia."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Logistics', href: '/admin/deliveries' },
          { label: 'Hubs', href: '/admin/logistics/hubs' },
        ]}
        actions={
          <button
            onClick={() =>
              setHubModal({
                isOpen: true,
                hub: null,
                name: '',
                code: `HUB-ETH-${Math.floor(10 + Math.random() * 90)}`,
                region: 'Oromia',
                city: '',
                address: '',
                hub_type: 'cold_storage_depot',
                cold_storage_capacity_m3: '1500',
                current_utilization_pct: '60',
                temp_zone_min: '0.0',
                temp_zone_max: '4.0',
                manager_name: '',
                manager_phone: '+251 91 100 0000',
                is_operational: true,
                isSubmitting: false,
              })
            }
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Cold Storage Node</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {/* Toolbar & Filters */}
        <div className="bg-white border border-gray-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search hub name, code, city, region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 bg-white font-medium text-gray-800 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-500 uppercase text-[10px]">Region:</span>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="text-xs border border-gray-300 px-2 py-1.5 bg-white text-gray-800"
              >
                <option value="all">All Regions</option>
                <option value="Addis Ababa">Addis Ababa</option>
                <option value="Oromia">Oromia</option>
                <option value="Sidama">Sidama</option>
                <option value="Amhara">Amhara</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-500 uppercase text-[10px]">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs border border-gray-300 px-2 py-1.5 bg-white text-gray-800"
              >
                <option value="all">All Facility Types</option>
                <option value="cold_storage_depot">Cold Storage Depot</option>
                <option value="dry_port">Dry Port Intermodal</option>
                <option value="central_distribution_center">Central Distribution Center</option>
                <option value="farm_gate_hub">Farm Gate Consolidation</option>
              </select>
            </div>
          </div>
        </div>

        {/* Hubs Table */}
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Cold-Chain Infrastructure Directory ({hubs.length})
            </h2>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-[#1f5400] border-t-transparent rounded-full" />
              <p className="text-xs text-gray-500 mt-2 font-mono">Loading depot capacities...</p>
            </div>
          ) : hubs.length === 0 ? (
            <div className="py-16 text-center">
              <AdminEmptyState
                icon={<MapPin className="w-8 h-8 text-gray-400 mx-auto" />}
                title="No storage hubs found"
                description="No regional facilities matched the selected filters."
              />
            </div>
          ) : (
            <AdminTable columns={columns} data={hubs} keyExtractor={(row) => row.id} />
          )}
        </div>
      </div>

      {/* Upsert Hub Modal */}
      {hubModal.isOpen && (
        <AdminModal
          isOpen={hubModal.isOpen}
          onClose={() => setHubModal((prev) => ({ ...prev, isOpen: false }))}
          title={hubModal.hub ? `Configure Facility — ${hubModal.hub.name}` : 'Provision New Cold Storage Facility'}
          description="Register cold-chain infrastructure node with volumetric capacity and temperature thresholds."
        >
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Facility Name</label>
                <input
                  type="text"
                  placeholder="e.g. Adama Agro-Cold Depot"
                  value={hubModal.name}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Hub Code</label>
                <input
                  type="text"
                  placeholder="e.g. HUB-ADA-01"
                  value={hubModal.code}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, code: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Region</label>
                <select
                  value={hubModal.region}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, region: e.target.value }))}
                  className="w-full border border-gray-300 p-2 bg-white"
                >
                  <option value="Oromia">Oromia</option>
                  <option value="Addis Ababa">Addis Ababa</option>
                  <option value="Sidama">Sidama</option>
                  <option value="Amhara">Amhara</option>
                  <option value="Afar">Afar</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">City / Town</label>
                <input
                  type="text"
                  value={hubModal.city}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, city: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Hub Classification</label>
                <select
                  value={hubModal.hub_type}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, hub_type: e.target.value }))}
                  className="w-full border border-gray-300 p-2 bg-white"
                >
                  <option value="cold_storage_depot">Cold Storage Depot</option>
                  <option value="dry_port">Dry Port Apron</option>
                  <option value="central_distribution_center">Central Distribution</option>
                  <option value="farm_gate_hub">Farm Gate Node</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Physical Address</label>
              <input
                type="text"
                placeholder="Expressway Km 24 Agro-Park"
                value={hubModal.address}
                onChange={(e) => setHubModal((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full border border-gray-300 p-2"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 font-mono">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Capacity (m³)</label>
                <input
                  type="number"
                  value={hubModal.cold_storage_capacity_m3}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, cold_storage_capacity_m3: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Utilized (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={hubModal.current_utilization_pct}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, current_utilization_pct: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Min (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={hubModal.temp_zone_min}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, temp_zone_min: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Max (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={hubModal.temp_zone_max}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, temp_zone_max: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Depot Manager</label>
                <input
                  type="text"
                  value={hubModal.manager_name}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, manager_name: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Manager Phone</label>
                <input
                  type="text"
                  value={hubModal.manager_phone}
                  onChange={(e) => setHubModal((prev) => ({ ...prev, manager_phone: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isOperational"
                checked={hubModal.is_operational}
                onChange={(e) => setHubModal((prev) => ({ ...prev, is_operational: e.target.checked }))}
              />
              <label htmlFor="isOperational" className="font-semibold text-gray-800 cursor-pointer">
                Facility Operational & Accepting Cargo
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setHubModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={hubModal.isSubmitting}
                onClick={handleSaveHub}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50"
              >
                {hubModal.isSubmitting ? 'Saving...' : 'Save Facility Node'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}


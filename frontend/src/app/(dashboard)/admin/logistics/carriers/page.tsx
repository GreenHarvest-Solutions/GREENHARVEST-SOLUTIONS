'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  SlidersHorizontal,
  Award,
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

export default function AdminCarriersPage() {
  const { showToast } = useToast();
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Carrier Modal
  const [carrierModal, setCarrierModal] = useState<{
    isOpen: boolean;
    carrier: any | null;
    name: string;
    code: string;
    contact_person: string;
    phone: string;
    email: string;
    status: string;
    total_fleet_count: string;
    cold_chain_sla_score: string;
    coverage_regions: string;
    notes: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    carrier: null,
    name: '',
    code: '',
    contact_person: '',
    phone: '',
    email: '',
    status: 'active',
    total_fleet_count: '15',
    cold_chain_sla_score: '98.5',
    coverage_regions: 'Oromia, Addis Ababa, Sidama',
    notes: '',
    isSubmitting: false,
  });

  const fetchCarriers = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const res = await api.getAdminCarriers({
        status: statusParam,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setCarriers(res.carriers || []);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch carrier registry', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, search, page, showToast]);

  useEffect(() => {
    fetchCarriers();
  }, [fetchCarriers]);

  const handleSaveCarrier = async () => {
    if (!carrierModal.name.trim() || !carrierModal.code.trim() || !carrierModal.phone.trim()) {
      showToast('Name, carrier code, and emergency contact phone are required', 'error');
      return;
    }

    setCarrierModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const regions = carrierModal.coverage_regions
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      if (carrierModal.carrier?.id) {
        await api.updateAdminCarrier(carrierModal.carrier.id, {
          name: carrierModal.name.trim(),
          contact_person: carrierModal.contact_person.trim(),
          phone: carrierModal.phone.trim(),
          email: carrierModal.email.trim(),
          status: carrierModal.status,
          total_fleet_count: parseInt(carrierModal.total_fleet_count) || 0,
          cold_chain_sla_score: parseFloat(carrierModal.cold_chain_sla_score) || 98.5,
          notes: carrierModal.notes.trim(),
        });
        showToast('Carrier partner updated successfully', 'success');
      } else {
        await api.createAdminCarrier({
          name: carrierModal.name.trim(),
          code: carrierModal.code.trim().toUpperCase(),
          contact_person: carrierModal.contact_person.trim(),
          phone: carrierModal.phone.trim(),
          email: carrierModal.email.trim(),
          status: carrierModal.status,
          total_fleet_count: parseInt(carrierModal.total_fleet_count) || 0,
          cold_chain_sla_score: parseFloat(carrierModal.cold_chain_sla_score) || 98.5,
          coverage_regions: regions,
          notes: carrierModal.notes.trim(),
        });
        showToast('New freight carrier onboarded successfully', 'success');
      }

      setCarrierModal({
        isOpen: false,
        carrier: null,
        name: '',
        code: '',
        contact_person: '',
        phone: '',
        email: '',
        status: 'active',
        total_fleet_count: '15',
        cold_chain_sla_score: '98.5',
        coverage_regions: 'Oromia, Addis Ababa, Sidama',
        notes: '',
        isSubmitting: false,
      });
      fetchCarriers();
    } catch (err: any) {
      showToast(err.message || 'Failed to save carrier', 'error');
      setCarrierModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const tabs = [
    { key: 'all', label: 'All Carriers', count: totalCount },
    { key: 'active', label: 'Certified Active' },
    { key: 'under_review', label: 'Under SLA Review' },
    { key: 'suspended', label: 'Suspended' },
  ];

  const columns = [
    {
      header: 'Carrier Code & Name',
      accessor: (row: any) => (
        <div>
          <div className="font-bold text-gray-900 flex items-center gap-2">
            <span>{row.name}</span>
            <span className="font-mono text-[10px] text-gray-500 bg-gray-100 border border-gray-300 px-1.5 py-0.2">
              {row.code}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{row.notes || 'Refrigerated agro-logistics contractor'}</div>
        </div>
      ),
    },
    {
      header: 'Operations Contact',
      accessor: (row: any) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-800">{row.contact_person || 'Dispatch Center'}</div>
          <div className="text-gray-500 font-mono text-[11px]">{row.phone}</div>
          <div className="text-gray-400 font-mono text-[10px]">{row.email || 'dispatch@carrier.et'}</div>
        </div>
      ),
    },
    {
      header: 'Fleet Size',
      accessor: (row: any) => (
        <div className="font-mono text-xs">
          <div className="font-bold text-gray-900">{row.total_fleet_count} Reefers</div>
          <div className="text-[10px] text-[#007a6c]">{row.active_shipments || 0} active in transit</div>
        </div>
      ),
    },
    {
      header: 'Cold-Chain SLA Score',
      accessor: (row: any) => {
        const score = parseFloat(row.cold_chain_sla_score || 98.5);
        return (
          <div className="font-mono text-xs">
            <span
              className={`font-bold inline-flex items-center gap-1 ${
                score >= 98.0
                  ? 'text-[#1f5400]'
                  : score >= 95.0
                  ? 'text-amber-800'
                  : 'text-red-700'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>{score.toFixed(1)}%</span>
            </span>
            <div className="text-[10px] text-gray-500">Benchmark: 98.0%</div>
          </div>
        );
      },
    },
    {
      header: 'Corridor Coverage',
      accessor: (row: any) => {
        const regions = Array.isArray(row.coverage_regions) ? row.coverage_regions : [];
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {regions.map((reg: string, idx: number) => (
              <span
                key={idx}
                className="px-1.5 py-0.2 text-[10px] bg-gray-100 text-gray-700 border border-gray-200"
              >
                {reg}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      header: 'Contract State',
      accessor: (row: any) => {
        const s = row.status;
        return (
          <span
            className={`inline-block px-2 py-0.5 text-[11px] font-bold border tabular-nums ${
              s === 'active'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : s === 'under_review'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-red-50 text-red-800 border-red-300'
            }`}
          >
            {s ? s.replace('_', ' ').toUpperCase() : 'ACTIVE'}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              const regStr = Array.isArray(row.coverage_regions) ? row.coverage_regions.join(', ') : 'Oromia, Addis Ababa';
              setCarrierModal({
                isOpen: true,
                carrier: row,
                name: row.name,
                code: row.code,
                contact_person: row.contact_person || '',
                phone: row.phone || '',
                email: row.email || '',
                status: row.status || 'active',
                total_fleet_count: String(row.total_fleet_count || 15),
                cold_chain_sla_score: String(row.cold_chain_sla_score || 98.5),
                coverage_regions: regStr,
                notes: row.notes || '',
                isSubmitting: false,
              });
            }}
            className="px-2 py-1 text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Freight Carriers & Cold-Chain Fleet Registry"
        badge={`${totalCount} Certified Carriers`}
        subtitle="Manage logistics partners, fleet capacities, certified temperature SLA performance, and regional corridor contracts."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Logistics', href: '/admin/deliveries' },
          { label: 'Carriers', href: '/admin/logistics/carriers' },
        ]}
        actions={
          <button
            onClick={() =>
              setCarrierModal({
                isOpen: true,
                carrier: null,
                name: '',
                code: `AAF-0${totalCount + 1}`,
                contact_person: '',
                phone: '+251 91 100 0000',
                email: '',
                status: 'active',
                total_fleet_count: '15',
                cold_chain_sla_score: '98.5',
                coverage_regions: 'Oromia, Addis Ababa, Sidama',
                notes: '',
                isSubmitting: false,
              })
            }
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Onboard Carrier</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {/* State Tabs */}
        <div className="bg-white border border-gray-300 px-4 pt-2 shadow-sm">
          <AdminTabs tabs={tabs} activeTab={tab} onChange={(k) => { setTab(k); setPage(1); }} />
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-gray-300 p-4 shadow-sm flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search carrier name, code, contact person, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 bg-white font-medium text-gray-800 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="text-xs text-gray-500 font-mono">
            Mandatory Cold-Chain SLA Floor: <strong className="text-[#1f5400]">98.0% Compliance</strong>
          </div>
        </div>

        {/* Carriers Table */}
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Carrier Logistics Fleet Directory ({totalCount})
            </h2>
            <div className="text-[11px] text-gray-500">
              Page {page} of {totalPages}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-[#1f5400] border-t-transparent rounded-full" />
              <p className="text-xs text-gray-500 mt-2 font-mono">Querying carrier partner registries...</p>
            </div>
          ) : carriers.length === 0 ? (
            <div className="py-16 text-center">
              <AdminEmptyState
                icon={<Truck className="w-8 h-8 text-gray-400 mx-auto" />}
                title="No carrier partners found"
                description="No freight contractors matched the search or status filter."
              />
            </div>
          ) : (
            <>
              <AdminTable columns={columns} data={carriers} keyExtractor={(row) => row.id} />
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

      {/* Onboard / Edit Carrier Modal */}
      {carrierModal.isOpen && (
        <AdminModal
          isOpen={carrierModal.isOpen}
          onClose={() => setCarrierModal((prev) => ({ ...prev, isOpen: false }))}
          title={carrierModal.carrier ? `Edit Carrier — ${carrierModal.carrier.name}` : 'Onboard Refrigerated Freight Carrier'}
          description="Register certified agricultural cold-chain carrier with fleet specifications and SLA terms."
        >
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Abyssinia Agro-Freight"
                  value={carrierModal.name}
                  onChange={(e) => setCarrierModal((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Carrier Code</label>
                <input
                  type="text"
                  placeholder="e.g. AAF-01"
                  value={carrierModal.code}
                  onChange={(e) => setCarrierModal((prev) => ({ ...prev, code: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="Operations Manager"
                  value={carrierModal.contact_person}
                  onChange={(e) => setCarrierModal((prev) => ({ ...prev, contact_person: e.target.value }))}
                  className="w-full border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Emergency Dispatch Phone</label>
                <input
                  type="text"
                  placeholder="+251 91 123 4567"
                  value={carrierModal.phone}
                  onChange={(e) => setCarrierModal((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Total Fleet (Reefers)</label>
                <input
                  type="number"
                  min="1"
                  value={carrierModal.total_fleet_count}
                  onChange={(e) => setCarrierModal((prev) => ({ ...prev, total_fleet_count: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Cold SLA Score (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="100"
                  value={carrierModal.cold_chain_sla_score}
                  onChange={(e) => setCarrierModal((prev) => ({ ...prev, cold_chain_sla_score: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-bold text-[#1f5400]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Contract Status</label>
                <select
                  value={carrierModal.status}
                  onChange={(e) => setCarrierModal((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-gray-300 p-2 bg-white"
                >
                  <option value="active">Active Certified</option>
                  <option value="under_review">Under Review</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Coverage Regions (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="Oromia, Addis Ababa, Sidama, Amhara"
                value={carrierModal.coverage_regions}
                onChange={(e) => setCarrierModal((prev) => ({ ...prev, coverage_regions: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">Contract Notes / SLA Specifications</label>
              <textarea
                rows={2}
                placeholder="IoT sensor calibration intervals, reefer temperature guarantee..."
                value={carrierModal.notes}
                onChange={(e) => setCarrierModal((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setCarrierModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={carrierModal.isSubmitting}
                onClick={handleSaveCarrier}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50"
              >
                {carrierModal.isSubmitting ? 'Saving...' : 'Save Carrier'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}


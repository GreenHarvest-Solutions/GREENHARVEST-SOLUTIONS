'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RotateCcw,
  Search,
  Truck,
  PackageCheck,
  PackageX,
  Clock,
  ArrowRight,
  Boxes,
  MapPin,
  CheckCircle,
  AlertTriangle,
  SlidersHorizontal,
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

export default function AdminReturnsPage() {
  const { showToast } = useToast();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Status & Restock Intake Modal
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    returnRecord: any | null;
    status: string;
    restockQuantity: string;
    notes: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    returnRecord: null,
    status: 'received',
    restockQuantity: '0',
    notes: '',
    isSubmitting: false,
  });

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const res = await api.getAdminReturns({
        status: statusParam,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setReturns(res.returns || []);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch reverse logistics shipments', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, search, page, showToast]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleUpdateStatus = async () => {
    if (!statusModal.returnRecord) return;
    setStatusModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.updateAdminReturnStatus(statusModal.returnRecord.id, {
        status: statusModal.status,
        restock_quantity: parseInt(statusModal.restockQuantity) || 0,
        notes: statusModal.notes.trim() || undefined,
      });
      showToast(res.message || 'Return shipment status updated successfully', 'success');
      setStatusModal({ isOpen: false, returnRecord: null, status: 'received', restockQuantity: '0', notes: '', isSubmitting: false });
      fetchReturns();
    } catch (err: any) {
      showToast(err.message || 'Failed to update return status', 'error');
      setStatusModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const tabs = [
    { key: 'all', label: 'All Reverse Consignments', count: totalCount },
    { key: 'pending', label: 'In Transit / Reverse Route' },
    { key: 'received', label: 'Depot Intake (Received)' },
    { key: 'restocked', label: 'Restocked into Inventory' },
    { key: 'rejected', label: 'Discarded / Spoilage Dump' },
  ];

  const columns = [
    {
      header: 'Reverse Tracking #',
      accessor: (row: any) => (
        <div>
          <div className="font-mono font-bold text-gray-900">{row.tracking_number}</div>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Truck className="w-2.5 h-2.5 text-gray-400" />
            <span>{row.carrier_name || 'Agro Carrier'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Consignment #',
      accessor: (row: any) => (
        <div>
          <Link
            href={`/admin/orders/${row.order_id}`}
            className="font-mono font-bold text-[#1f5400] hover:underline flex items-center gap-1"
          >
            <span>Order #{row.order_id}</span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </Link>
          <div className="text-[10px] text-gray-500 font-mono">
            ETB {parseFloat(row.order_total || 0).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      header: 'Return Category & Reason',
      accessor: (row: any) => (
        <div className="max-w-[260px]">
          <span className="inline-block px-1.5 py-0.2 text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300 uppercase mb-1">
            {row.dispute_category?.replace('_', ' ')}
          </span>
          <div className="text-gray-900 text-xs truncate" title={row.reason}>
            &quot;{row.reason}&quot;
          </div>
        </div>
      ),
    },
    {
      header: 'Commercial Buyer',
      accessor: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.buyer_name || 'Buyer'}</div>
          <div className="text-[11px] text-gray-500 font-mono">{row.buyer_phone || 'No phone'}</div>
        </div>
      ),
    },
    {
      header: 'Producer Destination',
      accessor: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.farmer_name || 'Producer'}</div>
          <div className="text-[11px] text-gray-500 font-mono">{row.farmer_phone || 'No phone'}</div>
        </div>
      ),
    },
    {
      header: 'Restock Balance',
      accessor: (row: any) => (
        <div className="font-mono text-xs">
          {row.restock_quantity > 0 ? (
            <span className="font-bold text-[#1f5400] flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5" />
              <span>+{row.restock_quantity} Units</span>
            </span>
          ) : (
            <span className="text-gray-400">0 Units Restocked</span>
          )}
        </div>
      ),
    },
    {
      header: 'Depot Status',
      accessor: (row: any) => {
        const s = row.status;
        let color = 'bg-gray-100 text-gray-700 border-gray-300';
        if (s === 'received') color = 'bg-blue-50 text-blue-900 border-blue-300';
        else if (s === 'restocked') color = 'bg-emerald-50 text-emerald-800 border-emerald-300';
        else if (s === 'rejected') color = 'bg-red-50 text-red-800 border-red-300';
        else if (s === 'pending') color = 'bg-amber-50 text-amber-900 border-amber-300';

        return (
          <span className={`inline-block px-2 py-0.5 text-[11px] font-bold border tabular-nums ${color}`}>
            {s === 'pending' ? 'IN TRANSIT' : s.toUpperCase()}
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
            onClick={() =>
              setStatusModal({
                isOpen: true,
                returnRecord: row,
                status: row.status === 'pending' ? 'received' : row.status,
                restockQuantity: String(row.restock_quantity || 0),
                notes: '',
                isSubmitting: false,
              })
            }
            className="px-2 py-1 text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Intake / Restock</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Reverse Logistics & Return Shipments Tracking"
        badge={`${totalCount} Return Shipments`}
        subtitle="Tracking rejected consignments, warehouse depot physical intake, and restock reconciliation."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Commerce', href: '/admin/orders' },
          { label: 'Returns', href: '/admin/returns' },
        ]}
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
              placeholder="Search return tracking #, order #, buyer, carrier..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 bg-white font-medium text-gray-800 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="text-xs text-gray-500 font-mono">
            Agro-Carrier Depot Hubs: <strong className="text-gray-800">Adama, Hawassa, Bahir Dar</strong>
          </div>
        </div>

        {/* Returns Table */}
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Reverse Consignment Docket ({totalCount})
            </h2>
            <div className="text-[11px] text-gray-500">
              Page {page} of {totalPages}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-[#1f5400] border-t-transparent rounded-full" />
              <p className="text-xs text-gray-500 mt-2 font-mono">Loading return freight dockets...</p>
            </div>
          ) : returns.length === 0 ? (
            <div className="py-16 text-center">
              <AdminEmptyState
                icon={<RotateCcw className="w-8 h-8 text-gray-400 mx-auto" />}
                title="No return shipments found"
                description="No reverse logistics consignments matched the selected filters."
              />
            </div>
          ) : (
            <>
              <AdminTable columns={columns} data={returns} keyExtractor={(row) => row.id} />
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

      {/* Intake / Restock Modal */}
      {statusModal.isOpen && statusModal.returnRecord && (
        <AdminModal
          isOpen={statusModal.isOpen}
          onClose={() => setStatusModal({ isOpen: false, returnRecord: null, status: 'received', restockQuantity: '0', notes: '', isSubmitting: false })}
          title={`Depot Intake & Restock — ${statusModal.returnRecord.tracking_number}`}
          description="Log warehouse intake inspection and adjust restocked inventory count."
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-gray-50 border border-gray-200 font-mono text-xs">
              <div className="flex justify-between">
                <span>Associated Consignment:</span>
                <strong>Order #{statusModal.returnRecord.order_id}</strong>
              </div>
              <div className="flex justify-between mt-1">
                <span>Discrepancy Category:</span>
                <span className="uppercase">{statusModal.returnRecord.dispute_category}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Depot Warehouse Physical Status
              </label>
              <select
                value={statusModal.status}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full border border-gray-300 p-2 bg-white text-gray-800 font-medium"
              >
                <option value="pending">In Transit (Reverse Route)</option>
                <option value="received">Received at Depot (Inspection Underway)</option>
                <option value="restocked">Restocked into Inventory (Sellable Stock)</option>
                <option value="rejected">Discarded / Non-Restockable Spoilage</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Restocked Usable Quantity (Units)
              </label>
              <input
                type="number"
                min="0"
                value={statusModal.restockQuantity}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, restockQuantity: e.target.value }))}
                className="w-full border border-gray-300 p-2 font-mono text-gray-900 font-bold"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                Number of certified undamaged units returned to the regional cold-room inventory.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Warehouse Intake Inspector Notes
              </label>
              <textarea
                rows={3}
                placeholder="Pallet condition, temperature upon arrival at depot, bin assignment..."
                value={statusModal.notes}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setStatusModal({ isOpen: false, returnRecord: null, status: 'received', restockQuantity: '0', notes: '', isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusModal.isSubmitting}
                onClick={handleUpdateStatus}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50"
              >
                {statusModal.isSubmitting ? 'Recording...' : 'Commit Depot Log'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}


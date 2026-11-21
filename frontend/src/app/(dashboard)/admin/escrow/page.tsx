'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Scale,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Snowflake,
  Lock,
  Unlock,
  Check,
  RotateCcw,
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

export default function AdminEscrowClearinghousePage() {
  const { showToast } = useToast();
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<any>({
    total_records: 0,
    held_count: 0,
    cleared_count: 0,
    disputed_count: 0,
    refunded_count: 0,
    total_held_amount: '0.00',
    total_cleared_payout: '0.00',
    total_platform_fees: '0.00',
  });

  // Release Modal
  const [releaseModal, setReleaseModal] = useState<{
    isOpen: boolean;
    escrow: any | null;
    notes: string;
    makerCheckerApproved: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    escrow: null,
    notes: '',
    makerCheckerApproved: true,
    isSubmitting: false,
  });

  // Emergency Freeze Modal
  const [freezeModal, setFreezeModal] = useState<{
    isOpen: boolean;
    escrow: any | null;
    reason: string;
    holdDays: number;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    escrow: null,
    reason: '',
    holdDays: 14,
    isSubmitting: false,
  });

  const fetchEscrow = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const res = await api.getAdminActiveEscrow({
        release_status: statusParam,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setLedger(res.ledger || []);
        if (res.metrics) setMetrics(res.metrics);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load escrow clearinghouse', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, search, page, showToast]);

  useEffect(() => {
    fetchEscrow();
  }, [fetchEscrow]);

  const handleRelease = async () => {
    if (!releaseModal.escrow) return;
    setReleaseModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.releaseAdminEscrow(releaseModal.escrow.id, {
        notes: releaseModal.notes.trim() || 'Disbursement released from clearinghouse desk',
        makerCheckerApproved: releaseModal.makerCheckerApproved,
      });
      showToast(res.message || 'Escrow funds disbursed successfully', 'success');
      setReleaseModal({ isOpen: false, escrow: null, notes: '', makerCheckerApproved: true, isSubmitting: false });
      fetchEscrow();
    } catch (err: any) {
      showToast(err.message || 'Escrow release failed', 'error');
      setReleaseModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleFreeze = async () => {
    if (!freezeModal.escrow) return;
    if (!freezeModal.reason.trim()) {
      showToast('A mandatory freeze justification is required', 'error');
      return;
    }

    setFreezeModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.holdAdminEscrow(freezeModal.escrow.id, {
        reason: freezeModal.reason.trim(),
        holdDays: freezeModal.holdDays,
      });
      showToast(res.message || 'Escrow hold frozen successfully', 'success');
      setFreezeModal({ isOpen: false, escrow: null, reason: '', holdDays: 14, isSubmitting: false });
      fetchEscrow();
    } catch (err: any) {
      showToast(err.message || 'Freeze hold failed', 'error');
      setFreezeModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const tabs = [
    { key: 'all', label: 'All Ledgers', count: metrics.total_records },
    { key: 'held', label: 'Active Holds', count: metrics.held_count },
    { key: 'disputed', label: 'Disputed / Frozen', count: metrics.disputed_count },
    { key: 'cleared', label: 'Cleared & Disbursed', count: metrics.cleared_count },
    { key: 'refunded', label: 'Refunded / Adjusted', count: metrics.refunded_count },
  ];

  const formatCountdown = (holdUntilStr: string | null) => {
    if (!holdUntilStr) return 'Ready to clear';
    const now = new Date().getTime();
    const target = new Date(holdUntilStr).getTime();
    const diff = target - now;

    if (diff <= 0) return 'Inspection window cleared';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    return `${hours}h remaining`;
  };

  const columns = [
    {
      header: 'Escrow ID',
      accessor: (row: any) => (
        <div>
          <span className="font-mono font-bold text-gray-900">ESC-#{row.id}</span>
          <div className="text-[11px] text-gray-500 font-mono">
            {new Date(row.created_at).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
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
          <div className="text-[10px] text-gray-500 uppercase">
            {row.delivery_status || 'DELIVERY PENDING'}
          </div>
        </div>
      ),
    },
    {
      header: 'Agricultural Producer',
      accessor: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.farmer_name || 'Producer'}</div>
          <div className="text-[11px] text-gray-500 font-mono">{row.farmer_phone || 'No phone'}</div>
        </div>
      ),
    },
    {
      header: 'Commercial Buyer',
      accessor: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.buyer_name || 'Buyer'}</div>
          <div className="text-[11px] text-gray-500">{row.buyer_email || 'Commercial Trade'}</div>
        </div>
      ),
    },
    {
      header: 'Held Principal',
      accessor: (row: any) => (
        <div className="text-right font-mono">
          <div className="font-bold text-gray-900 tabular-nums">
            ETB {parseFloat(row.escrow_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-gray-500 tabular-nums">
            Fee: ETB {parseFloat(row.platform_fee_amount).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      header: 'Farmer Payout',
      accessor: (row: any) => (
        <div className="text-right font-mono">
          <div className="font-bold text-[#1f5400] tabular-nums">
            ETB {parseFloat(row.farmer_payout_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          {parseFloat(row.buyer_refund_amount || 0) > 0 && (
            <div className="text-[10px] text-red-600 font-bold tabular-nums">
              Refund: ETB {parseFloat(row.buyer_refund_amount).toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Release Status & Window',
      accessor: (row: any) => {
        const s = row.release_status;
        return (
          <div className="space-y-1">
            <span
              className={`inline-block px-2 py-0.5 text-[11px] font-bold border tabular-nums ${
                s === 'cleared'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : s === 'disputed'
                  ? 'bg-red-50 text-red-800 border-red-300'
                  : s === 'refunded' || s === 'split_settled'
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {s ? s.toUpperCase() : 'HELD'}
            </span>
            {s === 'held' && (
              <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-amber-700" />
                <span>{formatCountdown(row.hold_until)}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.release_status === 'held' && (
            <>
              <button
                onClick={() =>
                  setReleaseModal({
                    isOpen: true,
                    escrow: row,
                    notes: '',
                    makerCheckerApproved: true,
                    isSubmitting: false,
                  })
                }
                className="px-2 py-1 text-[11px] font-bold text-white bg-[#1f5400] hover:bg-[#173e00] flex items-center gap-1"
                title="Authorize Disbursement"
              >
                <Check className="w-3 h-3" />
                <span>Disburse</span>
              </button>

              <button
                onClick={() =>
                  setFreezeModal({
                    isOpen: true,
                    escrow: row,
                    reason: '',
                    holdDays: 14,
                    isSubmitting: false,
                  })
                }
                className="p-1 text-gray-600 hover:text-red-700 border border-gray-200 hover:bg-red-50"
                title="Emergency Freeze"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <Link
            href={`/admin/orders/${row.order_id}`}
            className="p-1 text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-100"
            title="Inspect Dossier"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Escrow Clearinghouse & Payout Settlement"
        badge={`${totalCount} Escrow Ledgers`}
        subtitle="Real-time multi-party escrow clearinghouse, buyer-farmer split balance integrity, and maker-checker disbursements."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Commerce', href: '/admin/orders' },
          { label: 'Escrow', href: '/admin/escrow' },
        ]}
      />

      {/* KPI Metric Strip */}
      <div className="px-8 pt-6 pb-2 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Active Held Balance</div>
            <div className="text-lg font-bold text-amber-900 font-mono mt-1 tabular-nums">
              ETB {parseFloat(metrics.total_held_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Under Inspection</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Disbursed to Farmers</div>
            <div className="text-lg font-bold text-[#1f5400] font-mono mt-1 tabular-nums">
              ETB {parseFloat(metrics.total_cleared_payout || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Paid Out Net</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Retained Platform Fees</div>
            <div className="text-lg font-bold text-blue-900 font-mono mt-1 tabular-nums">
              ETB {parseFloat(metrics.total_platform_fees || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">5% Protocol Fee</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Holds</div>
            <div className="text-xl font-bold text-gray-900 font-mono mt-1 tabular-nums">
              {metrics.held_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Consignments</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Disputed Escrows</div>
            <div className="text-xl font-bold text-red-900 font-mono mt-1 tabular-nums">
              {metrics.disputed_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Arbitration Freezes</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Cleared & Closed</div>
            <div className="text-xl font-bold text-emerald-900 font-mono mt-1 tabular-nums">
              {metrics.cleared_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Settled Disbursals</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4">
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
              placeholder="Search escrow ID, order #, producer, commercial buyer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 bg-white font-medium text-gray-800 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="text-xs text-gray-500 font-mono">
            Integrity Invariant: <strong className="text-gray-800">Principal = Payout + Fee + Refund</strong>
          </div>
        </div>

        {/* Escrow Table */}
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Clearinghouse Balance Ledger ({totalCount})
            </h2>
            <div className="text-[11px] text-gray-500">
              Page {page} of {totalPages}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-[#1f5400] border-t-transparent rounded-full" />
              <p className="text-xs text-gray-500 mt-2 font-mono">Auditing escrow balances...</p>
            </div>
          ) : ledger.length === 0 ? (
            <div className="py-16 text-center">
              <AdminEmptyState
                icon={<Scale className="w-8 h-8 text-gray-400 mx-auto" />}
                title="No escrow records found"
                description="No escrow balances matched the current status filter."
              />
            </div>
          ) : (
            <>
              <AdminTable columns={columns} data={ledger} keyExtractor={(row) => row.id} />
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

      {/* Release Disbursement Modal */}
      {releaseModal.isOpen && releaseModal.escrow && (
        <AdminModal
          isOpen={releaseModal.isOpen}
          onClose={() => setReleaseModal({ isOpen: false, escrow: null, notes: '', makerCheckerApproved: true, isSubmitting: false })}
          title={`Disburse Escrow — ESC-#{releaseModal.escrow.id}`}
          description="Release held escrow funds to agricultural producer with Maker-Checker dual authorization."
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono space-y-1">
              <div className="flex justify-between">
                <span>Consignment Reference:</span>
                <strong className="text-gray-900">Order #{releaseModal.escrow.order_id}</strong>
              </div>
              <div className="flex justify-between">
                <span>Producer:</span>
                <strong className="text-gray-900">{releaseModal.escrow.farmer_name}</strong>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#1f5400] pt-1 border-t border-emerald-200">
                <span>Disbursement Payout:</span>
                <span>ETB {parseFloat(releaseModal.escrow.farmer_payout_amount).toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Disbursement Approval Notes
              </label>
              <textarea
                rows={2}
                placeholder="Confirmation of inspection clearance, weighbridge match..."
                value={releaseModal.notes}
                onChange={(e) => setReleaseModal((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="makerCheckerClearing"
                checked={releaseModal.makerCheckerApproved}
                onChange={(e) => setReleaseModal((prev) => ({ ...prev, makerCheckerApproved: e.target.checked }))}
              />
              <label htmlFor="makerCheckerClearing" className="font-semibold text-gray-800 cursor-pointer">
                Maker-Checker Financial Dual-Control Signoff
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setReleaseModal({ isOpen: false, escrow: null, notes: '', makerCheckerApproved: true, isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={releaseModal.isSubmitting}
                onClick={handleRelease}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50"
              >
                {releaseModal.isSubmitting ? 'Processing...' : 'Authorize Disbursement'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Emergency Freeze Modal */}
      {freezeModal.isOpen && freezeModal.escrow && (
        <AdminModal
          isOpen={freezeModal.isOpen}
          onClose={() => setFreezeModal({ isOpen: false, escrow: null, reason: '', holdDays: 14, isSubmitting: false })}
          title={`Emergency Freeze — ESC-#{freezeModal.escrow.id}`}
          description="Halt automated clearinghouse release countdown for this consignment."
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 text-red-900">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-700" />
                <span>Emergency Payout Suspension</span>
              </div>
              <p className="mt-1 text-[11px] text-red-800">
                This places an immediate hold on funds. Neither party can disburse until the hold is resolved.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Freeze Duration Extension (Days)
              </label>
              <select
                value={freezeModal.holdDays}
                onChange={(e) => setFreezeModal((prev) => ({ ...prev, holdDays: parseInt(e.target.value) }))}
                className="w-full border border-gray-300 p-2 bg-white text-gray-800 font-medium"
              >
                <option value={7}>7 Days Extension</option>
                <option value={14}>14 Days Standard Arbitration</option>
                <option value={30}>30 Days Formal Investigation</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Mandatory Freeze Justification Reason
              </label>
              <textarea
                rows={3}
                placeholder="State the discrepancy, reported breach, or buyer dispute requiring freeze..."
                value={freezeModal.reason}
                onChange={(e) => setFreezeModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setFreezeModal({ isOpen: false, escrow: null, reason: '', holdDays: 14, isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={freezeModal.isSubmitting}
                onClick={handleFreeze}
                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
              >
                {freezeModal.isSubmitting ? 'Freezing...' : 'Commit Emergency Freeze'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}


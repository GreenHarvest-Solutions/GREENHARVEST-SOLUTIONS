'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Check,
  AlertCircle,
  FileCheck,
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

export default function AdminPaymentsPage() {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<any>({
    total_payments: 0,
    completed_count: 0,
    pending_count: 0,
    refunded_count: 0,
    unreconciled_count: 0,
    total_settled_volume: '0.00',
    telebirr_volume: '0.00',
    chapa_volume: '0.00',
    total_refunded_volume: '0.00',
  });

  // Reconcile Modal state
  const [reconcileModal, setReconcileModal] = useState<{
    isOpen: boolean;
    payment: any | null;
    status: string;
    notes: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    payment: null,
    status: 'reconciled',
    notes: '',
    isSubmitting: false,
  });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const res = await api.getAdminPayments({
        status: statusParam,
        method: methodFilter === 'all' ? undefined : methodFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setPayments(res.payments || []);
        if (res.metrics) setMetrics(res.metrics);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch payments ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, methodFilter, search, page, showToast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleReconcile = async () => {
    if (!reconcileModal.payment) return;
    setReconcileModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await api.reconcileAdminPayment(reconcileModal.payment.id, {
        status: reconcileModal.status,
        notes: reconcileModal.notes.trim() || 'Payment matched against merchant bank ledger batch',
      });
      showToast('Payment reconciliation saved successfully', 'success');
      setReconcileModal({ isOpen: false, payment: null, status: 'reconciled', notes: '', isSubmitting: false });
      fetchPayments();
    } catch (err: any) {
      showToast(err.message || 'Reconciliation failed', 'error');
      setReconcileModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const tabs = [
    { key: 'all', label: 'All Transactions', count: metrics.total_payments },
    { key: 'paid', label: 'Settled & Paid', count: metrics.completed_count },
    { key: 'pending', label: 'Pending Settlement', count: metrics.pending_count },
    { key: 'refunded', label: 'Refunded', count: metrics.refunded_count },
  ];

  const columns = [
    {
      header: 'Reference & Txn',
      accessor: (row: any) => (
        <div>
          <div className="font-mono font-bold text-gray-900">{row.reference_number || `ET-REF-${row.id}`}</div>
          <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
            <span>TXN:</span>
            <span className="text-gray-700">{row.transaction_id || 'N/A'}</span>
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
          <div className="text-[11px] text-gray-500">
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
      header: 'Commercial Buyer',
      accessor: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.buyer_name || 'Buyer'}</div>
          <div className="text-[11px] text-gray-500 font-mono">{row.buyer_phone || row.buyer_email || 'No phone'}</div>
        </div>
      ),
    },
    {
      header: 'Payment Gateway',
      accessor: (row: any) => (
        <div>
          <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-800 font-bold text-[11px] border border-gray-300 uppercase font-mono">
            {row.gateway_name || row.payment_method || 'TELEBIRR'}
          </span>
        </div>
      ),
    },
    {
      header: 'Settlement Amount',
      accessor: (row: any) => (
        <div className="text-right font-mono">
          <div className="font-bold text-gray-900 tabular-nums">
            ETB {parseFloat(row.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          {parseFloat(row.refund_amount || 0) > 0 && (
            <div className="text-[10px] text-red-600 font-bold tabular-nums">
              Refund: ETB {parseFloat(row.refund_amount).toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Gateway Status',
      accessor: (row: any) => {
        const s = row.payment_status;
        return (
          <span
            className={`inline-block px-2 py-0.5 text-[11px] font-bold border tabular-nums ${
              s === 'paid' || s === 'completed'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : s === 'refunded'
                ? 'bg-blue-50 text-blue-800 border-blue-300'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}
          >
            {s ? s.toUpperCase() : 'PENDING'}
          </span>
        );
      },
    },
    {
      header: 'Bank Reconciliation',
      accessor: (row: any) => (
        <div>
          {row.reconciled_at ? (
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                <Check className="w-3 h-3 text-emerald-700" />
                <span>Reconciled</span>
              </span>
              <div className="text-[10px] text-gray-500 font-mono">
                By: {row.reconciler_name || 'Finance Admin'}
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 border border-amber-200">
              <Clock className="w-3 h-3 text-amber-700" />
              <span>Unreconciled</span>
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      accessor: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          {!row.reconciled_at && (
            <button
              onClick={() =>
                setReconcileModal({
                  isOpen: true,
                  payment: row,
                  status: 'reconciled',
                  notes: '',
                  isSubmitting: false,
                })
              }
              className="px-2 py-1 text-[11px] font-bold text-[#1f5400] bg-white hover:bg-emerald-50 border border-gray-300 hover:border-[#1f5400] flex items-center gap-1"
              title="Reconcile against statement"
            >
              <FileCheck className="w-3 h-3" />
              <span>Reconcile</span>
            </button>
          )}
          <Link
            href={`/admin/orders/${row.order_id}`}
            className="p-1 text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-100"
            title="Inspect Order Dossier"
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
        title="Payments & Merchant Settlement Ledger"
        badge={`${totalCount} Recorded Payments`}
        subtitle="Gateway transaction reconciliation (Telebirr / Chapa), settlement verification, and treasury balances."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Commerce', href: '/admin/orders' },
          { label: 'Payments', href: '/admin/payments' },
        ]}
      />

      {/* KPI Metric Strip */}
      <div className="px-8 pt-6 pb-2 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Settled Volume</div>
            <div className="text-lg font-bold text-[#1f5400] font-mono mt-1 tabular-nums">
              ETB {parseFloat(metrics.total_settled_volume || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Cleared Inflow</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Telebirr Volume</div>
            <div className="text-lg font-bold text-blue-900 font-mono mt-1 tabular-nums">
              ETB {parseFloat(metrics.telebirr_volume || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Mobile Money Channel</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Chapa Volume</div>
            <div className="text-lg font-bold text-emerald-900 font-mono mt-1 tabular-nums">
              ETB {parseFloat(metrics.chapa_volume || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Direct Bank Gateway</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Completed Transactions</div>
            <div className="text-xl font-bold text-gray-900 font-mono mt-1 tabular-nums">
              {metrics.completed_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Paid Slips</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Reconciliations</div>
            <div className="text-xl font-bold text-amber-900 font-mono mt-1 tabular-nums">
              {metrics.unreconciled_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Unmatched Slips</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Refunded Volume</div>
            <div className="text-lg font-bold text-red-900 font-mono mt-1 tabular-nums">
              ETB {parseFloat(metrics.total_refunded_volume || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Adjustments Outflow</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4">
        {/* Tabs */}
        <div className="bg-white border border-gray-300 px-4 pt-2 shadow-sm">
          <AdminTabs tabs={tabs} activeTab={tab} onChange={(k) => { setTab(k); setPage(1); }} />
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-gray-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reference #, transaction ID, order #, buyer..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 bg-white font-medium text-gray-800 focus:outline-none focus:border-[#1f5400]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Gateway Channel:</span>
            <select
              value={methodFilter}
              onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
              className="text-xs border border-gray-300 px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:border-[#1f5400]"
            >
              <option value="all">All Channels</option>
              <option value="telebirr">Telebirr SuperApp</option>
              <option value="chapa">Chapa Payment Gateway</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Transaction Ledger ({totalCount})
            </h2>
            <div className="text-[11px] text-gray-500">
              Page {page} of {totalPages}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-[#1f5400] border-t-transparent rounded-full" />
              <p className="text-xs text-gray-500 mt-2 font-mono">Querying merchant payment slips...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center">
              <AdminEmptyState
                icon={<CreditCard className="w-8 h-8 text-gray-400 mx-auto" />}
                title="No transaction slips found"
                description="No payments matched the current gateway or settlement filters."
              />
            </div>
          ) : (
            <>
              <AdminTable columns={columns} data={payments} keyExtractor={(row) => row.id} />
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

      {/* Reconcile Modal */}
      {reconcileModal.isOpen && reconcileModal.payment && (
        <AdminModal
          isOpen={reconcileModal.isOpen}
          onClose={() => setReconcileModal({ isOpen: false, payment: null, status: 'reconciled', notes: '', isSubmitting: false })}
          title={`Reconcile Transaction #${reconcileModal.payment.reference_number || reconcileModal.payment.id}`}
          description="Confirm settlement match between platform transaction record and merchant bank statement."
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-gray-50 border border-gray-200 font-mono grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-gray-500 uppercase block">Amount:</span>
                <span className="font-bold text-gray-900">
                  ETB {parseFloat(reconcileModal.payment.amount).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block">Gateway:</span>
                <span className="font-bold text-gray-800 uppercase">
                  {reconcileModal.payment.gateway_name || reconcileModal.payment.payment_method}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Reconciliation Match Status
              </label>
              <select
                value={reconcileModal.status}
                onChange={(e) => setReconcileModal((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full border border-gray-300 p-2 bg-white text-gray-800 font-medium"
              >
                <option value="reconciled">Reconciled (Matched in Merchant Account)</option>
                <option value="disputed">Disputed / Gateway Discrepancy</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Merchant Statement Reference / Notes
              </label>
              <textarea
                rows={3}
                placeholder="Batch number, bank statement line item, or clearing notes..."
                value={reconcileModal.notes}
                onChange={(e) => setReconcileModal((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setReconcileModal({ isOpen: false, payment: null, status: 'reconciled', notes: '', isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reconcileModal.isSubmitting}
                onClick={handleReconcile}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50"
              >
                {reconcileModal.isSubmitting ? 'Recording...' : 'Save Reconciliation'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

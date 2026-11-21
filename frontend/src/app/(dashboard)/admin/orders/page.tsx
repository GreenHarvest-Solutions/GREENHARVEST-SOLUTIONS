'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Search,
  Filter,
  Eye,
  RotateCcw,
  SlidersHorizontal,
  CreditCard,
  Truck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminStatusPill,
  AdminPagination,
  AdminEmptyState,
  AdminTabs,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminOrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<any>({
    total_orders: 0,
    pending_count: 0,
    confirmed_count: 0,
    in_transit_count: 0,
    delivered_count: 0,
    cancelled_count: 0,
    refunded_count: 0,
    total_gmv: '0.00',
  });

  // Status Override Modal state
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    order: any | null;
    status: string;
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    order: null,
    status: 'confirmed',
    reason: '',
    isSubmitting: false,
  });

  // Refund Modal state
  const [refundModal, setRefundModal] = useState<{
    isOpen: boolean;
    order: any | null;
    amount: string;
    refundFull: boolean;
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    order: null,
    amount: '',
    refundFull: true,
    reason: '',
    isSubmitting: false,
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const res = await api.getAdminOrders({
        status: statusParam,
        payment_status: paymentFilter === 'all' ? undefined : paymentFilter,
        delivery_status: deliveryFilter === 'all' ? undefined : deliveryFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setOrders(res.orders || []);
        if (res.metrics) setMetrics(res.metrics);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch order operations ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, paymentFilter, deliveryFilter, search, page, showToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusOverride = async () => {
    if (!statusModal.order) return;
    if (!statusModal.reason.trim()) {
      showToast('A justification reason is mandatory for administrative status override', 'error');
      return;
    }

    setStatusModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.updateAdminOrderStatus(statusModal.order.id, {
        status: statusModal.status,
        reason: statusModal.reason.trim(),
      });
      showToast(res.message || 'Order status overridden successfully', 'success');
      setStatusModal({ isOpen: false, order: null, status: 'confirmed', reason: '', isSubmitting: false });
      fetchOrders();
    } catch (err: any) {
      showToast(err.message || 'Failed to override order status', 'error');
      setStatusModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleRefund = async () => {
    if (!refundModal.order) return;
    if (!refundModal.reason.trim()) {
      showToast('A justification reason is required to issue refunds', 'error');
      return;
    }

    const amt = refundModal.refundFull ? undefined : parseFloat(refundModal.amount);
    if (!refundModal.refundFull && (!amt || amt <= 0)) {
      showToast('Please specify a positive refund amount', 'error');
      return;
    }

    setRefundModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.refundAdminOrder(refundModal.order.id, {
        amount: amt,
        refundFull: refundModal.refundFull,
        reason: refundModal.reason.trim(),
      });
      showToast(res.message || 'Refund successfully processed and ledger balanced', 'success');
      setRefundModal({ isOpen: false, order: null, amount: '', refundFull: true, reason: '', isSubmitting: false });
      fetchOrders();
    } catch (err: any) {
      showToast(err.message || 'Failed to process refund', 'error');
      setRefundModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const tabs = [
    { key: 'all', label: 'All Orders', count: metrics.total_orders },
    { key: 'pending', label: 'Pending Payment/Fulfillment', count: metrics.pending_count },
    { key: 'confirmed', label: 'Confirmed Batches', count: metrics.confirmed_count },
    { key: 'shipped', label: 'In Transit', count: metrics.in_transit_count },
    { key: 'delivered', label: 'Delivered', count: metrics.delivered_count },
    { key: 'cancelled', label: 'Cancelled', count: metrics.cancelled_count },
    { key: 'refunded', label: 'Refunded / Disputed', count: metrics.refunded_count },
  ];

  const columns = [
    {
      header: 'Order #',
      accessor: (row: any) => (
        <div>
          <Link
            href={`/admin/orders/${row.id}`}
            className="font-mono font-bold text-[#1f5400] hover:underline flex items-center gap-1.5"
          >
            <span>#{row.id}</span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </Link>
          <div className="text-[11px] text-gray-500 tabular-nums">
            {new Date(row.created_at).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ),
    },
    {
      header: 'Commercial Buyer',
      accessor: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.buyer_name || 'Anonymous Buyer'}</div>
          <div className="text-[11px] text-gray-500 font-mono">{row.buyer_phone || row.buyer_email || 'No contact'}</div>
        </div>
      ),
    },
    {
      header: 'Products & Producers',
      accessor: (row: any) => (
        <div className="max-w-[220px]">
          <div className="text-gray-900 font-medium truncate" title={row.product_names}>
            {row.product_names || `${row.items_count || 1} Item(s)`}
          </div>
          <div className="text-[11px] text-[#007a6c] truncate" title={row.farmer_names}>
            From: {row.farmer_names || 'Agritech Network Producer'}
          </div>
        </div>
      ),
    },
    {
      header: 'Gross Value (ETB)',
      accessor: (row: any) => (
        <div className="text-right">
          <div className="font-mono font-bold text-gray-900 tabular-nums">
            ETB {parseFloat(row.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          {parseFloat(row.refund_amount || 0) > 0 && (
            <div className="text-[10px] text-red-600 font-mono tabular-nums">
              Refunded: ETB {parseFloat(row.refund_amount).toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Escrow / Payment',
      accessor: (row: any) => {
        const payStatus = row.payment_status || 'pending';
        return (
          <div className="space-y-1">
            <span
              className={`inline-block px-2 py-0.5 rounded-none text-[11px] font-bold border tabular-nums ${
                payStatus === 'paid' || payStatus === 'completed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : payStatus === 'refunded'
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {payStatus === 'paid' ? '✓ Paid' : payStatus.toUpperCase()}
            </span>
            <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
              <CreditCard className="w-2.5 h-2.5" />
              <span>{row.payment_method ? row.payment_method.toUpperCase() : 'TELEBIRR'}</span>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Logistics',
      accessor: (row: any) => {
        const delStatus = row.delivery_status || 'pending';
        return (
          <div className="space-y-1">
            <span
              className={`inline-block px-2 py-0.5 rounded-none text-[11px] font-bold border tabular-nums ${
                delStatus === 'delivered'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : delStatus === 'in_transit' || delStatus === 'shipped'
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}
            >
              <Truck className="w-2.5 h-2.5 inline mr-1" />
              {delStatus.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Order State',
      accessor: (row: any) => {
        const status = row.order_status || 'pending';
        let color = 'bg-gray-100 text-gray-700 border-gray-300';
        if (status === 'confirmed' || status === 'delivered') color = 'bg-emerald-50 text-emerald-800 border-emerald-300';
        else if (status === 'pending' || status === 'processing') color = 'bg-amber-50 text-amber-900 border-amber-300';
        else if (status === 'shipped') color = 'bg-blue-50 text-blue-800 border-blue-300';
        else if (status === 'cancelled') color = 'bg-red-50 text-red-800 border-red-300';
        else if (status === 'refunded') color = 'bg-purple-50 text-purple-900 border-purple-300';

        return (
          <span className={`inline-block px-2 py-0.5 rounded-none text-[11px] font-bold border tabular-nums ${color}`}>
            {status.toUpperCase()}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={`/admin/orders/${row.id}`}
            className="p-1.5 text-gray-600 hover:text-[#1f5400] hover:bg-gray-100 rounded-none border border-gray-200 transition-colors"
            title="Inspect Dossier"
          >
            <Eye className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() =>
              setStatusModal({
                isOpen: true,
                order: row,
                status: row.order_status || 'confirmed',
                reason: '',
                isSubmitting: false,
              })
            }
            className="p-1.5 text-gray-600 hover:text-amber-800 hover:bg-amber-50 rounded-none border border-gray-200 transition-colors"
            title="Override State"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const maxRefund = Math.max(0, parseFloat(row.total_price) - parseFloat(row.refund_amount || 0));
              setRefundModal({
                isOpen: true,
                order: row,
                amount: maxRefund.toFixed(2),
                refundFull: true,
                reason: '',
                isSubmitting: false,
              });
            }}
            disabled={row.order_status === 'refunded'}
            className="p-1.5 text-gray-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-30 rounded-none border border-gray-200 transition-colors"
            title="Issue Refund"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Commerce & Orders Operations"
        badge={`${totalCount} Total Consignments`}
        subtitle="End-to-end commercial trade registry, payment verification, fulfillment pipeline, and state overrides."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Commerce', href: '/admin/orders' },
          { label: 'Orders', href: '/admin/orders' },
        ]}
      />

      {/* Operational KPI Metric Strip */}
      <div className="px-8 pt-6 pb-2 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-300 rounded-none p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gross GMV (ETB)</div>
            <div className="text-lg font-bold text-[#1f5400] font-mono mt-1 tabular-nums">
              ETB {parseFloat(metrics.total_gmv || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Total Settlement Volume</div>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Consignments</div>
            <div className="text-xl font-bold text-gray-900 font-mono mt-1 tabular-nums">
              {metrics.total_orders}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Lifetime Bookings</div>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Release</div>
            <div className="text-xl font-bold text-amber-900 font-mono mt-1 tabular-nums">
              {metrics.pending_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Awaiting Fulfillment</div>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">In Cold Transit</div>
            <div className="text-xl font-bold text-blue-900 font-mono mt-1 tabular-nums">
              {metrics.in_transit_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Active Fleet Corridors</div>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Delivered & Closed</div>
            <div className="text-xl font-bold text-emerald-900 font-mono mt-1 tabular-nums">
              {metrics.delivered_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Escrow Eligible</div>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Refunded / Cancelled</div>
            <div className="text-xl font-bold text-red-900 font-mono mt-1 tabular-nums">
              {Number(metrics.refunded_count || 0) + Number(metrics.cancelled_count || 0)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Adjusted Orders</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4">
        {/* State Tabs */}
        <div className="bg-white border border-gray-300 rounded-none px-4 pt-2 shadow-sm">
          <AdminTabs tabs={tabs} activeTab={tab} onChange={(k) => { setTab(k); setPage(1); }} />
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-white border border-gray-300 rounded-none p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by order #, buyer, phone, product..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-none focus:outline-none focus:border-[#1f5400] bg-white font-medium text-gray-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="font-bold text-gray-500 uppercase text-[10px]">Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
                className="text-xs border border-gray-300 rounded-none px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:border-[#1f5400]"
              >
                <option value="all">All Payment States</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="font-bold text-gray-500 uppercase text-[10px]">Delivery:</span>
              <select
                value={deliveryFilter}
                onChange={(e) => { setDeliveryFilter(e.target.value); setPage(1); }}
                className="text-xs border border-gray-300 rounded-none px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:border-[#1f5400]"
              >
                <option value="all">All Logistics States</option>
                <option value="pending">Pending Pickup</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-gray-300 rounded-none shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Commercial Order Book ({totalCount})
            </h2>
            <div className="text-[11px] text-gray-500">
              Showing page {page} of {totalPages}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-[#1f5400] border-t-transparent rounded-full" />
              <p className="text-xs text-gray-500 mt-2 font-mono">Synchronizing order registry...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <AdminEmptyState
                icon={<ShoppingCart className="w-8 h-8 text-gray-400 mx-auto" />}
                title="No orders found"
                description="No commercial consignments matched the selected state filters or search criteria."
              />
            </div>
          ) : (
            <>
              <AdminTable columns={columns} data={orders} keyExtractor={(row) => row.id} />
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

      {/* State Override Modal */}
      {statusModal.isOpen && statusModal.order && (
        <AdminModal
          isOpen={statusModal.isOpen}
          onClose={() => setStatusModal({ isOpen: false, order: null, status: 'confirmed', reason: '', isSubmitting: false })}
          title={`Administrative State Override — Order #${statusModal.order.id}`}
          description="Override order fulfillment lifecycle state. This action generates a permanent immutable audit trail."
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-none text-amber-900">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Caution: Administrative Override</span>
              </div>
              <p className="mt-1 text-[11px] text-amber-800">
                Overriding the state may impact automated escrow clearinghouse timers and carrier notifications.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Target Order State
              </label>
              <select
                value={statusModal.status}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full border border-gray-300 rounded-none p-2 bg-white text-gray-800 font-medium focus:outline-none focus:border-[#1f5400]"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped / In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Mandatory Audit Justification
              </label>
              <textarea
                rows={3}
                placeholder="Explain the operational or physical reason for this administrative intervention..."
                value={statusModal.reason}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full border border-gray-300 rounded-none p-2 text-xs focus:outline-none focus:border-[#1f5400] text-gray-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setStatusModal({ isOpen: false, order: null, status: 'confirmed', reason: '', isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusModal.isSubmitting}
                onClick={handleStatusOverride}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50 rounded-none"
              >
                {statusModal.isSubmitting ? 'Updating...' : 'Commit Override'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Refund Modal */}
      {refundModal.isOpen && refundModal.order && (
        <AdminModal
          isOpen={refundModal.isOpen}
          onClose={() => setRefundModal({ isOpen: false, order: null, amount: '', refundFull: true, reason: '', isSubmitting: false })}
          title={`Authorize Refund — Order #${refundModal.order.id}`}
          description="Issue an idempotent refund to buyer and balance escrow ledger."
        >
          <div className="space-y-4 text-xs">
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-none grid grid-cols-2 gap-2 font-mono">
              <div>
                <span className="text-[10px] text-gray-500 uppercase block">Order Total:</span>
                <span className="font-bold text-gray-900">
                  ETB {parseFloat(refundModal.order.total_price).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block">Already Refunded:</span>
                <span className="font-bold text-red-600">
                  ETB {parseFloat(refundModal.order.refund_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="refundType"
                  checked={refundModal.refundFull}
                  onChange={() => setRefundModal((prev) => ({ ...prev, refundFull: true }))}
                />
                <span className="font-semibold text-gray-800">Full Remaining Refund</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="refundType"
                  checked={!refundModal.refundFull}
                  onChange={() => setRefundModal((prev) => ({ ...prev, refundFull: false }))}
                />
                <span className="font-semibold text-gray-800">Partial Settlement Amount</span>
              </label>
            </div>

            {!refundModal.refundFull && (
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Refund Amount (ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={Math.max(0, parseFloat(refundModal.order.total_price) - parseFloat(refundModal.order.refund_amount || 0))}
                  value={refundModal.amount}
                  onChange={(e) => setRefundModal((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full border border-gray-300 rounded-none p-2 font-mono text-gray-800 focus:outline-none focus:border-[#1f5400]"
                  placeholder="0.00"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Mandatory Reason / Audit Note
              </label>
              <textarea
                rows={3}
                placeholder="Disclose arbitration finding, quality defect, or reason for issuing funds..."
                value={refundModal.reason}
                onChange={(e) => setRefundModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full border border-gray-300 rounded-none p-2 text-xs focus:outline-none focus:border-[#1f5400] text-gray-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setRefundModal({ isOpen: false, order: null, amount: '', refundFull: true, reason: '', isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refundModal.isSubmitting}
                onClick={handleRefund}
                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-none"
              >
                {refundModal.isSubmitting ? 'Processing...' : 'Authorize Refund'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

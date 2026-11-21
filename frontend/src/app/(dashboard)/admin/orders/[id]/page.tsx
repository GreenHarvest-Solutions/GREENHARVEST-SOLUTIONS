'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ShoppingCart,
  ArrowLeft,
  User,
  CreditCard,
  Truck,
  ShieldCheck,
  Scale,
  RotateCcw,
  SlidersHorizontal,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Building2,
  Phone,
  Mail,
  ExternalLink,
  Snowflake,
  Award,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminStatusPill,
  AdminModal,
  AdminAuditTimeline,
} from '@/components/admin/ui';

export default function AdminOrderDossierPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    status: 'confirmed',
    reason: '',
    isSubmitting: false,
  });

  const [refundModal, setRefundModal] = useState({
    isOpen: false,
    amount: '',
    refundFull: true,
    reason: '',
    isSubmitting: false,
  });

  const [escrowModal, setEscrowModal] = useState({
    isOpen: false,
    notes: '',
    makerCheckerApproved: true,
    isSubmitting: false,
  });

  const fetchDossier = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await api.getAdminOrderById(orderId);
      if (res?.order) {
        setOrder(res.order);
        setStatusModal((prev) => ({ ...prev, status: res.order.order_status || 'confirmed' }));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load order dossier', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast]);

  useEffect(() => {
    fetchDossier();
  }, [fetchDossier]);

  const handleStatusOverride = async () => {
    if (!statusModal.reason.trim()) {
      showToast('A justification reason is required for status override', 'error');
      return;
    }
    setStatusModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await api.updateAdminOrderStatus(orderId, {
        status: statusModal.status,
        reason: statusModal.reason.trim(),
      });
      showToast('Order status updated successfully', 'success');
      setStatusModal({ isOpen: false, status: 'confirmed', reason: '', isSubmitting: false });
      fetchDossier();
    } catch (err: any) {
      showToast(err.message || 'Status override failed', 'error');
      setStatusModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleRefund = async () => {
    if (!refundModal.reason.trim()) {
      showToast('A justification reason is required for refund', 'error');
      return;
    }
    const amt = refundModal.refundFull ? undefined : parseFloat(refundModal.amount);
    refundModal.isSubmitting = true;
    try {
      await api.refundAdminOrder(orderId, {
        amount: amt,
        refundFull: refundModal.refundFull,
        reason: refundModal.reason.trim(),
      });
      showToast('Refund processed successfully', 'success');
      setRefundModal({ isOpen: false, amount: '', refundFull: true, reason: '', isSubmitting: false });
      fetchDossier();
    } catch (err: any) {
      showToast(err.message || 'Refund failed', 'error');
      setRefundModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleReleaseEscrow = async () => {
    if (!order?.escrow?.id) return;
    setEscrowModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await api.releaseAdminEscrow(order.escrow.id, {
        notes: escrowModal.notes.trim() || 'Manual release from order operations dossier',
        makerCheckerApproved: escrowModal.makerCheckerApproved,
      });
      showToast('Escrow funds released to farmer successfully', 'success');
      setEscrowModal({ isOpen: false, notes: '', makerCheckerApproved: true, isSubmitting: false });
      fetchDossier();
    } catch (err: any) {
      showToast(err.message || 'Escrow release failed', 'error');
      setEscrowModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FCF9F8] min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-[#1f5400] border-t-transparent rounded-full" />
          <p className="text-xs text-gray-500 font-mono mt-3">Loading order operations dossier #{orderId}...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 p-8 bg-[#FCF9F8]">
        <div className="bg-white border border-gray-300 p-8 text-center max-w-lg mx-auto">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-gray-900">Order Not Found</h2>
          <p className="text-xs text-gray-500 mt-1">Consignment #{orderId} could not be retrieved from the ledger.</p>
          <Link
            href="/admin/orders"
            className="inline-block mt-4 px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00]"
          >
            Return to Order Registry
          </Link>
        </div>
      </div>
    );
  }

  const orderTotal = parseFloat(order.total_price || 0);
  const refundAmount = parseFloat(order.refund_amount || 0);
  const netOrderAmount = Math.max(0, orderTotal - refundAmount);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <header className="px-8 py-4 bg-white border-b border-gray-300 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-1.5 text-gray-600 hover:text-gray-900 bg-gray-50 border border-gray-300 rounded-none transition-colors"
            title="Back to Orders"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-gray-900 font-mono">Order #{order.id}</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 border border-gray-300 bg-gray-100 text-gray-800 uppercase tabular-nums">
                {order.order_status?.toUpperCase()}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 border tabular-nums ${
                  order.payment_status === 'paid'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                PAYMENT: {order.payment_status?.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Booked on {new Date(order.created_at).toLocaleString('en-GB')} • Net Settlement:{' '}
              <span className="font-bold text-gray-900 font-mono">ETB {netOrderAmount.toFixed(2)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusModal((prev) => ({ ...prev, isOpen: true }))}
            className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Override State</span>
          </button>
          <button
            onClick={() => {
              setRefundModal({
                isOpen: true,
                amount: netOrderAmount.toFixed(2),
                refundFull: true,
                reason: '',
                isSubmitting: false,
              });
            }}
            disabled={order.order_status === 'refunded' || netOrderAmount <= 0}
            className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Issue Refund</span>
          </button>
          {order.escrow && order.escrow.release_status === 'held' && (
            <button
              onClick={() => setEscrowModal((prev) => ({ ...prev, isOpen: true }))}
              className="px-3 py-1.5 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Release Escrow</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Top 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-300 p-4 shadow-sm text-center">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Total Contract GMV
            </span>
            <span className="text-xl font-bold text-[#1f5400] font-mono block mt-1 tabular-nums">
              ETB {orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-gray-500 mt-0.5 block">
              {order.items?.length || 0} agricultural commodity line item(s)
            </span>
          </div>

          <div className="bg-white border border-gray-300 p-4 shadow-sm text-center">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Escrow Protection Status
            </span>
            <span className="text-lg font-bold text-gray-900 font-mono block mt-1 tabular-nums">
              {order.escrow ? `ETB ${parseFloat(order.escrow.escrow_amount).toFixed(2)}` : 'N/A'}
            </span>
            <span
              className={`text-[10px] font-bold inline-block px-2 py-0.2 mt-1 border ${
                order.escrow?.release_status === 'cleared'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : order.escrow?.release_status === 'disputed'
                  ? 'bg-red-50 text-red-800 border-red-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {order.escrow?.release_status ? order.escrow.release_status.toUpperCase() : 'PENDING'}
            </span>
          </div>

          <div className="bg-white border border-gray-300 p-4 shadow-sm text-center">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Cold-Chain Logistics
            </span>
            <span className="text-base font-bold text-gray-900 block mt-1 uppercase">
              {order.delivery_status?.replace('_', ' ') || 'PENDING DISPATCH'}
            </span>
            <span className="text-[11px] text-gray-500 mt-0.5 block">
              Partner: {order.delivery?.delivery_person_name || 'Agro-Logistics Fleet'}
            </span>
          </div>
        </div>

        {/* Dispute banner if active */}
        {order.dispute && (
          <div className="bg-red-50 border border-red-300 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider">
                  Active Dispute Filed — Claim #{order.dispute.id} ({order.dispute.dispute_category})
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  Reason: &quot;{order.dispute.reason}&quot; • Status:{' '}
                  <span className="font-bold">{order.dispute.status}</span>
                </p>
              </div>
            </div>
            <Link
              href={`/admin/disputes/${order.dispute.id}`}
              className="px-3 py-1.5 text-xs font-bold bg-red-700 text-white hover:bg-red-800 flex items-center gap-1.5"
            >
              <span>Inspect Arbitration Dossier</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2 Cols: Line items + Escrow & Payment Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Commodity Line Items */}
            <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Consignment Line Items ({order.items?.length || 0})
                </h2>
                <span className="text-[11px] text-gray-500 font-mono">Certified Quality Inspection</span>
              </div>

              <div className="divide-y divide-gray-200">
                {order.items?.map((item: any) => (
                  <div key={item.order_item_id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ShoppingCart className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-gray-900">{item.product_name}</h4>
                          {item.grade && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 uppercase">
                              <Award className="w-2.5 h-2.5 inline mr-0.5" />
                              Grade {item.grade}
                            </span>
                          )}
                          {item.cold_chain_required && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300 uppercase">
                              <Snowflake className="w-2.5 h-2.5 inline mr-0.5" />
                              Reefer Required
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                          <span>Producer: <strong className="text-gray-700">{item.farmer_name || 'Cooperative'}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-gray-400" />
                            {item.farm_location || 'Oromia / Sidama'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-xs text-gray-600">
                        {item.quantity} units × ETB {parseFloat(item.unit_price).toFixed(2)}
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-0.5">
                        ETB {parseFloat(item.line_total).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#FCF9F8] p-4 border-t border-gray-200 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal Contract:</span>
                  <span>ETB {orderTotal.toFixed(2)}</span>
                </div>
                {refundAmount > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>Authorized Refund Adjustments:</span>
                    <span>- ETB {refundAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-300">
                  <span>Net Settlement Balance:</span>
                  <span className="text-[#1f5400]">ETB {netOrderAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Escrow Clearinghouse Ledger */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Escrow Clearinghouse & Payout Splits
                </h2>
                <span className="text-[11px] text-gray-500 font-mono">
                  State: {order.escrow?.release_status?.toUpperCase() || 'HELD'}
                </span>
              </div>

              {order.escrow ? (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-gray-50 border border-gray-200 text-center font-mono">
                      <span className="text-[10px] text-gray-500 uppercase block">Escrow Principal</span>
                      <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                        ETB {parseFloat(order.escrow.escrow_amount).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 border border-gray-200 text-center font-mono">
                      <span className="text-[10px] text-gray-500 uppercase block">Platform Fee (5%)</span>
                      <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                        ETB {parseFloat(order.escrow.platform_fee_amount).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-center font-mono">
                      <span className="text-[10px] text-emerald-800 uppercase block">Farmer Payout</span>
                      <span className="font-bold text-[#1f5400] text-sm mt-0.5 block">
                        ETB {parseFloat(order.escrow.farmer_payout_amount).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3 bg-red-50 border border-red-200 text-center font-mono">
                      <span className="text-[10px] text-red-800 uppercase block">Buyer Refund</span>
                      <span className="font-bold text-red-700 text-sm mt-0.5 block">
                        ETB {parseFloat(order.escrow.buyer_refund_amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-2 border-t border-gray-200 pt-3 text-gray-700">
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-500">Hold Until:</span>
                      <span className="font-mono">
                        {order.escrow.hold_until
                          ? new Date(order.escrow.hold_until).toLocaleString('en-GB')
                          : 'Immediate inspection clearance'}
                      </span>
                    </div>
                    {order.escrow.released_at && (
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-500">Disbursed At:</span>
                        <span className="font-mono text-emerald-800 font-bold">
                          {new Date(order.escrow.released_at).toLocaleString('en-GB')}
                        </span>
                      </div>
                    )}
                    {order.escrow.notes && (
                      <div className="p-2.5 bg-gray-50 border border-gray-200 text-[11px] text-gray-600 font-mono">
                        <strong>Ledger Notes:</strong> {order.escrow.notes}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-gray-500">
                  No escrow ledger record created for this order.
                </div>
              )}
            </div>

            {/* Audit Trail Timeline */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Immutable Operations Audit Trail
                </h2>
              </div>
              <div className="p-5">
                <AdminAuditTimeline events={order.audit_trail || []} />
              </div>
            </div>
          </div>

          {/* Right Col: Commercial Buyer & Logistics Cards */}
          <div className="space-y-6">
            {/* Buyer Profile Card */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Commercial Buyer Profile
                </h2>
                {order.buyer_id && (
                  <Link
                    href={`/admin/users/${order.buyer_id}`}
                    className="text-[11px] font-bold text-[#1f5400] hover:underline flex items-center gap-1"
                  >
                    <span>User 360</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>

              <div className="p-5 space-y-3.5 text-xs">
                <div>
                  <div className="font-bold text-gray-900 text-sm">{order.buyer_name || 'Buyer'}</div>
                  <div className="text-gray-500 text-[11px]">Commercial Account ID #{order.buyer_id}</div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-mono">{order.buyer_phone || 'No phone registered'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-mono">{order.buyer_email || 'No email registered'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">Account Status:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                    {order.buyer_account_status?.toUpperCase() || 'ACTIVE'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment & Gateway Slips */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Payment Slip & Gateway
                </h2>
                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
              </div>

              <div className="p-5 space-y-3 text-xs">
                {order.payment ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Gateway:</span>
                      <span className="font-bold text-gray-900 uppercase">
                        {order.payment.gateway_name || order.payment.payment_method}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Transaction ID:</span>
                      <span className="font-mono font-bold text-gray-800 text-[11px]">
                        {order.payment.transaction_id || 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Reference:</span>
                      <span className="font-mono text-gray-700 text-[11px]">
                        {order.payment.reference_number || 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status:</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold border ${
                          order.payment.payment_status === 'paid'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        {order.payment.payment_status?.toUpperCase()}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex justify-between items-center font-mono">
                      <span className="text-gray-500">Captured Amount:</span>
                      <span className="font-bold text-gray-900">
                        ETB {parseFloat(order.payment.amount).toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    No gateway payment slip recorded.
                  </div>
                )}
              </div>
            </div>

            {/* Delivery & Routing Card */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Fulfillment & Logistics
                </h2>
                <Truck className="w-3.5 h-3.5 text-gray-400" />
              </div>

              <div className="p-5 space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Destination Hub / Address:</span>
                  <p className="mt-0.5 text-gray-800 font-medium">
                    {order.delivery?.delivery_address || order.delivery?.delivery_location || 'Standard Commercial Delivery Depot'}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Carrier Driver / Partner:</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-semibold text-gray-900">
                      {order.delivery?.delivery_person_name || 'Agro-Logistics Carrier Fleet'}
                    </span>
                    <span className="font-mono text-gray-500 text-[11px]">
                      {order.delivery?.delivery_person_phone || '+251 911 234567'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[11px]">
                  <span className="text-gray-500">Logistics State:</span>
                  <span className="font-bold text-gray-900 uppercase">
                    {order.delivery_status || 'PENDING'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* State Override Modal */}
      {statusModal.isOpen && (
        <AdminModal
          isOpen={statusModal.isOpen}
          onClose={() => setStatusModal({ isOpen: false, status: order.order_status, reason: '', isSubmitting: false })}
          title={`Override Lifecycle State — Order #${order.id}`}
          description="Update the order lifecycle state. A justification reason is required for audit logs."
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                New Order State
              </label>
              <select
                value={statusModal.status}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full border border-gray-300 p-2 bg-white text-gray-800 font-medium"
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
                placeholder="Disclose physical inspection findings or operational reason..."
                value={statusModal.reason}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs focus:outline-none focus:border-[#1f5400]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setStatusModal({ isOpen: false, status: order.order_status, reason: '', isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusModal.isSubmitting}
                onClick={handleStatusOverride}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50"
              >
                {statusModal.isSubmitting ? 'Updating...' : 'Commit Status Override'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Refund Modal */}
      {refundModal.isOpen && (
        <AdminModal
          isOpen={refundModal.isOpen}
          onClose={() => setRefundModal({ isOpen: false, amount: '', refundFull: true, reason: '', isSubmitting: false })}
          title={`Authorize Refund — Order #${order.id}`}
          description="Issue an idempotent refund and balance escrow ledger."
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="refundTypeDossier"
                  checked={refundModal.refundFull}
                  onChange={() => setRefundModal((prev) => ({ ...prev, refundFull: true }))}
                />
                <span className="font-semibold text-gray-800">Full Remaining Refund (ETB {netOrderAmount.toFixed(2)})</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="refundTypeDossier"
                  checked={!refundModal.refundFull}
                  onChange={() => setRefundModal((prev) => ({ ...prev, refundFull: false }))}
                />
                <span className="font-semibold text-gray-800">Partial Settlement</span>
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
                  max={netOrderAmount}
                  value={refundModal.amount}
                  onChange={(e) => setRefundModal((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full border border-gray-300 p-2 font-mono"
                  placeholder="0.00"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Mandatory Reason
              </label>
              <textarea
                rows={3}
                placeholder="Reason for issuing refund..."
                value={refundModal.reason}
                onChange={(e) => setRefundModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setRefundModal({ isOpen: false, amount: '', refundFull: true, reason: '', isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refundModal.isSubmitting}
                onClick={handleRefund}
                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
              >
                {refundModal.isSubmitting ? 'Processing...' : 'Commit Refund'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Escrow Release Modal */}
      {escrowModal.isOpen && (
        <AdminModal
          isOpen={escrowModal.isOpen}
          onClose={() => setEscrowModal({ isOpen: false, notes: '', makerCheckerApproved: true, isSubmitting: false })}
          title={`Disburse Escrow to Farmer — Order #${order.id}`}
          description="Release held escrow funds to the agricultural producer. This triggers disbursement ledger posting."
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#1f5400]" />
                <span>Disbursement Amount: ETB {parseFloat(order.escrow?.farmer_payout_amount || 0).toFixed(2)}</span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-800">
                Platform fee of ETB {parseFloat(order.escrow?.platform_fee_amount || 0).toFixed(2)} will be retained.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Release Approval Notes
              </label>
              <textarea
                rows={2}
                placeholder="Delivery confirmed, quality standards verified..."
                value={escrowModal.notes}
                onChange={(e) => setEscrowModal((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 p-2 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="makerChecker"
                checked={escrowModal.makerCheckerApproved}
                onChange={(e) => setEscrowModal((prev) => ({ ...prev, makerCheckerApproved: e.target.checked }))}
              />
              <label htmlFor="makerChecker" className="font-semibold text-gray-800 cursor-pointer">
                Maker-Checker Financial Signoff Authorization
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setEscrowModal({ isOpen: false, notes: '', makerCheckerApproved: true, isSubmitting: false })}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={escrowModal.isSubmitting}
                onClick={handleReleaseEscrow}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-50"
              >
                {escrowModal.isSubmitting ? 'Releasing...' : 'Confirm Disbursement'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}


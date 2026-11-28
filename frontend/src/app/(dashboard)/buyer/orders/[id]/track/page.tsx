'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const STEP_LIST = [
  { key: 'pending', label: 'Order Placed', icon: 'receipt_long' },
  { key: 'accepted', label: 'Confirmed & Packed', icon: 'inventory_2' },
  { key: 'in_transit', label: 'Out for Delivery / Ready', icon: 'local_shipping' },
  { key: 'delivered', label: 'Delivered', icon: 'home' },
];

function mapFulfillmentStep(status: string): number {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'cancelled') return -1;
  if (s === 'delivered' || s === 'completed') return 3;
  if (['in_transit', 'dispatched', 'picked_up', 'ready_for_pickup', 'shipped', 'out for delivery'].includes(s))
    return 2;
  if (['confirmed', 'accepted', 'packed', 'processing', 'assigned', 'collected'].includes(s))
    return 1;
  return 0;
}

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingSubId, setConfirmingSubId] = useState<number | null>(null);

  // Buyer Courier Accountability Rating State (keyed by suborderId)
  const [ratingDrafts, setRatingDrafts] = useState<
    Record<number, { rating: number; feedback: string; submitting: boolean }>
  >({});

  const fetchTrackingData = useCallback(
    async (silent = false) => {
      if (!orderId) return;
      try {
        if (!silent) setLoading(true);
        const [orderRes, deliveryRes] = await Promise.all([
          api.getOrderById(orderId).catch(() => null),
          api.trackOrderDeliveries(orderId).catch(() => ({ deliveries: [] })),
        ]);

        if (orderRes?.order) {
          setOrder({
            ...orderRes.order,
            status: orderRes.order.order_status ?? orderRes.order.status,
          });
        } else if (!silent) {
          const listRes = await api.getOrders().catch(() => ({ orders: [] }));
          const found = listRes.orders?.find((o: any) => String(o.id) === String(orderId));
          if (found) {
            setOrder({ ...found, status: found.order_status ?? found.status });
          } else {
            setOrder(null);
          }
        }

        setDeliveries(deliveryRes?.deliveries || []);
        setLastSynced(new Date());
      } catch (err) {
        if (!silent) {
          console.error('Failed to fetch order tracking:', err);
          showError('Failed to load live tracking details.');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId, showError]
  );

  useEffect(() => {
    fetchTrackingData(false);
    const interval = setInterval(() => {
      fetchTrackingData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchTrackingData]);

  const handleCancelOrder = async () => {
    if (!confirm('Cancel this order and release reserved stock?')) return;
    setCancelling(true);
    try {
      await api.updateOrderStatus(orderId, 'cancelled');
      showSuccess('Order cancelled successfully.');
      await fetchTrackingData(true);
    } catch (err: any) {
      console.error(err);
      showError(err?.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  const handleBuyerConfirmReceipt = async (suborderId: number) => {
    setConfirmingSubId(suborderId);
    try {
      const res = await api.confirmFarmerDelivery(suborderId);
      showSuccess(res.message || 'Delivery confirmed and escrow released!');
      await fetchTrackingData(true);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to confirm delivery.');
    } finally {
      setConfirmingSubId(null);
    }
  };

  const handleSubmitRating = async (suborderId: number) => {
    const draft = ratingDrafts[suborderId] || { rating: 5, feedback: '', submitting: false };
    setRatingDrafts((prev) => ({
      ...prev,
      [suborderId]: { ...draft, submitting: true },
    }));
    try {
      const res = await api.rateSuborderDelivery(suborderId, {
        rating: draft.rating,
        feedback: draft.feedback.trim() || undefined,
      });
      showSuccess(res.message || 'Rating submitted!');
      await fetchTrackingData(true);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Could not submit rating.');
    } finally {
      setRatingDrafts((prev) => ({
        ...prev,
        [suborderId]: { ...(prev[suborderId] || draft), submitting: false },
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#286c00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <span className="material-symbols-outlined text-5xl text-gray-300 mb-3">search_off</span>
        <p className="text-gray-800 font-bold text-lg mb-1">Order not found</p>
        <p className="text-xs text-gray-500 mb-5">
          We couldn&apos;t find this order or you may not have access to view it.
        </p>
        <Link
          href="/buyer/orders"
          className="px-5 py-2.5 bg-[#286c00] text-white text-xs font-bold rounded-xl inline-block"
        >
          Back to My Orders
        </Link>
      </div>
    );
  }

  const orderStatus = String(order.status || order.order_status || 'pending').toLowerCase();
  const overallStep = mapFulfillmentStep(orderStatus);
  const canCancel = orderStatus === 'pending' || orderStatus === 'confirmed';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-16 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => router.push('/buyer/orders')}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">
              Live Tracking · #{order.order_number || order.id}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[#286c00] font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Auto-Sync (15s)
              </span>
              {lastSynced && (
                <span>· Last updated {lastSynced.toLocaleTimeString()}</span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchTrackingData(true)}
          className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Sync Now
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overall Status Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-gray-900">Order Progress</h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  orderStatus === 'cancelled'
                    ? 'bg-red-50 text-red-700'
                    : orderStatus === 'delivered'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {orderStatus.replace(/_/g, ' ')}
              </span>
            </div>

            {orderStatus === 'cancelled' ? (
              <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl text-red-700 border border-red-200">
                <span className="material-symbols-outlined text-3xl">cancel</span>
                <div>
                  <h3 className="font-bold text-sm">Order Cancelled</h3>
                  <p className="text-xs opacity-85">
                    This order has been cancelled and reserved inventory was released.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {STEP_LIST.map((st, idx) => {
                  const completed = overallStep >= idx;
                  return (
                    <div key={st.key} className="flex flex-col items-center text-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                          completed
                            ? 'bg-[#286c00] border-[#286c00] text-white'
                            : 'bg-white border-gray-200 text-gray-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {completed ? 'check' : st.icon}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-bold mt-2 leading-tight ${
                          completed ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Suborder Package Cards */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Seller Packages &amp; Route Telemetry ({order.suborders?.length || deliveries.length || 1})
            </h2>

            {(order.suborders && order.suborders.length > 0 ? order.suborders : [null]).map(
              (sub: any, idx: number) => {
                const matchedDel =
                  deliveries.find((d) => sub && Number(d.suborder_id) === Number(sub.id)) ||
                  deliveries[idx] ||
                  null;

                const subId = sub?.id || matchedDel?.suborder_id;
                const subStatus =
                  sub?.fulfillment_status || matchedDel?.status || orderStatus || 'pending';
                const fType =
                  sub?.fulfillment_type || matchedDel?.fulfillment_type || 'farmer_pickup';
                const pickupCode = sub?.pickup_code || matchedDel?.pickup_verification_code;
                const buyerPin = matchedDel?.delivery_confirmation_code;
                const events: any[] = matchedDel?.events || [];

                const canBuyerConfirm =
                  fType !== 'farmer_pickup' &&
                  ['in_transit', 'dispatched', 'shipped', 'picked_up'].includes(
                    String(subStatus).toLowerCase()
                  );

                const draft = (subId && ratingDrafts[subId]) || {
                  rating: 5,
                  feedback: '',
                  submitting: false,
                };

                return (
                  <div
                    key={subId || idx}
                    className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#286c00]">
                          {sub?.suborder_number || `PACKAGE-${idx + 1}`}
                        </span>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">
                          Producer: {sub?.farmer_name || 'GreenHarvest Farmer'}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-800 rounded-lg text-[11px] font-bold capitalize">
                          {subStatus.replace(/_/g, ' ')}
                        </span>
                        <p className="text-[11px] text-gray-500 mt-1 capitalize">
                          {fType.replace(/_/g, ' ')}
                          {matchedDel?.distance_km ? ` · ${matchedDel.distance_km} km` : ''}
                          {matchedDel?.total_weight_kg ? ` · ${matchedDel.total_weight_kg} kg` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Handover PIN Security Box */}
                    {subStatus !== 'delivered' &&
                      subStatus !== 'cancelled' &&
                      (fType === 'farmer_pickup' ? pickupCode : buyerPin) && (
                        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                          <div className="max-w-sm">
                            <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-[#286c00]">
                                verified_user
                              </span>
                              {fType === 'farmer_pickup'
                                ? 'Your Farm Gate Pickup Code'
                                : 'Your Secret Handover PIN'}
                            </p>
                            <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                              {fType === 'farmer_pickup'
                                ? 'Show this code at the farm gate to verify collection.'
                                : 'Only give this PIN to the courier or farmer AFTER you inspect and receive your harvest. Required to unlock payment.'}
                            </p>
                          </div>
                          <span className="font-mono text-base font-black text-[#286c00] bg-white px-3.5 py-1.5 rounded-lg border border-emerald-300 tracking-wider">
                            {fType === 'farmer_pickup' ? pickupCode : buyerPin}
                          </span>
                        </div>
                      )}

                    {/* Current Route Checkpoint Banner */}
                    {matchedDel?.current_checkpoint && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-gray-800">
                          <span className="material-symbols-outlined text-[18px] text-[#007a6c]">
                            my_location
                          </span>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 block">
                              Latest Location / Checkpoint
                            </span>
                            <span className="font-bold text-gray-900">
                              {matchedDel.current_checkpoint}
                            </span>
                          </div>
                        </div>
                        {matchedDel.estimated_time && (
                          <span className="text-[11px] font-bold text-[#286c00] shrink-0">
                            ETA: {matchedDel.estimated_time}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Origin & Destination */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Pickup Origin
                        </span>
                        <span className="font-semibold text-gray-800">
                          {matchedDel?.pickup_location || 'Producer Farm Gate'}
                        </span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Delivery Destination
                        </span>
                        <span className="font-semibold text-gray-800">
                          {matchedDel?.delivery_location || 'Customer Destination'}
                        </span>
                      </div>
                    </div>

                    {/* Courier Accountability Card */}
                    {matchedDel?.delivery_partner_name && (
                      <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">
                              Courier: {matchedDel.delivery_partner_name}
                            </span>
                            {matchedDel.partner_verification_status === 'verified' && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[12px]">verified</span>
                                Verified
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 mt-0.5">
                            {matchedDel.delivery_partner_phone || ''}
                            {matchedDel.vehicle_plate ? ` · Plate: ${matchedDel.vehicle_plate}` : ''}
                            {matchedDel.vehicle_type ? ` (${matchedDel.vehicle_type})` : ''}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-amber-600 text-sm">
                            ★ {Number(matchedDel.partner_trust_score || 5).toFixed(1)}
                          </span>
                          <p className="text-[10px] text-gray-500">
                            {matchedDel.partner_completed_deliveries || 0} completed trips
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Immutable Delivery Events Audit Timeline */}
                    {events.length > 0 && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                          Live Route &amp; Handover Log
                        </p>
                        <div className="relative pl-5 space-y-3.5 before:absolute before:left-1.5 before:top-1.5 before:bottom-1.5 before:w-px before:bg-gray-200">
                          {events.map((ev) => (
                            <div key={ev.id} className="relative text-xs">
                              <span className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-[#286c00] border-2 border-white" />
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-gray-900">{ev.title}</span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {new Date(ev.created_at).toLocaleString()}
                                </span>
                              </div>
                              {(ev.description || ev.location_name) && (
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  {ev.description}
                                  {ev.location_name ? ` · ${ev.location_name}` : ''}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {matchedDel?.proof_of_delivery_image_url && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                          Proof of Delivery Photo
                        </p>
                        <img
                          src={matchedDel.proof_of_delivery_image_url}
                          alt="Proof of delivery"
                          className="w-44 h-32 object-cover rounded-xl border border-gray-200"
                        />
                      </div>
                    )}

                    {canBuyerConfirm && subId && (
                      <button
                        type="button"
                        disabled={confirmingSubId === subId}
                        onClick={() => handleBuyerConfirmReceipt(subId)}
                        className="w-full py-2.5 bg-[#286c00] hover:bg-[#1f5400] text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {confirmingSubId === subId
                          ? 'Confirming...'
                          : 'I Have Inspected & Received This Package'}
                      </button>
                    )}

                    {/* Post-Delivery Courier / Fulfillment Rating */}
                    {subStatus === 'delivered' && subId && (
                      <div className="pt-3 border-t border-gray-200">
                        {matchedDel?.buyer_rating ? (
                          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
                            <span className="font-bold text-emerald-900">Your Delivery Rating:</span>
                            <span className="font-black text-amber-600">
                              {'★'.repeat(matchedDel.buyer_rating)} ({matchedDel.buyer_rating}/5)
                            </span>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-900">
                                Rate Delivery Experience
                              </span>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() =>
                                      setRatingDrafts((prev) => ({
                                        ...prev,
                                        [subId]: { ...draft, rating: star },
                                      }))
                                    }
                                    className={`text-lg cursor-pointer ${
                                      star <= draft.rating ? 'text-amber-500' : 'text-gray-300'
                                    }`}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={draft.feedback}
                                onChange={(e) =>
                                  setRatingDrafts((prev) => ({
                                    ...prev,
                                    [subId]: { ...draft, feedback: e.target.value },
                                  }))
                                }
                                placeholder="Optional feedback on timeliness & produce care..."
                                className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#286c00]"
                              />
                              <button
                                type="button"
                                disabled={draft.submitting}
                                onClick={() => handleSubmitRating(subId)}
                                className="px-3.5 py-1.5 bg-[#286c00] text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                              >
                                {draft.submitting ? 'Saving...' : 'Rate'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Right Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-4">Order Items</h2>

            <div className="space-y-3 mb-5 max-h-72 overflow-y-auto">
              {(order.items || []).map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="flex justify-between items-start text-sm pb-3 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-bold text-gray-900">{item.product_name || item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity} {item.unit || 'kg'} × ETB {Number(item.price).toFixed(2)}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900 tabular-nums">
                    ETB {(Number(item.quantity) * Number(item.price)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Payment Status</span>
                <span className="font-bold uppercase text-gray-900">
                  {order.payment_status || 'pending'}
                </span>
              </div>
              <div className="flex justify-between font-black text-base text-gray-900 pt-1">
                <span>Total Paid</span>
                <span className="text-[#286c00] tabular-nums">
                  ETB {Number(order.total_amount || order.total_price || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {canCancel && (
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="w-full py-3.5 px-4 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              <span>{cancelling ? 'Cancelling Order...' : 'Cancel Order'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

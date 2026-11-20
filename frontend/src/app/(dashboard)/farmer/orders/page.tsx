'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface OrderItem {
  product_id?: number;
  product_name: string;
  quantity: number;
  price: number;
  unit?: string;
  category_name?: string;
  image_url?: string;
}

interface FarmerOrder {
  id?: number;
  order_id: number;
  order_status: 'pending' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';
  total_amount: number | string;
  farmer_total?: number | string;
  payment_status?: string;
  delivery_address?: string;
  delivery_status?: string;
  created_at: string;
  buyer_name: string;
  buyer_phone?: string;
  buyer_email?: string;
  items: OrderItem[];
}

export default function ManageOrdersPage() {
  const { showSuccess, showError } = useToast();
  const [orders, setOrders] = useState<FarmerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const mappedStatus = activeTab === 'all' ? undefined : activeTab;
      const res = await api.getFarmerOrders({
        page,
        limit: 10,
        status: mappedStatus,
        search: searchQuery.trim() || undefined,
      });

      setOrders(res.orders || []);
      setTotalPages(res.pagination?.total_pages || 1);
      setTotalOrders(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load farmer orders:', err);
      showError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadOrders();
  };

  const handleStatusTransition = async (
    orderId: number,
    nextStatus: 'confirmed' | 'in_transit' | 'delivered'
  ) => {
    setUpdatingId(orderId);
    try {
      await api.updateOrderStatus(String(orderId), nextStatus);
      setOrders((prev) =>
        prev.map((o) => (Number(o.order_id || o.id) === orderId ? { ...o, order_status: nextStatus } : o))
      );

      const statusLabels: Record<string, string> = {
        confirmed: 'Order confirmed and ready for packing!',
        in_transit: 'Order marked as shipped / in transit!',
        delivered: 'Order marked as delivered successfully!',
      };
      showSuccess(statusLabels[nextStatus] || 'Order status updated.');
    } catch (err: any) {
      console.error('Status transition failed:', err);
      showError(err.response?.data?.message || 'Failed to update order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStepProgress = (status: string) => {
    switch (status) {
      case 'pending':
        return 1;
      case 'confirmed':
        return 2;
      case 'in_transit':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 0; // cancelled
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-8 bg-[#fafafa]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Order Fulfillment & Sales</h1>
          <p className="text-sm text-gray-500 mt-1">
            Accept buyer orders, pack farm harvests, and hand over produce for delivery.
          </p>
        </div>

        <Link
          href="/farmer/shipping"
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all shadow-xs flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">local_shipping</span>
          Shipping & Logistics Hub
        </Link>
      </div>

      {/* Filter Tabs and Search */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto max-w-full">
          {[
            { label: 'All Orders', val: 'all' },
            { label: 'Pending Confirmation', val: 'pending' },
            { label: 'Confirmed / Packing', val: 'confirmed' },
            { label: 'In Transit', val: 'in_transit' },
            { label: 'Delivered', val: 'delivered' },
            { label: 'Cancelled', val: 'cancelled' },
          ].map((tab) => (
            <button
              key={tab.val}
              type="button"
              onClick={() => {
                setActiveTab(tab.val);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.val ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Search by Order ID or Buyer Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] w-64 sm:w-80 font-medium"
          />
        </form>
      </div>

      {/* Orders List */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center text-gray-400 border border-gray-100">
            <div className="w-8 h-8 border-3 border-[#16a34a] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading your farm orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center text-gray-500 border border-gray-100">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#16a34a] flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl">receipt_long</span>
            </div>
            <p className="font-bold text-gray-800 text-base mb-1">No orders found</p>
            <p className="text-xs text-gray-400">
              {activeTab === 'all'
                ? 'Your farm has not received any buyer orders yet.'
                : `No orders in "${activeTab}" status.`}
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const currentOrderId = Number(order.order_id || order.id);
            const step = getStepProgress(order.order_status);
            const isCancelled = order.order_status === 'cancelled';
            const isUpdating = updatingId === currentOrderId;

            return (
              <div
                key={currentOrderId}
                className="bg-white rounded-3xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Order Top Card Header */}
                <div className="bg-gray-50/70 p-4 sm:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-800 font-bold text-sm shadow-2xs">
                      #{currentOrderId}
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">
                        Placed on {new Date(order.created_at).toLocaleDateString()} at{' '}
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-bold text-gray-900 text-sm">
                        Buyer: {order.buyer_name || 'Verified Buyer'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Payment Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                        order.payment_status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {order.payment_status === 'paid' ? 'check_circle' : 'pending'}
                      </span>
                      {order.payment_status === 'paid' ? 'Paid via Chapa' : 'Payment Pending'}
                    </span>

                    {/* Order Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isCancelled
                          ? 'bg-red-50 text-red-700'
                          : order.order_status === 'delivered'
                          ? 'bg-emerald-50 text-emerald-700'
                          : order.order_status === 'in_transit'
                          ? 'bg-blue-50 text-blue-700'
                          : order.order_status === 'confirmed'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {order.order_status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Fulfillment Stepper */}
                {!isCancelled && (
                  <div className="px-6 pt-5 pb-2">
                    <div className="flex items-center justify-between max-w-2xl mx-auto relative">
                      {[
                        { num: 1, label: 'Order Placed' },
                        { num: 2, label: 'Confirmed & Packing' },
                        { num: 3, label: 'In Transit / Shipped' },
                        { num: 4, label: 'Delivered' },
                      ].map((s, idx) => (
                        <div key={s.num} className="flex flex-col items-center relative z-10">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                              step >= s.num
                                ? 'bg-[#16a34a] text-white shadow-xs'
                                : 'bg-gray-100 text-gray-400 border border-gray-200'
                            }`}
                          >
                            {step > s.num ? (
                              <span className="material-symbols-outlined text-sm">check</span>
                            ) : (
                              s.num
                            )}
                          </div>
                          <span
                            className={`text-[11px] font-semibold mt-1.5 whitespace-nowrap ${
                              step >= s.num ? 'text-gray-900' : 'text-gray-400'
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                      ))}

                      {/* Stepper Progress Bar */}
                      <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-200 -z-0">
                        <div
                          className="h-full bg-[#16a34a] transition-all duration-300"
                          style={{
                            width:
                              step === 1
                                ? '0%'
                                : step === 2
                                ? '33%'
                                : step === 3
                                ? '66%'
                                : step >= 4
                                ? '100%'
                                : '0%',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Details Body */}
                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Itemized Produce */}
                  <div className="lg:col-span-2 space-y-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                      Harvest Produce Ordered
                    </span>

                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                      {order.items &&
                        order.items.map((item, idx) => (
                          <div key={idx} className="p-3.5 flex items-center justify-between gap-3 bg-white">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0 overflow-hidden border border-gray-200">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <span className="material-symbols-outlined text-lg">spa</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 text-sm block">
                                  {item.product_name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {item.quantity} {item.unit || 'kg'} × ETB {Number(item.price).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <span className="font-bold text-gray-900 text-sm">
                              ETB {(Number(item.quantity) * Number(item.price)).toLocaleString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Right Col: Logistics & Action */}
                  <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-100 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                        Buyer & Delivery Address
                      </span>

                      <div>
                        <span className="text-xs font-bold text-gray-800 block">{order.buyer_name}</span>
                        {order.buyer_phone && (
                          <a
                            href={`tel:${order.buyer_phone}`}
                            className="text-xs text-[#16a34a] hover:underline font-semibold flex items-center gap-1 mt-0.5"
                          >
                            <span className="material-symbols-outlined text-sm">call</span>
                            {order.buyer_phone}
                          </a>
                        )}
                        <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                          <span className="material-symbols-outlined text-sm shrink-0 text-gray-400">pin_drop</span>
                          <span>{order.delivery_address || 'Standard Delivery Location'}</span>
                        </p>
                      </div>

                      <div className="border-t border-gray-200/80 pt-3 flex justify-between items-baseline">
                        <span className="text-xs font-semibold text-gray-500">Your Share:</span>
                        <span className="text-base font-black text-[#16a34a]">
                          ETB {Number(order.farmer_total || order.total_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-gray-200/60">
                      {order.order_status === 'pending' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStatusTransition(currentOrderId, 'confirmed')}
                          className="w-full py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isUpdating ? 'Updating...' : 'Accept & Confirm Order'}
                        </button>
                      )}

                      {order.order_status === 'confirmed' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStatusTransition(currentOrderId, 'in_transit')}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isUpdating ? 'Updating...' : 'Mark Packed & Ship Harvest'}
                        </button>
                      )}

                      {order.order_status === 'in_transit' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStatusTransition(currentOrderId, 'delivered')}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isUpdating ? 'Updating...' : 'Confirm Delivery Completed'}
                        </button>
                      )}

                      <Link
                        href={`/farmer/shipping?orderId=${currentOrderId}`}
                        className="w-full py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">print</span>
                        Print Packing Slip
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 bg-white rounded-2xl border border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>
            Page {page} of {totalPages} ({totalOrders} orders received)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

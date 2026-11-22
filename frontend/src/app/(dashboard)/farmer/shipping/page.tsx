'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

function ShippingManagementContent() {
  const searchParams = useSearchParams();
  const queryOrderId = searchParams.get('orderId');

  const { showSuccess, showError } = useToast();
  const [orders, setOrders] = useState<FarmerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'to_ship' | 'in_transit' | 'delivered'>('to_ship');
  const [searchQuery, setSearchQuery] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // Farmer / Farm Info for packing slip
  const [farmerProfile, setFarmerProfile] = useState<any>(null);

  // Packing slip modal
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState<FarmerOrder | null>(null);

  // Dispatch confirmation modal
  const [dispatchingOrder, setDispatchingOrder] = useState<FarmerOrder | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState('Farm Direct Delivery');
  const [trackingNotes, setTrackingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected orders for batch operations
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    loadFarmerProfile();
  }, []);

  const loadFarmerProfile = async () => {
    try {
      const res = await api.getUserProfile();
      setFarmerProfile(res.user || null);
    } catch {
      // Non-blocking fallback
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      let mappedStatus: string | undefined = undefined;
      if (activeTab === 'to_ship') mappedStatus = 'confirmed';
      else if (activeTab === 'in_transit') mappedStatus = 'in_transit';
      else if (activeTab === 'delivered') mappedStatus = 'delivered';

      const res = await api.getFarmerOrders({
        page,
        limit: 15,
        status: mappedStatus,
        search: searchQuery.trim() || undefined,
      });

      const fetched: FarmerOrder[] = res.orders || [];
      setOrders(fetched);
      setTotalPages(res.pagination?.total_pages || 1);
      setTotalOrders(res.pagination?.total || 0);

      // If queryOrderId is present, auto-open packing slip for that order
      if (queryOrderId) {
        const found = fetched.find((o) => (o.id || o.order_id).toString() === queryOrderId);
        if (found) {
          setSelectedOrderForSlip(found);
        }
      }
    } catch (err) {
      console.error('Failed to load shipments:', err);
      showError('Failed to load shipments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadOrders();
  };

  const handleStatusUpdate = async (orderId: number, nextStatus: string) => {
    try {
      setIsSubmitting(true);
      await api.updateOrderStatus(orderId.toString(), nextStatus);
      showSuccess(`Shipment status updated to "${nextStatus.replace('_', ' ')}".`);
      setDispatchingOrder(null);
      loadOrders();
    } catch (err: any) {
      console.error('Failed to update shipment status:', err);
      showError(err.message || 'Failed to update shipment status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectOrder = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((o) => o.id || o.order_id));
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 pb-24">
      {/* Print CSS Rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-packing-slip,
          #printable-packing-slip * {
            visibility: visible;
          }
          #printable-packing-slip {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 24px;
            background: white !important;
            z-index: 999999;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#16a34a] text-2xl">local_shipping</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Shipping & Logistics</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Dispatch fresh farm harvests, generate official packing slips, and monitor customer deliveries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/farmer/orders"
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            Manage Orders
          </Link>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const target = orders[0];
                if (target) setSelectedOrderForSlip(target);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Print Waybill / Slip
            </button>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('to_ship');
            setPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'to_ship'
              ? 'bg-[#16a34a] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">inventory_2</span>
          Ready to Ship / Pack
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('in_transit');
            setPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'in_transit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">local_shipping</span>
          In Transit
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('delivered');
            setPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'delivered'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">verified</span>
          Delivered
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-gray-800 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">dataset</span>
          All Shipments
        </button>
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearch} className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID, Buyer Name, or Destination..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50/80 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] transition-all"
          />
        </div>

        <select
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30"
        >
          <option value="all">All Delivery Modes</option>
          <option value="direct">Farm Direct Delivery</option>
          <option value="greenharvest">GreenHarvest Logistics</option>
          <option value="carrier">Local Transporter / Ethio-Post</option>
        </select>

        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-colors"
        >
          Filter
        </button>

        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setPage(1);
              loadOrders();
            }}
            className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </form>

      {/* Shipments Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100">
          <div className="w-10 h-10 border-4 border-[#16a34a] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading Logistics Dispatches...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 p-8">
          <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl">local_shipping</span>
          </div>
          <h3 className="text-base font-bold text-gray-800">No Shipments Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
            {activeTab === 'to_ship'
              ? 'No orders are waiting to be packed and dispatched right now.'
              : 'No shipments match the selected filter criteria.'}
          </p>
          <Link
            href="/farmer/orders"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#16a34a] text-white text-xs font-bold rounded-xl hover:bg-[#15803d] transition-colors"
          >
            Check Pending Orders
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-[#16a34a] focus:ring-[#16a34a] cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Shipment / Order</th>
                  <th className="p-4">Harvest Produce</th>
                  <th className="p-4">Destination & Contact</th>
                  <th className="p-4">Status & Payment</th>
                  <th className="p-4">Farmer Share</th>
                  <th className="p-4 text-right">Logistics Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const currentOrderId = order.id || order.order_id;
                  const item = order.items && order.items[0] ? order.items[0] : null;
                  const totalItems = order.items ? order.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0;
                  const isSelected = selectedIds.includes(currentOrderId);

                  return (
                    <tr key={currentOrderId} className={`hover:bg-gray-50/60 transition-colors ${isSelected ? 'bg-green-50/30' : ''}`}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(currentOrderId)}
                          className="rounded border-gray-300 text-[#16a34a] focus:ring-[#16a34a] cursor-pointer"
                        />
                      </td>

                      <td className="p-4">
                        <span className="font-mono font-bold text-gray-900">#GH-{currentOrderId}</span>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {item?.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.product_name}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-green-50 text-[#16a34a] flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-lg">spa</span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-gray-800 line-clamp-1">{item?.product_name || 'Farm Produce'}</p>
                            <p className="text-[11px] text-gray-500">
                              {order.items?.length > 1
                                ? `${item?.quantity} ${item?.unit || 'kg'} + ${order.items.length - 1} other item(s)`
                                : `${item?.quantity} ${item?.unit || 'kg'} total`}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 max-w-[200px]">
                        <p className="font-semibold text-gray-800">{order.buyer_name}</p>
                        {order.buyer_phone && (
                          <p className="text-[11px] text-gray-500 font-mono mt-0.5">{order.buyer_phone}</p>
                        )}
                        <p className="text-[11px] text-gray-400 truncate mt-0.5" title={order.delivery_address}>
                          {order.delivery_address || 'Addis Ababa / Regional'}
                        </p>
                      </td>

                      <td className="p-4">
                        <div className="space-y-1">
                          {order.order_status === 'pending' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Order Pending
                            </span>
                          )}
                          {order.order_status === 'confirmed' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              Ready for Dispatch
                            </span>
                          )}
                          {order.order_status === 'in_transit' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              In Transit
                            </span>
                          )}
                          {order.order_status === 'delivered' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Delivered
                            </span>
                          )}
                          {order.order_status === 'cancelled' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              Cancelled
                            </span>
                          )}

                          <div>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider ${
                                order.payment_status === 'paid' ? 'text-[#16a34a]' : 'text-gray-400'
                              }`}
                            >
                              {order.payment_status === 'paid' ? '✓ Paid (Chapa)' : 'Payment Pending'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-black text-[#16a34a] text-sm">
                          ETB {Number(order.farmer_total || order.total_amount).toLocaleString()}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForSlip(order)}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                            title="View and print official packing slip"
                          >
                            <span className="material-symbols-outlined text-sm">print</span>
                            Packing Slip
                          </button>

                          {order.order_status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => setDispatchingOrder(order)}
                              className="px-3 py-1.5 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">local_shipping</span>
                              Dispatch
                            </button>
                          )}

                          {order.order_status === 'in_transit' && (
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(currentOrderId, 'delivered')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                              Delivered
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Page {page} of {totalPages} ({totalOrders} shipments recorded)
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
      )}

      {/* DISPATCH CONFIRMATION MODAL */}
      {dispatchingOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 text-[#16a34a] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">local_shipping</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Dispatch Order #GH-{dispatchingOrder.id || dispatchingOrder.order_id}</h3>
                  <p className="text-[11px] text-gray-400">Hand off harvest produce to transport carrier</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchingOrder(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">Logistics / Delivery Mode</label>
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                >
                  <option value="Farm Direct Delivery">Farm Direct Delivery (Farmer vehicle / dispatch)</option>
                  <option value="GreenHarvest Logistics Hub">GreenHarvest Central Hub Logistics</option>
                  <option value="Ethio-Post Express">Ethio-Post Express / Inter-city Bus</option>
                  <option value="Buyer Self-Pickup">Buyer Farm Gate Pickup</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1.5">Driver / Dispatch Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={trackingNotes}
                  onChange={(e) => setTrackingNotes(e.target.value)}
                  placeholder="e.g., Driver: Abebe (0911-000000), Isuzu Truck Plate 3-A12345, departing 9:00 AM..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2.5 text-amber-800">
                <span className="material-symbols-outlined text-base shrink-0 text-amber-600">info</span>
                <p className="text-[11px] leading-relaxed">
                  Marking this harvest as <strong>In Transit</strong> notifies the customer and triggers live delivery tracking on their portal.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDispatchingOrder(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() =>
                  handleStatusUpdate(dispatchingOrder.id || dispatchingOrder.order_id, 'in_transit')
                }
                className="px-5 py-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE PACKING SLIP MODAL */}
      {selectedOrderForSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Controls (Hidden in Print) */}
            <div className="no-print flex items-center justify-between pb-6 border-b border-gray-200 mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#16a34a]">receipt_long</span>
                <span className="text-sm font-bold text-gray-800">Packing Slip & Commercial Waybill Preview</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Print Packing Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForSlip(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* PRINTABLE CONTAINER */}
            <div id="printable-packing-slip" className="text-gray-800 bg-white">
              {/* Slip Header */}
              <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#16a34a] flex items-center justify-center text-white font-black text-base">
                      GH
                    </div>
                    <span className="text-xl font-black tracking-tight text-gray-900">GreenHarvest Solutions</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Ethiopian Direct Agro-Commerce Platform</p>
                  <p className="text-xs text-gray-500">Addis Ababa, Ethiopia | support@greenharvest.et</p>
                </div>

                <div className="text-right">
                  <h2 className="text-lg font-black uppercase tracking-wider text-gray-900">HARVEST DISPATCH & COMMERCIAL WAYBILL</h2>
                  <p className="text-xs font-mono font-bold text-[#16a34a] mt-0.5">
                    DOC #GH-WAYBILL-{(selectedOrderForSlip.id || selectedOrderForSlip.order_id).toString().padStart(6, '0')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Transport Ref: #ET-GH-{(selectedOrderForSlip.id || selectedOrderForSlip.order_id).toString().padStart(5, '0')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Date: {new Date(selectedOrderForSlip.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Farmer and Buyer Columns */}
              <div className="grid grid-cols-2 gap-8 mb-6 pb-6 border-b border-gray-200 text-xs">
                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-1">PRODUCER / DISPATCH ORIGIN</p>
                  <p className="font-bold text-gray-900 text-sm">{farmerProfile?.name || 'Verified GreenHarvest Farmer'}</p>
                  <p className="text-gray-600 mt-0.5">Farm: {farmerProfile?.farm_location || 'Certified Ethiopian Farm'}</p>
                  {farmerProfile?.phone && (
                    <p className="text-gray-600 font-mono mt-0.5">Tel: {farmerProfile.phone}</p>
                  )}
                  <p className="text-gray-500 mt-0.5">Email: {farmerProfile?.email || 'N/A'}</p>
                </div>

                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-1">BUYER / DESTINATION</p>
                  <p className="font-bold text-gray-900 text-sm">{selectedOrderForSlip.buyer_name}</p>
                  <p className="text-gray-600 mt-0.5">
                    Address: {selectedOrderForSlip.delivery_address || 'Addis Ababa / Regional Distribution Point'}
                  </p>
                  {selectedOrderForSlip.buyer_phone && (
                    <p className="text-gray-600 font-mono mt-0.5">Tel: {selectedOrderForSlip.buyer_phone}</p>
                  )}
                  {selectedOrderForSlip.buyer_email && (
                    <p className="text-gray-500 mt-0.5">Email: {selectedOrderForSlip.buyer_email}</p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-6">
                <table className="w-full text-left text-xs border border-gray-200">
                  <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3 border-b border-gray-200">#</th>
                      <th className="p-3 border-b border-gray-200">Produce / Variety</th>
                      <th className="p-3 border-b border-gray-200">Category</th>
                      <th className="p-3 border-b border-gray-200 text-center">Quantity</th>
                      <th className="p-3 border-b border-gray-200 text-right">Unit Price (ETB)</th>
                      <th className="p-3 border-b border-gray-200 text-right">Total (ETB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedOrderForSlip.items?.map((item, idx) => {
                      const itemTotal = Number(item.quantity) * Number(item.price);
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-3 font-mono text-gray-500">{idx + 1}</td>
                          <td className="p-3 font-bold text-gray-900">{item.product_name}</td>
                          <td className="p-3 text-gray-600">{item.category_name || 'Agricultural Produce'}</td>
                          <td className="p-3 text-center font-bold text-gray-800">
                            {item.quantity} {item.unit || 'kg'}
                          </td>
                          <td className="p-3 text-right font-mono text-gray-600">
                            {Number(item.price).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900">
                            {itemTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Payment Status:</span>
                    <span className="font-bold uppercase text-gray-900">
                      {selectedOrderForSlip.payment_status === 'paid' ? 'PAID (Chapa / Telebirr)' : 'PENDING'}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Order Total:</span>
                    <span className="font-mono">ETB {Number(selectedOrderForSlip.total_amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-2 text-sm font-black text-[#16a34a]">
                    <span>Harvest Value:</span>
                    <span>ETB {Number(selectedOrderForSlip.farmer_total || selectedOrderForSlip.total_amount).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Quality & Dispatch Declaration */}
              <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 mb-8 text-[11px] text-gray-600 leading-relaxed">
                <p className="font-bold text-gray-800 mb-1">Quality & Freshness Compliance Statement:</p>
                <p>
                  This harvest has been visually inspected for agricultural freshness, compliance with Ethiopian standard grading,
                  and careful packaging to minimize transit perishability. For any discrepancy or dispute, report within 24 hours
                  of receipt through GreenHarvest Returns Management.
                </p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 pt-4 border-t border-gray-300 text-xs">
                <div>
                  <div className="h-10 border-b border-gray-400 mb-2"></div>
                  <p className="font-bold text-gray-800">Authorized Farmer / Dispatcher Signature</p>
                  <p className="text-[10px] text-gray-400">Date: ________________________</p>
                </div>
                <div>
                  <div className="h-10 border-b border-gray-400 mb-2"></div>
                  <p className="font-bold text-gray-800">Carrier / Recipient Receiving Signature</p>
                  <p className="text-[10px] text-gray-400">Date: ________________________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShippingManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-4 border-[#16a34a] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-bold">Loading Shipping Management...</p>
        </div>
      }
    >
      <ShippingManagementContent />
    </Suspense>
  );
}

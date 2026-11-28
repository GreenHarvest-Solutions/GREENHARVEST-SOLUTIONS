'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface TrackingEvent {
  status: string;
  label: string;
  description: string;
  timestamp?: string;
  completed: boolean;
  current: boolean;
  icon: string;
}

interface SuborderTracking {
  id: number;
  suborder_number: string;
  farmer_name: string;
  fulfillment_status: string;
  fulfillment_type: string;
  shipping_fee: number;
  tracking_number?: string;
  estimated_delivery_date?: string;
  branch_snapshot?: {
    branch_name?: string;
    branch_type?: string;
    city?: string;
    region?: string;
    gps_lat?: number;
    gps_lng?: number;
  };
  delivery_zone?: string;
  courier_name?: string;
  courier_phone?: string;
  pickup_code?: string;
  delivery_evidence_url?: string;
  items?: Array<{
    product_name: string;
    quantity: number;
    price: number;
    unit?: string;
  }>;
}

interface OrderDetail {
  id: number;
  order_number: string;
  order_status: string;
  payment_status: string;
  total_price: number;
  created_at: string;
  delivery_address?: string;
  suborders: SuborderTracking[];
}

const TRACKING_STEPS: { status: string; label: string; icon: string; desc: string }[] = [
  { status: 'pending',    label: 'Order Placed',       icon: 'receipt',          desc: 'Your order has been received and is awaiting farmer confirmation.' },
  { status: 'confirmed',  label: 'Confirmed',          icon: 'store',            desc: 'The farmer has confirmed availability and is preparing your order.' },
  { status: 'processing', label: 'Being Packed',       icon: 'inventory_2',      desc: 'Your fresh produce is being packed at the farm or warehouse.' },
  { status: 'shipped',    label: 'Out for Delivery',   icon: 'local_shipping',   desc: 'Your order is on its way to your delivery address.' },
  { status: 'delivered',  label: 'Delivered',          icon: 'check_circle',     desc: 'Your order has been delivered successfully.' },
];

function buildTrackingTimeline(currentStatus: string): TrackingEvent[] {
  const statusOrder = TRACKING_STEPS.map(s => s.status);
  const currentIdx = statusOrder.indexOf(currentStatus);
  return TRACKING_STEPS.map((step, idx) => ({
    status: step.status,
    label: step.label,
    description: step.desc,
    completed: idx < (currentIdx < 0 ? 0 : currentIdx),
    current: step.status === currentStatus,
    icon: step.icon,
    timestamp: undefined,
  }));
}

const fulfillmentTypeLabels: Record<string, string> = {
  farmer_direct: 'Farmer Direct Delivery',
  courier: 'GreenHarvest Courier',
  farm_gate_pickup: 'Farm Gate Pickup',
};

const statusColors: Record<string, string> = {
  pending:    'text-amber-700 bg-amber-50 border-amber-200',
  confirmed:  'text-blue-700 bg-blue-50 border-blue-200',
  processing: 'text-violet-700 bg-violet-50 border-violet-200',
  shipped:    'text-indigo-700 bg-indigo-50 border-indigo-200',
  delivered:  'text-green-700 bg-green-50 border-green-200',
  cancelled:  'text-red-700 bg-red-50 border-red-200',
};

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { showError } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSuborder, setActiveSuborder] = useState<number>(0);
  const [messages, setMessages] = useState<{ id: number; message: string; sender: string; created_at: string }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showComms, setShowComms] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (api as unknown as {
        getOrderDetail: (id: string) => Promise<{ order: OrderDetail }>
      }).getOrderDetail(orderId);
      setOrder(res.order);
    } catch {
      showError('Order not found');
      router.push('/buyer/orders');
    } finally {
      setLoading(false);
    }
  }, [orderId, showError, router]);

  const fetchMessages = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.getOrderCommunications(orderId);
      setMessages(res.messages || []);
    } catch {
      /* non-critical */
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    fetchMessages();
  }, [fetchOrder, fetchMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !order) return;
    setSendingMsg(true);
    try {
      const sub = order.suborders[activeSuborder];
      await api.postOrderCommunication(order.id, {
        suborder_id: sub?.id,
        message: newMessage.trim(),
        channel: 'buyer_message',
      });
      setNewMessage('');
      await fetchMessages();
    } catch {
      showError('Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="material-icons animate-spin text-green-500 text-4xl block mb-3">refresh</span>
          <p className="text-gray-500">Loading tracking details…</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const sub = order.suborders?.[activeSuborder];
  const timeline = buildTrackingTimeline(sub?.fulfillment_status || order.order_status);
  const isDelivered = sub?.fulfillment_status === 'delivered' || order.order_status === 'delivered';
  const isCancelled = order.order_status === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Link
          href="/buyer/orders"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5"
        >
          <span className="material-icons text-sm">arrow_back</span>
          Back to Orders
        </Link>

        {/* Order header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Order {order.order_number || `#${order.id}`}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Placed on {new Date(order.created_at).toLocaleDateString('en-ET', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {order.delivery_address && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <span className="material-icons text-xs">location_on</span>
                  {order.delivery_address}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full border font-medium ${statusColors[order.order_status] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                <span className="material-icons text-sm">
                  {order.order_status === 'delivered' ? 'check_circle' :
                   order.order_status === 'shipped' ? 'local_shipping' :
                   order.order_status === 'cancelled' ? 'cancel' : 'schedule'}
                </span>
                {order.order_status?.charAt(0).toUpperCase() + order.order_status?.slice(1)}
              </span>
              <p className="text-lg font-bold text-gray-900 mt-2">
                {order.total_price?.toLocaleString()} ETB
              </p>
            </div>
          </div>
        </div>

        {/* Multi-suborder tabs */}
        {order.suborders && order.suborders.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {order.suborders.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveSuborder(idx)}
                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition border ${
                  activeSuborder === idx
                    ? 'bg-green-600 text-white border-green-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                }`}
              >
                <span className="material-icons text-sm mr-1">store</span>
                {s.farmer_name || `Farmer ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {sub && (
          <div className="grid md:grid-cols-3 gap-5">
            {/* Timeline */}
            <div className="md:col-span-2 space-y-4">
              {/* Suborder info */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <p className="text-xs text-gray-400">Suborder</p>
                    <p className="font-semibold text-gray-800">{sub.suborder_number}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColors[sub.fulfillment_status] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                    {sub.fulfillment_status?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Fulfillment method */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <span className="material-icons text-sm text-green-500">
                    {sub.fulfillment_type === 'farm_gate_pickup' ? 'storefront' : 'local_shipping'}
                  </span>
                  <span>{fulfillmentTypeLabels[sub.fulfillment_type] || sub.fulfillment_type}</span>
                  {sub.delivery_zone && (
                    <span className="ml-auto text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                      {sub.delivery_zone}
                    </span>
                  )}
                </div>

                {/* Branch origin */}
                {sub.branch_snapshot && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100 mb-3">
                    <p className="text-xs text-green-600 font-medium mb-1 flex items-center gap-1">
                      <span className="material-icons text-xs">store</span>
                      Fulfilled from Branch
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {sub.branch_snapshot.branch_name || 'Farm Branch'}
                    </p>
                    {(sub.branch_snapshot.city || sub.branch_snapshot.region) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[sub.branch_snapshot.city, sub.branch_snapshot.region].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {sub.branch_snapshot.branch_type && (
                      <span className="text-xs text-green-600 capitalize">{sub.branch_snapshot.branch_type.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                )}

                {/* Courier info */}
                {sub.courier_name && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 mb-3">
                    <p className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1">
                      <span className="material-icons text-xs">delivery_dining</span>
                      Delivery Partner
                    </p>
                    <p className="text-sm font-semibold text-gray-800">{sub.courier_name}</p>
                    {sub.courier_phone && (
                      <a href={`tel:${sub.courier_phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                        <span className="material-icons text-xs">phone</span>
                        {sub.courier_phone}
                      </a>
                    )}
                  </div>
                )}

                {/* Farm pickup code */}
                {sub.fulfillment_type === 'farm_gate_pickup' && sub.pickup_code && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-amber-700 font-medium mb-1 flex items-center gap-1">
                      <span className="material-icons text-xs">qr_code</span>
                      Pickup Code
                    </p>
                    <p className="text-2xl font-mono font-bold text-amber-800 tracking-widest">{sub.pickup_code}</p>
                    <p className="text-xs text-amber-600 mt-1">Show this code at the farm gate to collect your order.</p>
                  </div>
                )}

                {/* Tracking number */}
                {sub.tracking_number && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span className="material-icons text-xs">tag</span>
                    Tracking: <span className="font-mono font-semibold">{sub.tracking_number}</span>
                  </p>
                )}

                {/* ETA */}
                {sub.estimated_delivery_date && !isDelivered && (
                  <div className="mt-3 text-sm text-gray-600 flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
                    <span className="material-icons text-sm text-indigo-500">schedule</span>
                    <span>Estimated delivery: <strong>{new Date(sub.estimated_delivery_date).toLocaleDateString('en-ET', { weekday: 'long', month: 'short', day: 'numeric' })}</strong></span>
                  </div>
                )}

                {/* Delivery photo proof */}
                {sub.delivery_evidence_url && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <span className="material-icons text-xs">photo_camera</span>
                      Delivery Photo Proof
                    </p>
                    <img
                      src={sub.delivery_evidence_url}
                      alt="Delivery evidence"
                      className="rounded-lg border border-gray-200 max-h-40 object-cover w-full"
                    />
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="material-icons text-green-500 text-sm">timeline</span>
                  Delivery Progress
                </h3>
                {isCancelled ? (
                  <div className="flex items-center gap-3 text-red-700 bg-red-50 p-4 rounded-lg border border-red-200">
                    <span className="material-icons">cancel</span>
                    <div>
                      <p className="font-semibold">Order Cancelled</p>
                      <p className="text-sm text-red-600">This order has been cancelled.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {timeline.map((step, idx) => (
                      <div key={step.status} className="flex gap-4">
                        {/* Dot + line */}
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                            step.current ? 'bg-green-600 border-green-600 shadow-lg shadow-green-200' :
                            step.completed ? 'bg-green-100 border-green-400' :
                            'bg-gray-50 border-gray-200'
                          }`}>
                            <span className={`material-icons text-sm ${
                              step.current ? 'text-white' :
                              step.completed ? 'text-green-600' : 'text-gray-300'
                            }`}>
                              {step.completed ? 'check' : step.icon}
                            </span>
                          </div>
                          {idx < timeline.length - 1 && (
                            <div className={`w-0.5 h-8 ${step.completed ? 'bg-green-400' : 'bg-gray-200'}`} />
                          )}
                        </div>
                        {/* Text */}
                        <div className="pb-6 flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${step.current ? 'text-green-700' : step.completed ? 'text-gray-700' : 'text-gray-400'}`}>
                            {step.label}
                            {step.current && (
                              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current</span>
                            )}
                          </p>
                          <p className={`text-xs mt-0.5 ${step.current ? 'text-gray-600' : 'text-gray-400'}`}>
                            {step.description}
                          </p>
                          {step.timestamp && (
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(step.timestamp).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items */}
              {sub.items && sub.items.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                    <span className="material-icons text-sm text-green-500">shopping_basket</span>
                    Items in this Package
                  </h3>
                  <div className="space-y-2">
                    {sub.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-50 rounded text-xs flex items-center justify-center text-green-700 font-medium">
                            {item.quantity}
                          </span>
                          <span className="text-gray-700">{item.product_name}</span>
                          {item.unit && <span className="text-gray-400 text-xs">{item.unit}</span>}
                        </div>
                        <span className="text-gray-600 font-medium">{(item.quantity * item.price).toLocaleString()} ETB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar: Communications */}
            <div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowComms(!showComms)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                    <span className="material-icons text-sm text-blue-500">chat</span>
                    Order Communications
                    {messages.length > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5">
                        {messages.length}
                      </span>
                    )}
                  </span>
                  <span className="material-icons text-gray-400 text-sm">
                    {showComms ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showComms && (
                  <div className="border-t border-gray-100">
                    <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                      {messages.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">No messages yet</p>
                      ) : (
                        messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-2 rounded-lg text-xs ${
                              msg.sender === 'buyer'
                                ? 'bg-green-50 text-green-800 ml-4'
                                : 'bg-gray-50 text-gray-700 mr-4'
                            }`}
                          >
                            <p className="font-medium capitalize mb-0.5">{msg.sender}</p>
                            <p>{msg.message}</p>
                            <p className="text-gray-400 mt-0.5">{new Date(msg.created_at).toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="border-t border-gray-100 p-3 flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a message…"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={sendingMsg || !newMessage.trim()}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <span className="material-icons text-sm">send</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping fee */}
              <div className="mt-3 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-2">Delivery Fee</p>
                <p className="text-xl font-bold text-gray-900">
                  {sub.shipping_fee > 0 ? `${sub.shipping_fee.toLocaleString()} ETB` : 'Free Pickup'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {sub.fulfillment_type === 'farm_gate_pickup'
                    ? 'No delivery fee — pickup at farm'
                    : 'Calculated based on distance and zone'}
                </p>
              </div>

              {/* Help */}
              <div className="mt-3 bg-amber-50 rounded-xl border border-amber-200 p-4 text-xs text-amber-800">
                <p className="font-semibold flex items-center gap-1 mb-1">
                  <span className="material-icons text-xs">help</span>
                  Need Help?
                </p>
                <p className="text-amber-700">
                  If your delivery is late or you have an issue, use the message box above or visit the{' '}
                  <Link href="/buyer/orders" className="underline">Orders page</Link> to file a dispute.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

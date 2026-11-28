'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

type FulfillmentMode = 'farmer_pickup' | 'farmer_delivery' | 'delivery_partner';

const FULFILLMENT_OPTIONS: Array<{
  id: FulfillmentMode;
  label: string;
  desc: string;
  icon: string;
}> = [
  {
    id: 'farmer_pickup',
    label: 'Farm Gate Pickup',
    desc: 'Collect produce directly with your GH verification code',
    icon: 'storefront',
  },
  {
    id: 'farmer_delivery',
    label: 'Farmer Direct Delivery',
    desc: 'Producer delivers straight to your address',
    icon: 'local_shipping',
  },
  {
    id: 'delivery_partner',
    label: 'GreenHarvest Courier Partner',
    desc: 'Dispatched via verified regional courier fleet',
    icon: 'route',
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { showError } = useToast();

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: 'Home / Business', region: 'Addis Ababa', city: 'Addis Ababa', subcity: '', landmark: '', line1: '', latitude: '', longitude: '', delivery_instructions: '' });
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [feeEstimate, setFeeEstimate] = useState<{
    total_shipping_fee: number;
    original_shipping_fee?: number;
    detected_zone?: any;
    consolidation?: any;
    packages: Record<string, any>;
  } | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('chapa');
  const [fulfillmentSelections, setFulfillmentSelections] = useState<Record<string, FulfillmentMode>>({});
  const [branchSelections, setBranchSelections] = useState<Record<string, number>>({});
  const [allowSplit, setAllowSplit] = useState(false);
  const [enableConsolidation, setEnableConsolidation] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cartRes, profileRes, addrRes] = await Promise.all([
          api.getCart(),
          api.getUserProfile().catch(() => null),
          api.getAddresses().catch(() => ({ addresses: [] })),
        ]);
        const items = cartRes.cart || [];
        setCartItems(items);
        const addrs = addrRes?.addresses || [];
        setSavedAddresses(addrs);
        const defAddr = addrs.find((a: any) => a.is_default) || addrs[0];
        if (defAddr) {
          setSelectedAddressId(defAddr.address_id);
          setDeliveryAddress([defAddr.landmark, defAddr.subcity, defAddr.city, defAddr.region, defAddr.line1].filter(Boolean).join(', '));
        } else if (profileRes?.user) {
          setDeliveryAddress(profileRes.user.address || '');
        }
        if (profileRes?.user) {
          setUserProfile(profileRes.user);
        }
      } catch (err) {
        console.error('Failed to load checkout data', err);
        showError('Failed to load your checkout details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showError]);

  const storeGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        farmerId: string;
        storeName: string;
        pickupAllowed: boolean;
        farmerDeliveryAllowed: boolean;
        items: any[];
      }
    > = {};

    for (const item of cartItems) {
      const storeId = String(item.farmer_id || 'default');
      if (!groups[storeId]) {
        const namePart =
          item.farmer_name ||
          (item.farm_location ? `${item.farm_location} Farm` : 'GreenHarvest Producer');
        groups[storeId] = {
          farmerId: storeId,
          storeName: item.farm_location ? `${namePart} · ${item.farm_location}` : namePart,
          pickupAllowed: true,
          farmerDeliveryAllowed: true,
          items: [],
        };
      }
      if (item.pickup_available === false) groups[storeId].pickupAllowed = false;
      if (item.farmer_delivery_available === false) groups[storeId].farmerDeliveryAllowed = false;
      groups[storeId].items.push(item);
    }
    return groups;
  }, [cartItems]);

  useEffect(() => {
    setFulfillmentSelections((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.values(storeGroups).forEach((g) => {
        if (!next[g.farmerId]) {
          next[g.farmerId] = g.farmerDeliveryAllowed
            ? 'farmer_delivery'
            : g.pickupAllowed
            ? 'farmer_pickup'
            : 'delivery_partner';
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [storeGroups]);

  const selectedAddrObj = savedAddresses.find((a) => a.address_id === selectedAddressId) || null;

  // Live Multi-Branch Distance + Weight Shipping Calculator (debounced)
  useEffect(() => {
    if (cartItems.length === 0) return;
    const timer = setTimeout(async () => {
      setEstimating(true);
      try {
        const res = await api.estimateCheckoutDelivery({
          delivery_address: deliveryAddress.trim(),
          destination_lat: selectedAddrObj?.latitude ?? null,
          destination_lng: selectedAddrObj?.longitude ?? null,
          fulfillment_selections: fulfillmentSelections,
          branch_selections: branchSelections,
          allow_split: allowSplit,
          enable_consolidation: enableConsolidation,
        });
        setFeeEstimate({
          total_shipping_fee: res.total_shipping_fee,
          original_shipping_fee: res.original_shipping_fee,
          detected_zone: res.detected_zone,
          consolidation: res.consolidation,
          packages: res.packages || {},
        });
      } catch {
        // Silent fallback until server createOrder recalculates
      } finally {
        setEstimating(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [cartItems.length, deliveryAddress, selectedAddrObj, fulfillmentSelections, branchSelections, allowSplit, enableConsolidation]);

  const subtotal = cartItems.reduce(
    (acc, item) => acc + Number(item.product_price || item.price) * Number(item.quantity || 1),
    0
  );

  const shippingFee = feeEstimate
    ? Number(feeEstimate.total_shipping_fee || 0)
    : Object.values(storeGroups).reduce((sum, g) => {
        const chosen = fulfillmentSelections[g.farmerId] || 'farmer_pickup';
        return sum + (chosen === 'farmer_pickup' ? 0 : chosen === 'farmer_delivery' ? 40 : 60);
      }, 0);

  const total = subtotal + shippingFee;

  const requiresDeliveryAddress = Object.values(storeGroups).some((g) => {
    const chosen = fulfillmentSelections[g.farmerId] || 'farmer_pickup';
    return chosen === 'farmer_delivery' || chosen === 'delivery_partner';
  });

  const handlePlaceOrder = async () => {
    if (requiresDeliveryAddress && !deliveryAddress.trim()) {
      showError('Please enter a delivery address for courier or farmer delivery.');
      return;
    }

    setIsPlacingOrder(true);
    try {
      const orderRes: any = await api.createOrder({
        address_id: selectedAddressId || undefined,
        delivery_address: deliveryAddress.trim() || undefined,
        destination_lat: selectedAddrObj?.latitude ?? undefined,
        destination_lng: selectedAddrObj?.longitude ?? undefined,
        fulfillment_selections: fulfillmentSelections,
        branch_selections: branchSelections,
        allow_split: allowSplit,
        enable_consolidation: enableConsolidation,
        notes: orderNotes.trim() || undefined,
      });
      const orderId = orderRes?.order?.id || orderRes?.id;
      if (!orderId) throw new Error('Order ID missing from response');

      if (paymentMethod === 'chapa') {
        const returnUrl = `${window.location.origin}/buyer/checkout/payment/verify`;
        const chapaRes = await api.initializeChapaPayment(orderId.toString(), returnUrl);
        if (chapaRes.checkout_url) {
          window.location.href = chapaRes.checkout_url;
        } else {
          throw new Error('Failed to get checkout URL from Chapa');
        }
      } else {
        router.push(`/buyer/orders/${orderId}/track`);
      }
    } catch (err: any) {
      console.error('Failed to place order', err);
      showError(err?.response?.data?.message || 'Failed to place order. Please try again.');
      setIsPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="w-10 h-10 border-4 border-[#286c00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] bg-white rounded-2xl border border-gray-200 p-8">
        <span className="material-symbols-outlined text-gray-300 text-6xl mb-4">shopping_cart</span>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven&apos;t added anything to your cart yet.</p>
        <Link
          href="/buyer/dashboard"
          className="bg-[#286c00] hover:bg-[#1f5400] text-white font-bold py-3 px-8 rounded-full transition-all"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#f6f7f5] min-h-screen pt-6 pb-12 font-sans">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Checkout &amp; Delivery</h1>
            <p className="text-xs text-gray-500 mt-1">
              Shipping fees dynamically adjust based on corridor distance and harvest weight (kg).
            </p>
          </div>
          <Link href="/buyer/dashboard" className="text-xs font-bold text-[#286c00] hover:underline">
            Back to Marketplace
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Left Column */}
          <div className="w-full lg:flex-1 space-y-4">
            {/* Delivery Destination */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#286c00] text-lg">location_on</span>
                  Delivery Destination &amp; Contact
                </h2>
                <Link href="/buyer/settings" className="text-xs font-semibold text-[#007a6c] hover:underline">
                  Profile Settings
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Recipient</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {userProfile?.name || 'Verified Buyer'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Phone</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {userProfile?.phone || 'Not provided'}
                  </span>
                </div>
              </div>

              {/* Saved Ethiopian Addresses + Map Coordinates */}
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Saved Ethiopian Addresses</span>
                  <button
                    type="button"
                    onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                    className="text-xs font-bold text-[#286c00] hover:underline cursor-pointer"
                  >
                    {showNewAddressForm ? 'Close' : '+ Add New Address'}
                  </button>
                </div>

                {savedAddresses.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.address_id}
                        type="button"
                        onClick={() => {
                          setSelectedAddressId(addr.address_id);
                          setDeliveryAddress([addr.landmark, addr.subcity, addr.city, addr.region, addr.line1].filter(Boolean).join(', '));
                        }}
                        className={`text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                          selectedAddressId === addr.address_id
                            ? 'border-[#286c00] bg-emerald-50/40 ring-1 ring-[#286c00]'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-bold text-gray-900">{addr.label} · {addr.city}</p>
                        <p className="text-[11px] text-gray-500 truncate">{addr.landmark || addr.line1}</p>
                      </button>
                    ))}
                  </div>
                )}

                {showNewAddressForm && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg grid grid-cols-2 gap-2 text-xs">
                    <input placeholder="Label (Home/Shop)" value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} className="px-2.5 py-1.5 border border-gray-300 rounded bg-white" />
                    <input placeholder="Region (Addis Ababa/Oromia)" value={newAddr.region} onChange={(e) => setNewAddr({ ...newAddr, region: e.target.value })} className="px-2.5 py-1.5 border border-gray-300 rounded bg-white" />
                    <input placeholder="City / Town *" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} className="px-2.5 py-1.5 border border-gray-300 rounded bg-white" />
                    <input placeholder="Subcity / Woreda" value={newAddr.subcity} onChange={(e) => setNewAddr({ ...newAddr, subcity: e.target.value })} className="px-2.5 py-1.5 border border-gray-300 rounded bg-white" />
                    <input placeholder="Landmark (e.g., Near Edna Mall) *" value={newAddr.landmark} onChange={(e) => setNewAddr({ ...newAddr, landmark: e.target.value })} className="col-span-2 px-2.5 py-1.5 border border-gray-300 rounded bg-white" />
                    <input type="number" step="0.0001" placeholder="GPS Latitude (opt)" value={newAddr.latitude} onChange={(e) => setNewAddr({ ...newAddr, latitude: e.target.value })} className="px-2.5 py-1.5 border border-gray-300 rounded bg-white" />
                    <input type="number" step="0.0001" placeholder="GPS Longitude (opt)" value={newAddr.longitude} onChange={(e) => setNewAddr({ ...newAddr, longitude: e.target.value })} className="px-2.5 py-1.5 border border-gray-300 rounded bg-white" />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await api.createAddress({
                            ...newAddr,
                            line1: newAddr.landmark || newAddr.city,
                            latitude: newAddr.latitude ? Number(newAddr.latitude) : undefined,
                            longitude: newAddr.longitude ? Number(newAddr.longitude) : undefined,
                            is_default: true,
                          });
                          setSavedAddresses((prev) => [res.address, ...prev]);
                          setSelectedAddressId(res.address.address_id);
                          setDeliveryAddress([res.address.landmark, res.address.subcity, res.address.city, res.address.region].filter(Boolean).join(', '));
                          setShowNewAddressForm(false);
                        } catch (err: any) {
                          showError(err?.response?.data?.message || 'Failed to save address');
                        }
                      }}
                      className="col-span-2 py-1.5 bg-[#286c00] text-white font-bold rounded cursor-pointer"
                    >
                      Save Address &amp; Validate Zone
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Delivery City, Landmark &amp; Street Address {requiresDeliveryAddress ? '*' : '(Optional for Pickup)'}
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => {
                    setSelectedAddressId(null);
                    setDeliveryAddress(e.target.value);
                  }}
                  placeholder="e.g., Addis Ababa, Bole Sub-city Near Medhanialem (used to calculate corridor distance & zone)"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#286c00]"
                />
                {feeEstimate?.detected_zone && (
                  <p className={`text-[11px] mt-1.5 font-semibold ${feeEstimate.detected_zone.serviceable === false ? 'text-red-600' : 'text-emerald-700'}`}>
                    Detected Zone: {feeEstimate.detected_zone.name} ({feeEstimate.detected_zone.zone_type})
                    {feeEstimate.detected_zone.serviceable === false ? ` — ${feeEstimate.detected_zone.reason || 'Unavailable/Restricted'}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[#286c00] text-lg">payment</span>
                Payment Method
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`border rounded-lg p-3.5 cursor-pointer flex items-center gap-3 transition-all ${
                    paymentMethod === 'chapa'
                      ? 'border-[#286c00] bg-emerald-50/40 ring-1 ring-[#286c00]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="chapa"
                    checked={paymentMethod === 'chapa'}
                    onChange={() => setPaymentMethod('chapa')}
                    className="accent-[#286c00] w-4 h-4"
                  />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Chapa (Telebirr / CBE / Card)</p>
                    <p className="text-xs text-gray-500">Escrow-protected instant checkout</p>
                  </div>
                </label>

                <label
                  className={`border rounded-lg p-3.5 cursor-pointer flex items-center gap-3 transition-all ${
                    paymentMethod === 'cash_on_delivery'
                      ? 'border-[#286c00] bg-emerald-50/40 ring-1 ring-[#286c00]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="cash_on_delivery"
                    checked={paymentMethod === 'cash_on_delivery'}
                    onChange={() => setPaymentMethod('cash_on_delivery')}
                    className="accent-[#286c00] w-4 h-4"
                  />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Pay on Pickup / Delivery</p>
                    <p className="text-xs text-gray-500">Handover PIN protected delivery</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Per-Farmer Packages */}
            <div className="space-y-4">
              {Object.values(storeGroups).map((group) => {
                const chosen = fulfillmentSelections[group.farmerId] || 'farmer_pickup';
                const pkgEstimate = feeEstimate?.packages?.[group.farmerId];
                const chosenModeMeta = pkgEstimate?.modes?.[chosen];

                return (
                  <div
                    key={group.farmerId}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                  >
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#286c00] text-base">
                          agriculture
                        </span>
                        <span className="text-sm font-bold text-gray-900">{group.storeName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-600 tabular-nums">
                        {pkgEstimate?.candidate_branches?.length > 1 && (
                          <select
                            value={branchSelections[group.farmerId] || pkgEstimate?.selected_branch?.id || ''}
                            onChange={(e) =>
                              setBranchSelections((prev) => ({ ...prev, [group.farmerId]: Number(e.target.value) }))
                            }
                            className="px-2 py-1 border border-gray-300 rounded bg-white text-[11px] font-bold text-gray-800"
                          >
                            {pkgEstimate.candidate_branches.map((cb: any) => (
                              <option key={cb.branch_id} value={cb.branch_id} disabled={!cb.serviceable}>
                                {cb.name} ({cb.region}) · ~{cb.distance_km}km {cb.can_cover_all_items ? '' : '[Partial]'}
                              </option>
                            ))}
                          </select>
                        )}
                        <span>
                          {pkgEstimate?.selected_branch?.name ? `${pkgEstimate.selected_branch.name} · ` : ''}
                          {pkgEstimate
                            ? `${pkgEstimate.total_weight_kg} kg · ~${pkgEstimate.distance_km} km`
                            : `${group.items.length} item(s)`}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="divide-y divide-gray-100">
                        {group.items.map((item: any, index: number) => (
                          <div key={item.id || index} className="py-3 first:pt-0 last:pb-0 flex gap-3.5 items-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                              {item.image_url || item.product?.image_url ? (
                                <img
                                  src={item.image_url || item.product?.image_url}
                                  alt={item.product_name || item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="material-symbols-outlined text-gray-300 text-2xl">
                                  image
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-bold text-gray-900 truncate">
                                {item.product_name || item.name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Qty: {item.quantity} × ETB {Number(item.product_price || item.price).toFixed(2)}
                              </p>
                            </div>
                            <p className="text-sm font-black text-gray-900 shrink-0 tabular-nums">
                              ETB {(Number(item.product_price || item.price) * Number(item.quantity)).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Fulfillment Selector with Real Dynamic Breakdown */}
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2.5">
                          Select Delivery Method
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {FULFILLMENT_OPTIONS.map((opt) => {
                            const disabled =
                              (opt.id === 'farmer_pickup' && !group.pickupAllowed) ||
                              (opt.id === 'farmer_delivery' && !group.farmerDeliveryAllowed);
                            const isSelected = chosen === opt.id;
                            const modeEst = pkgEstimate?.modes?.[opt.id];
                            const fee = modeEst ? Number(modeEst.shipping_fee) : null;

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  setFulfillmentSelections((prev) => ({
                                    ...prev,
                                    [group.farmerId]: opt.id,
                                  }))
                                }
                                className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-between gap-1.5 ${
                                  disabled
                                    ? 'opacity-45 bg-gray-50 border-gray-200 cursor-not-allowed'
                                    : isSelected
                                    ? 'border-[#286c00] bg-emerald-50/50 ring-1 ring-[#286c00] cursor-pointer'
                                    : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900">
                                    <span className="material-symbols-outlined text-[16px] text-[#286c00]">
                                      {opt.icon}
                                    </span>
                                    {opt.label}
                                  </span>
                                  <span className="text-xs font-black text-[#286c00] tabular-nums shrink-0">
                                    {fee === null ? '—' : fee === 0 ? 'Free' : `ETB ${fee}`}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-snug">
                                  {disabled ? 'Not offered for all items' : modeEst?.estimated_eta || opt.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        {/* Split Fulfillment & Itemized Distance/Weight Fee Transparency */}
                        {pkgEstimate?.requires_split_approval && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold">Multi-Branch Split Fulfillment Notice</span>
                              <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
                                <input type="checkbox" checked={allowSplit} onChange={(e) => setAllowSplit(e.target.checked)} className="accent-[#286c00]" />
                                Approve Split Across {pkgEstimate.split_packages?.length} Branches
                              </label>
                            </div>
                            <p className="text-[11px]">
                              No single branch holds the entire order. Splitting fulfills from multiple branches with transparent separate package fees.
                            </p>
                          </div>
                        )}

                        {chosenModeMeta && chosenModeMeta.shipping_fee > 0 && (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-600 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                <strong>{chosenModeMeta.route_label}</strong> ({chosenModeMeta.distance_km} km ·{' '}
                                {chosenModeMeta.total_weight_kg} kg)
                              </span>
                              <span className="font-mono text-gray-700">
                                Base {chosenModeMeta.breakdown.base_fee} + Dist {chosenModeMeta.breakdown.distance_fee} + Wt {chosenModeMeta.breakdown.weight_fee}
                                {Number(chosenModeMeta.breakdown.handling_fee || 0) > 0 ? ` + Handling ${chosenModeMeta.breakdown.handling_fee}` : ''}
                                {Number(chosenModeMeta.breakdown.remote_surcharge || 0) > 0 ? ` + Zone ${chosenModeMeta.breakdown.remote_surcharge}` : ''} ETB
                              </span>
                            </div>
                            {chosenModeMeta.route_disclaimer && (
                              <p className="text-[10px] text-gray-400">{chosenModeMeta.route_disclaimer}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Delivery Instructions / Landmark Notes (Optional)
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Call upon arrival at the main gate..."
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#286c00]"
              />
            </div>
          </div>

          {/* Right Summary */}
          <div className="w-full lg:w-[340px] shrink-0 lg:sticky lg:top-24">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5">
                <h2 className="text-base font-bold text-gray-900 mb-4">Order Summary</h2>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Produce subtotal</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      ETB {subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Estimated Shipping {estimating ? '(updating...)' : ''}
                    </span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {shippingFee === 0 ? 'Free' : `ETB ${shippingFee.toFixed(2)}`}
                    </span>
                  </div>
                  {feeEstimate?.consolidation?.consolidation_eligible && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <label className="flex items-center justify-between font-bold cursor-pointer">
                        <span>Food-Safe Consolidation (-ETB {feeEstimate.consolidation.estimated_savings})</span>
                        <input
                          type="checkbox"
                          checked={enableConsolidation}
                          onChange={(e) => setEnableConsolidation(e.target.checked)}
                          className="accent-[#286c00]"
                        />
                      </label>
                      <p className="text-[10px] text-emerald-700">{feeEstimate.consolidation.food_safety_rule}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-5 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-gray-900">Grand Total</span>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-500 mr-1">ETB</span>
                    <span className="text-2xl font-black text-[#286c00] leading-none tabular-nums">
                      {total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder || estimating}
                  className="w-full bg-[#286c00] hover:bg-[#1f5400] text-white font-bold py-3.5 rounded-xl transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPlacingOrder ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <span>Place Order</span>
                  )}
                </button>

                <p className="mt-3 text-[11px] text-gray-500 leading-relaxed text-center">
                  Protected by 6-digit Handover PIN &amp; Escrow Verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

export default function DeliveryPartnerDashboardPage() {
  const { showSuccess, showError } = useToast();

  const [user, setUser] = useState<any>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [tab, setTab] = useState<'pool' | 'assigned' | 'verification'>('pool');
  const [pool, setPool] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySubId, setBusySubId] = useState<number | null>(null);
  const [etaDrafts, setEtaDrafts] = useState<Record<number, string>>({});

  // Verification Form State
  const [verifForm, setVerifForm] = useState({
    vehicle_type: 'Cargo Pickup Truck',
    vehicle_plate: '',
    vehicle_capacity_kg: '1000',
    license_number: '',
    national_id_number: '',
    operating_region: 'Addis Ababa & Oromia Corridor',
  });
  const [savingVerif, setSavingVerif] = useState(false);

  // Checkpoint Modal State
  const [checkpointModal, setCheckpointModal] = useState<{
    delivery: any;
    location_name: string;
    estimated_time: string;
    notes: string;
    submitting: boolean;
  } | null>(null);

  // Complete Delivery Modal (Mandatory Buyer Handover PIN + POD image)
  const [podModal, setPodModal] = useState<{
    delivery: any;
    confirmation_code: string;
    notes: string;
    proofUrl: string;
    uploading: boolean;
    submitting: boolean;
  } | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, partnerRes, poolRes, assignedRes] = await Promise.all([
        api.getUserProfile().catch(() => null),
        api.getMyPartnerProfile().catch(() => ({ profile: null })),
        api.getDeliveryPool().catch(() => ({ pool: [] })),
        api.getAssignedDeliveries().catch(() => ({ deliveries: [] })),
      ]);

      if (profileRes?.user) setUser(profileRes.user);
      if (partnerRes?.profile) {
        setPartnerProfile(partnerRes.profile);
        setVerifForm({
          vehicle_type: partnerRes.profile.vehicle_type || 'Cargo Pickup Truck',
          vehicle_plate: partnerRes.profile.vehicle_plate || '',
          vehicle_capacity_kg: String(partnerRes.profile.vehicle_capacity_kg || 1000),
          license_number: partnerRes.profile.license_number || '',
          national_id_number: partnerRes.profile.national_id_number || '',
          operating_region: partnerRes.profile.operating_region || 'Addis Ababa & Oromia Corridor',
        });
      }
      setPool(poolRes?.pool || []);
      setAssigned(assignedRes?.deliveries || []);
    } catch (err: any) {
      console.error('Failed to load delivery partner workspace:', err);
      showError(err?.response?.data?.message || 'Failed to load delivery jobs');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVerif(true);
    try {
      const res = await api.submitMyPartnerProfile({
        vehicle_type: verifForm.vehicle_type,
        vehicle_plate: verifForm.vehicle_plate,
        vehicle_capacity_kg: Number(verifForm.vehicle_capacity_kg) || 500,
        license_number: verifForm.license_number,
        national_id_number: verifForm.national_id_number,
        operating_region: verifForm.operating_region,
      });
      setPartnerProfile(res.profile);
      showSuccess(res.message || 'Verification details submitted for Admin review!');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to submit verification profile');
    } finally {
      setSavingVerif(false);
    }
  };

  const handleClaimJob = async (suborderId: number) => {
    setBusySubId(suborderId);
    try {
      const eta = etaDrafts[suborderId]?.trim() || '4 hours';
      const res = await api.claimPoolDelivery(suborderId, { estimated_time: eta });
      showSuccess(res.message || 'Delivery claimed! Verify pickup code at the farm gate.');
      await loadWorkspace();
      setTab('assigned');
    } catch (err: any) {
      showError(err?.response?.data?.message || err?.message || 'Failed to claim delivery');
    } finally {
      setBusySubId(null);
    }
  };

  const handleTransitStep = async (
    suborderId: number,
    nextStatus: 'picked_up' | 'in_transit' | 'cancelled'
  ) => {
    if (
      nextStatus === 'cancelled' &&
      !confirm(
        'Releasing a claimed job returns it to the pool and deducts -0.35 from your courier trust score. Continue?'
      )
    ) {
      return;
    }

    setBusySubId(suborderId);
    try {
      const res = await api.updatePartnerTransitStatus(suborderId, { status: nextStatus });
      showSuccess(
        res.message ||
          (nextStatus === 'picked_up'
            ? 'Marked as picked up from farm.'
            : nextStatus === 'in_transit'
            ? 'Marked as in transit to buyer.'
            : 'Job released back to pool.')
      );
      await loadWorkspace();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update transit status');
    } finally {
      setBusySubId(null);
    }
  };

  const handleSaveCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointModal) return;
    setCheckpointModal((prev) => (prev ? { ...prev, submitting: true } : null));
    try {
      await api.postDeliveryCheckpoint(checkpointModal.delivery.suborder_id, {
        location_name: checkpointModal.location_name,
        estimated_time: checkpointModal.estimated_time || undefined,
        notes: checkpointModal.notes || undefined,
      });
      showSuccess('Live route checkpoint logged for buyer tracking!');
      setCheckpointModal(null);
      await loadWorkspace();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to log checkpoint');
      setCheckpointModal((prev) => (prev ? { ...prev, submitting: false } : null));
    }
  };

  const handlePodImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !podModal) return;
    setPodModal((prev) => (prev ? { ...prev, uploading: true } : null));
    try {
      const uploadRes = await api.uploadProductImage(file);
      setPodModal((prev) =>
        prev ? { ...prev, proofUrl: uploadRes.url, uploading: false } : null
      );
      showSuccess('Proof photo uploaded');
    } catch {
      showError('Failed to upload image');
      setPodModal((prev) => (prev ? { ...prev, uploading: false } : null));
    }
  };

  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podModal) return;
    const subId = podModal.delivery.suborder_id;
    if (!subId) {
      showError('Suborder reference missing for this delivery.');
      return;
    }

    setPodModal((prev) => (prev ? { ...prev, submitting: true } : null));
    try {
      await api.updatePartnerTransitStatus(subId, {
        status: 'delivered',
        confirmation_code: podModal.confirmation_code.trim(),
        proof_of_delivery_image_url: podModal.proofUrl.trim() || undefined,
        notes: podModal.notes.trim() || undefined,
      });
      showSuccess('Delivery verified with Buyer PIN and escrow released!');
      setPodModal(null);
      await loadWorkspace();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to complete delivery');
      setPodModal((prev) => (prev ? { ...prev, submitting: false } : null));
    }
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.href = '/login';
  };

  const verificationStatus = partnerProfile?.verification_status || 'unverified';
  const isVerifiedCourier = verificationStatus === 'verified';
  const activeCount = assigned.filter((d) => d.status !== 'delivered' && d.status !== 'cancelled').length;
  const completedCount = assigned.filter((d) => d.status === 'delivered').length;
  const earnedFees = assigned
    .filter((d) => d.status === 'delivered')
    .reduce((sum, d) => sum + Number(d.shipping_fee || 0), 0);

  return (
    <div className="flex-1 flex flex-col bg-white text-gray-900">
      {/* Top Lined Header */}
      <header className="h-16 border-b border-gray-300 bg-white px-6 lg:px-10 flex items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1f5400] text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">local_shipping</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Courier Logistics Portal
              </h1>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  verificationStatus === 'verified'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : verificationStatus === 'pending_review'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : verificationStatus === 'suspended'
                    ? 'bg-red-50 text-red-800 border-red-300'
                    : 'bg-gray-50 text-gray-600 border-gray-300'
                }`}
              >
                {verificationStatus.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              {user ? `${user.name} · Trust ★ ${Number(partnerProfile?.trust_score || 5).toFixed(2)}` : 'Delivery Partner'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadWorkspace}
            className="px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-1.5 border border-gray-300 bg-white hover:bg-rose-50 hover:text-rose-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1360px] w-full mx-auto p-6 lg:p-8 space-y-6">
        {/* Verification Gate Warning Banner */}
        {!isVerifiedCourier && (
          <div className="p-4 border border-amber-300 bg-amber-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-amber-950">
              <p className="font-bold">
                {verificationStatus === 'pending_review'
                  ? 'Courier Verification Under Review'
                  : verificationStatus === 'suspended'
                  ? 'Courier Account Suspended'
                  : 'Complete Identity & Vehicle Verification to Claim Deliveries'}
              </p>
              <p className="text-amber-800 mt-0.5">
                {verificationStatus === 'pending_review'
                  ? 'An administrator must approve your vehicle plate, license, and ID before you can claim farm harvests.'
                  : 'Submit your National ID, driving license, and vehicle plate for courier vetting.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab('verification')}
              className="px-4 py-2 bg-[#1f5400] text-white text-xs font-bold cursor-pointer"
            >
              Open Verification Profile
            </button>
          </div>
        )}

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border border-gray-300 divide-y sm:divide-y-0 sm:divide-x divide-gray-300 bg-white">
          <div className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Open Pool Jobs
            </span>
            <span className="text-2xl font-black text-[#1f5400] mt-1 block tabular-nums">
              {pool.length}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Active Assigned
            </span>
            <span className="text-2xl font-black text-[#007a6c] mt-1 block tabular-nums">
              {activeCount}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Trust &amp; Completed
            </span>
            <span className="text-2xl font-black text-gray-900 mt-1 block tabular-nums">
              ★ {Number(partnerProfile?.trust_score || 5).toFixed(1)} · {completedCount}
            </span>
          </div>
          <div className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Shipping Fees Earned
            </span>
            <span className="text-2xl font-black text-gray-900 mt-1 block tabular-nums">
              ETB {earnedFees.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center border border-gray-300 divide-x divide-gray-300 w-fit bg-white">
          <button
            type="button"
            onClick={() => setTab('pool')}
            className={`px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
              tab === 'pool'
                ? 'bg-[#1f5400] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Available Delivery Pool ({pool.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('assigned')}
            className={`px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
              tab === 'assigned'
                ? 'bg-[#1f5400] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            My Assigned Deliveries ({assigned.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('verification')}
            className={`px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
              tab === 'verification'
                ? 'bg-[#1f5400] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Vehicle &amp; ID Verification
          </button>
        </div>

        {loading ? (
          <div className="p-16 border border-gray-300 bg-white text-center text-gray-500">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-[#1f5400] rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider">Loading dispatches...</p>
          </div>
        ) : tab === 'verification' ? (
          <form
            onSubmit={handleSaveVerification}
            className="bg-white border border-gray-300 p-6 max-w-2xl space-y-4 text-xs"
          >
            <div className="pb-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Courier Onboarding &amp; Compliance</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Admin reviews these credentials to prevent cargo theft and verify vehicle capacity.
                </p>
              </div>
              <span className="font-mono font-bold text-[#007a6c] uppercase">
                {verificationStatus.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Vehicle Type *</label>
                <input
                  type="text"
                  required
                  value={verifForm.vehicle_type}
                  onChange={(e) => setVerifForm({ ...verifForm, vehicle_type: e.target.value })}
                  placeholder="e.g., Isuzu FSR / Insulated Van"
                  className="w-full px-3 py-2 border border-gray-300 text-xs focus:outline-none focus:border-[#1f5400]"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Vehicle License Plate *</label>
                <input
                  type="text"
                  required
                  value={verifForm.vehicle_plate}
                  onChange={(e) => setVerifForm({ ...verifForm, vehicle_plate: e.target.value })}
                  placeholder="e.g., ET-3-48291"
                  className="w-full px-3 py-2 border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#1f5400]"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Driver&apos;s License Number *</label>
                <input
                  type="text"
                  required
                  value={verifForm.license_number}
                  onChange={(e) => setVerifForm({ ...verifForm, license_number: e.target.value })}
                  placeholder="e.g., DL-AA-0049182"
                  className="w-full px-3 py-2 border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#1f5400]"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">National ID / Fayda # *</label>
                <input
                  type="text"
                  required
                  value={verifForm.national_id_number}
                  onChange={(e) =>
                    setVerifForm({ ...verifForm, national_id_number: e.target.value })
                  }
                  placeholder="e.g., FAN-1940284910"
                  className="w-full px-3 py-2 border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#1f5400]"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Payload Capacity (kg)</label>
                <input
                  type="number"
                  min="50"
                  value={verifForm.vehicle_capacity_kg}
                  onChange={(e) =>
                    setVerifForm({ ...verifForm, vehicle_capacity_kg: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 text-xs focus:outline-none focus:border-[#1f5400]"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Operating Region *</label>
                <input
                  type="text"
                  required
                  value={verifForm.operating_region}
                  onChange={(e) => setVerifForm({ ...verifForm, operating_region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 text-xs focus:outline-none focus:border-[#1f5400]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                Completed: {partnerProfile?.completed_deliveries || 0} · Dropped:{' '}
                {partnerProfile?.cancelled_deliveries || 0}
              </span>
              <button
                type="submit"
                disabled={savingVerif}
                className="px-5 py-2.5 bg-[#1f5400] hover:bg-[#173f00] text-white font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                {savingVerif ? 'Submitting...' : 'Submit Verification Details'}
              </button>
            </div>
          </form>
        ) : tab === 'pool' ? (
          pool.length === 0 ? (
            <div className="p-16 border border-gray-300 bg-white text-center">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">
                inventory_2
              </span>
              <p className="text-sm font-bold text-gray-900">No open courier deliveries right now</p>
              <p className="text-xs text-gray-500 mt-1">
                Orders placed with GreenHarvest Courier Partner fulfillment appear here for claiming.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pool.map((job) => (
                <div
                  key={job.suborder_id}
                  className="bg-white border border-gray-300 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-200">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#007a6c]">
                          {job.suborder_number}
                        </span>
                        <p className="text-[11px] text-gray-500">
                          {job.distance_km ? `~${job.distance_km} km` : 'Regional route'}
                          {job.total_weight_kg ? ` · ${job.total_weight_kg} kg cargo` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-black text-[#1f5400] tabular-nums">
                        Fee: ETB {Number(job.shipping_fee || 80).toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-gray-50 border border-gray-200">
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Pickup Origin (Farmer)
                        </span>
                        <p className="font-bold text-gray-900 mt-0.5">{job.farmer_name}</p>
                        <p className="text-gray-600 mt-0.5">{job.farmer_address || 'Farm Gate'}</p>
                        {job.farmer_phone && (
                          <p className="text-[#007a6c] font-mono mt-1">{job.farmer_phone}</p>
                        )}
                      </div>

                      <div className="p-3 bg-gray-50 border border-gray-200">
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Dropoff Destination (Buyer)
                        </span>
                        <p className="font-bold text-gray-900 mt-0.5">{job.buyer_name}</p>
                        <p className="text-gray-600 mt-0.5">{job.buyer_address || 'Customer Address'}</p>
                        {job.buyer_phone && (
                          <p className="text-[#007a6c] font-mono mt-1">{job.buyer_phone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200 flex items-center gap-2.5">
                    <input
                      type="text"
                      value={etaDrafts[job.suborder_id] ?? (job.estimated_time || '4 hours')}
                      onChange={(e) =>
                        setEtaDrafts((prev) => ({ ...prev, [job.suborder_id]: e.target.value }))
                      }
                      placeholder="ETA (e.g., 3 hours)"
                      className="flex-1 px-3 py-2 border border-gray-300 text-xs font-medium focus:outline-none focus:border-[#007a6c]"
                    />
                    <button
                      type="button"
                      disabled={busySubId === job.suborder_id || !isVerifiedCourier}
                      onClick={() => handleClaimJob(job.suborder_id)}
                      className="px-4 py-2 bg-[#1f5400] hover:bg-[#173f00] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                      title={!isVerifiedCourier ? 'Verification required to claim deliveries' : ''}
                    >
                      {busySubId === job.suborder_id
                        ? 'Claiming...'
                        : isVerifiedCourier
                        ? 'Claim Delivery'
                        : 'Verify First'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : assigned.length === 0 ? (
          <div className="p-16 border border-gray-300 bg-white text-center">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">
              local_shipping
            </span>
            <p className="text-sm font-bold text-gray-900">No claimed deliveries yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Claim an available delivery job from the pool to start fulfilling orders.
            </p>
          </div>
        ) : (
          <div className="border border-gray-300 divide-y divide-gray-300 bg-white">
            {assigned.map((del) => {
              const st = String(del.status || 'assigned').toLowerCase();
              const isBusy = busySubId === del.suborder_id;
              return (
                <div
                  key={del.delivery_id || del.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-gray-900">
                        {del.suborder_number || `Order #${del.order_id}`}
                      </span>
                      <span className="text-xs font-bold uppercase text-[#007a6c]">
                        • {st.replace(/_/g, ' ')}
                      </span>
                      {del.estimated_time && (
                        <span className="text-xs text-gray-500">• ETA: {del.estimated_time}</span>
                      )}
                      {del.current_checkpoint && (
                        <span className="text-xs text-gray-700 font-medium">
                          • @ {del.current_checkpoint}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <p>
                        <strong className="text-gray-900">Pickup:</strong>{' '}
                        {del.farmer_name || 'Producer'} — {del.pickup_location}
                        {del.farmer_phone ? ` (${del.farmer_phone})` : ''}
                      </p>
                      <p>
                        <strong className="text-gray-900">Dropoff:</strong> {del.buyer_name} —{' '}
                        {del.delivery_location}
                        {del.buyer_phone ? ` (${del.buyer_phone})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Step Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {st === 'assigned' && del.suborder_id && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleTransitStep(del.suborder_id, 'picked_up')}
                          className="px-4 py-2 bg-[#007a6c] hover:bg-[#006156] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          {isBusy ? 'Updating...' : 'Mark Picked Up'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleTransitStep(del.suborder_id, 'cancelled')}
                          className="px-3 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          Release Job
                        </button>
                      </>
                    )}

                    {st === 'picked_up' && del.suborder_id && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTransitStep(del.suborder_id, 'in_transit')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                      >
                        {isBusy ? 'Updating...' : 'Start Transit'}
                      </button>
                    )}

                    {['picked_up', 'in_transit'].includes(st) && del.suborder_id && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            setCheckpointModal({
                              delivery: del,
                              location_name: '',
                              estimated_time: del.estimated_time || '',
                              notes: '',
                              submitting: false,
                            })
                          }
                          className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold cursor-pointer"
                        >
                          Log Checkpoint
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            setPodModal({
                              delivery: del,
                              confirmation_code: '',
                              notes: '',
                              proofUrl: '',
                              uploading: false,
                              submitting: false,
                            })
                          }
                          className="px-4 py-2 bg-[#1f5400] hover:bg-[#173f00] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          Verify Buyer PIN &amp; Complete
                        </button>
                      </>
                    )}

                    {st === 'delivered' && (
                      <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Verified &amp; Delivered
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 text-xs text-gray-500 flex items-center justify-between">
          <span>GreenHarvest Accountable Ethiopian Direct Agro-Logistics</span>
          <Link href="/products" className="text-[#007a6c] font-semibold hover:underline">
            View Public Marketplace
          </Link>
        </div>
      </main>

      {/* Post Live Route Checkpoint Modal */}
      <AnimatePresence>
        {checkpointModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onSubmit={handleSaveCheckpoint}
              className="w-full max-w-md bg-white border border-gray-300 shadow-2xl divide-y divide-gray-200"
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  Log Route Checkpoint ({checkpointModal.delivery.suborder_number})
                </h2>
                <button
                  type="button"
                  onClick={() => setCheckpointModal(null)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="p-5 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Current Town / Hub *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={checkpointModal.location_name}
                    onChange={(e) =>
                      setCheckpointModal((prev) =>
                        prev ? { ...prev, location_name: e.target.value } : null
                      )
                    }
                    placeholder="e.g., Mojo Expressway Toll Gate Km 28"
                    className="w-full px-3 py-2 border border-gray-300 text-xs focus:outline-none focus:border-[#007a6c]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Updated ETA</label>
                  <input
                    type="text"
                    value={checkpointModal.estimated_time}
                    onChange={(e) =>
                      setCheckpointModal((prev) =>
                        prev ? { ...prev, estimated_time: e.target.value } : null
                      )
                    }
                    placeholder="e.g., Arriving in 45 mins"
                    className="w-full px-3 py-2 border border-gray-300 text-xs focus:outline-none focus:border-[#007a6c]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Status Note (Optional)</label>
                  <input
                    type="text"
                    value={checkpointModal.notes}
                    onChange={(e) =>
                      setCheckpointModal((prev) =>
                        prev ? { ...prev, notes: e.target.value } : null
                      )
                    }
                    placeholder="Cleared checkpoint, produce in cold crate..."
                    className="w-full px-3 py-2 border border-gray-300 text-xs focus:outline-none focus:border-[#007a6c]"
                  />
                </div>
              </div>
              <div className="px-5 py-3.5 flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  disabled={checkpointModal.submitting}
                  onClick={() => setCheckpointModal(null)}
                  className="px-4 py-2 border border-gray-300 bg-white text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkpointModal.submitting}
                  className="px-4 py-2 bg-[#007a6c] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {checkpointModal.submitting ? 'Logging...' : 'Publish Checkpoint'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proof of Delivery + Mandatory Buyer Handover PIN Modal */}
      <AnimatePresence>
        {podModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onSubmit={handleCompleteDelivery}
              className="w-full max-w-md bg-white border border-gray-300 shadow-2xl divide-y divide-gray-200"
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  Complete Delivery ({podModal.delivery.suborder_number})
                </h2>
                <button
                  type="button"
                  onClick={() => setPodModal(null)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <p className="font-bold">Mandatory Buyer Handover PIN Required</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Ask the buyer to read their <strong>DEL-XXXXXX</strong> code from their tracking page to verify real drop-off.
                  </p>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Buyer Handover PIN *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={podModal.confirmation_code}
                    onChange={(e) =>
                      setPodModal((prev) =>
                        prev ? { ...prev, confirmation_code: e.target.value } : null
                      )
                    }
                    placeholder="DEL-123456"
                    className="w-full px-3 py-2.5 border border-gray-300 font-mono text-sm uppercase focus:outline-none focus:border-[#1f5400]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Proof of Delivery Photo (Recommended)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePodImageChange}
                    className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:border file:border-gray-300 file:bg-gray-50 file:text-xs file:font-bold file:text-gray-800"
                  />
                  {podModal.uploading && (
                    <p className="text-[11px] text-[#007a6c] mt-1 font-semibold">Uploading photo...</p>
                  )}
                  {podModal.proofUrl && (
                    <img
                      src={podModal.proofUrl}
                      alt="Proof preview"
                      className="mt-2 w-28 h-20 object-cover border border-gray-300"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Handover Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={podModal.notes}
                    onChange={(e) =>
                      setPodModal((prev) => (prev ? { ...prev, notes: e.target.value } : null))
                    }
                    placeholder="Handed over directly to recipient at gate..."
                    className="w-full px-3 py-2 border border-gray-300 text-xs focus:outline-none focus:border-[#1f5400]"
                  />
                </div>
              </div>

              <div className="px-5 py-3.5 flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  disabled={podModal.submitting}
                  onClick={() => setPodModal(null)}
                  className="px-4 py-2 border border-gray-300 bg-white text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={podModal.submitting || podModal.uploading}
                  className="px-4 py-2 bg-[#1f5400] hover:bg-[#173f00] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {podModal.submitting ? 'Verifying PIN...' : 'Verify PIN & Complete Delivery'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

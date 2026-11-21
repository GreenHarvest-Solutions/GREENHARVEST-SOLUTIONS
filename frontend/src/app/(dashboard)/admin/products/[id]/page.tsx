'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Award,
  Snowflake,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  TrendingUp,
  TrendingDown,
  User,
  Star,
  EyeOff,
  Eye,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminStatusPill,
  AdminModal,
  AdminAuditTimeline,
  AdminEmptyState,
} from '@/components/admin/ui';

interface Props {
  params: Promise<{ id: string }>;
}

export default function AdminProductDossierPage({ params }: Props) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;
  const { showToast } = useToast();

  const [dossier, setDossier] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Moderation action modal
  const [modalOpen, setModalOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | 'request_changes' | 'deactivate'>('approve');
  const [grade, setGrade] = useState('Grade A');
  const [coldChainRequired, setColdChainRequired] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    api
      .getProductDossier(productId)
      .then((res) => {
        if (!isMounted) return;
        setDossier(res);
        if (res.product) {
          setGrade(res.product.grade || 'Grade A');
          setColdChainRequired(Boolean(res.product.cold_chain_required));
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast(err?.response?.data?.message || 'Failed to load product dossier', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId, showToast, refreshKey]);

  const handleModerateSubmit = async () => {
    if ((action === 'reject' || action === 'request_changes') && !reason && !notes) {
      showToast('A reason or note is required for this action', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.moderateProductAdmin(productId, {
        action,
        reason,
        notes,
        grade,
        cold_chain_required: coldChainRequired,
      });

      showToast(`Product action ${action.toUpperCase()} recorded`, 'success');
      setModalOpen(false);
      setReason('');
      setNotes('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to record moderation action', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleReviewHide = async (reviewId: string | number, currentHidden: boolean) => {
    try {
      await api.moderateReviewAdmin(reviewId, {
        is_hidden: !currentHidden,
        reason: !currentHidden ? 'Hidden by admin during product moderation' : 'Restored by admin',
      });
      showToast(currentHidden ? 'Review restored' : 'Review hidden from store', 'success');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update review visibility', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] p-8 flex items-center justify-center">
        <div className="text-sm font-semibold text-gray-500 animate-pulse">
          Loading product dossier #{productId}...
        </div>
      </div>
    );
  }

  if (!dossier || !dossier.product) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] p-8 space-y-4">
        <Link
          href="/admin/products"
          className="text-xs font-semibold text-[#007a6c] hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Products Catalog
        </Link>
        <AdminEmptyState
          title="Product Not Found"
          description={`Product listing #${productId} was not found.`}
          actionLabel="Return to Catalog"
          onAction={() => window.location.assign('/admin/products')}
        />
      </div>
    );
  }

  const { product, moderationActions = [], reviews = [], benchmarkCorridor } = dossier;
  const currentPrice = parseFloat(product.price);
  const minCorridor = benchmarkCorridor ? parseFloat(benchmarkCorridor.min_price) : null;
  const maxCorridor = benchmarkCorridor ? parseFloat(benchmarkCorridor.max_price) : null;
  const targetCorridor = benchmarkCorridor ? parseFloat(benchmarkCorridor.target_price) : null;

  const isDumping = minCorridor !== null && currentPrice < minCorridor;
  const isGouging = maxCorridor !== null && currentPrice > maxCorridor;

  return (
    <div className="min-h-screen bg-[#FCF9F8] p-6 space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/products"
            className="text-xs font-semibold text-[#007a6c] hover:underline flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalog
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{product.name}</h1>
            <AdminStatusPill status={product.moderation_status || 'approved'} />
            <AdminStatusPill status={product.status} />
          </div>
          <p className="text-xs text-gray-500">
            Product Listing #{product.id} • Category: {product.category_name || 'General Produce'} • Created{' '}
            {new Date(product.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAction('approve');
              setModalOpen(true);
            }}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1f5400] hover:bg-[#163c00] flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve Listing
          </button>
          <button
            onClick={() => {
              setAction('request_changes');
              setModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-white border border-amber-300 hover:bg-amber-50 flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Request Changes
          </button>
          <button
            onClick={() => {
              setAction('reject');
              setModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject Listing
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details, Price vs Benchmark, Producer, Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Produce & Image Overview Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              Listing Details & Gallery
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="w-full h-48 bg-gray-100 border border-gray-300 overflow-hidden flex items-center justify-center">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-12 h-12 text-gray-400" />
                )}
              </div>

              <div className="md:col-span-2 space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-gray-500 uppercase">Product Description</span>
                  <p className="text-gray-800 mt-1 leading-relaxed bg-gray-50 p-2.5 border border-gray-200">
                    {product.description || 'No description provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="font-semibold text-gray-500 uppercase">Current Unit Price</span>
                    <p className="text-base font-bold text-gray-900 tabular-nums">
                      ETB {currentPrice.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <span className="font-semibold text-gray-500 uppercase">Available Inventory</span>
                    <p className="text-base font-bold text-gray-900 tabular-nums">
                      {product.stock} units
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Price Benchmark & Anti-Gouging Corridor Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c]">
                Price Corridor & Anti-Gouging Evaluation
              </h2>
              {benchmarkCorridor && (
                <span className="text-xs text-gray-500 font-medium">
                  Region: {benchmarkCorridor.region}
                </span>
              )}
            </div>

            {benchmarkCorridor ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-gray-50 border border-gray-200">
                    <span className="text-gray-500 uppercase font-semibold">Corridor Floor (Min)</span>
                    <p className="text-sm font-bold text-gray-800 tabular-nums mt-0.5">
                      ETB {minCorridor?.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-teal-50 border border-teal-200">
                    <span className="text-teal-700 uppercase font-semibold">Target Benchmark</span>
                    <p className="text-sm font-bold text-[#007a6c] tabular-nums mt-0.5">
                      ETB {targetCorridor?.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 border border-gray-200">
                    <span className="text-gray-500 uppercase font-semibold">Corridor Ceiling (Max)</span>
                    <p className="text-sm font-bold text-gray-800 tabular-nums mt-0.5">
                      ETB {maxCorridor?.toFixed(2)}
                    </p>
                  </div>
                </div>

                {isDumping && (
                  <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      <strong>Potential Dumping Warning:</strong> Product price (ETB {currentPrice.toFixed(2)}) is below the regional corridor floor of ETB {minCorridor?.toFixed(2)}.
                    </span>
                  </div>
                )}

                {isGouging && (
                  <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>
                      <strong>Price Gouging Alert:</strong> Product price (ETB {currentPrice.toFixed(2)}) exceeds the regional maximum allowed price of ETB {maxCorridor?.toFixed(2)}.
                    </span>
                  </div>
                )}

                {!isDumping && !isGouging && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      <strong>Price Verified:</strong> Listing price is balanced within the fair regional market corridor.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 py-3 text-center">
                No active price corridor set for this crop and region. You can configure one in{' '}
                <Link href="/admin/pricing" className="text-[#007a6c] font-semibold underline">
                  Price Corridors
                </Link>
                .
              </div>
            )}
          </div>

          {/* Producer Information Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              Producer & Farm Verification
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="font-semibold text-gray-500 uppercase">Farmer Name</span>
                <p className="font-bold text-gray-900 mt-0.5">{product.farmer_name}</p>
                <Link
                  href={`/admin/users/${product.farmer_id}`}
                  className="text-[#007a6c] hover:underline mt-0.5 block"
                >
                  View User 360 →
                </Link>
              </div>

              <div>
                <span className="font-semibold text-gray-500 uppercase">Farm Enterprise</span>
                <p className="font-medium text-gray-800 mt-0.5">{product.farm_name || 'Individual Smallholder'}</p>
                <p className="text-gray-500">{product.farm_type || 'Mixed Crops'}</p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 uppercase">KYC Accreditation</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <AdminStatusPill status={product.farmer_kyc_status} />
                  <span className="uppercase font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 border border-gray-300 text-xs">
                    {product.farmer_kyc_tier || 'tier_0'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Reviews & Flagging */}
          <div className="bg-white border border-gray-300 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c]">
                Customer Reviews ({reviews.length})
              </h2>
            </div>

            {reviews.length === 0 ? (
              <div className="text-xs text-gray-500 py-4 text-center">No reviews submitted yet for this produce.</div>
            ) : (
              <div className="divide-y divide-gray-100 text-xs">
                {reviews.map((r: any) => (
                  <div key={r.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                          />
                        ))}
                        <span className="text-gray-500 font-normal ml-1">by {r.reviewer_name}</span>
                      </div>
                      <p className="text-gray-800 mt-1">{r.comment}</p>
                    </div>

                    <button
                      onClick={() => handleToggleReviewHide(r.id, Boolean(r.is_hidden))}
                      className="px-2 py-1 border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 font-semibold flex items-center gap-1 shrink-0"
                    >
                      {r.is_hidden ? (
                        <>
                          <Eye className="w-3 h-3 text-emerald-600" /> Restore
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3 text-rose-600" /> Hide
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Timeline & Attributes Console */}
        <div className="space-y-6">
          {/* Quality & Grade Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              Quality Grade & Cold Chain
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-gray-500 uppercase">Certified Grade</span>
                <p className="text-sm font-bold text-gray-900 mt-0.5 flex items-center gap-1">
                  <Award className="w-4 h-4 text-amber-500" />
                  {product.grade || 'Grade A'}
                </p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 uppercase">Cold-Chain Handling</span>
                <p className="text-sm font-bold text-gray-900 mt-0.5 flex items-center gap-1">
                  <Snowflake
                    className={`w-4 h-4 ${product.cold_chain_required ? 'text-teal-600' : 'text-gray-300'}`}
                  />
                  {product.cold_chain_required ? 'Refrigerated Transit (2°C-6°C)' : 'Ambient Transit'}
                </p>
              </div>

              {product.quality_notes && (
                <div>
                  <span className="font-semibold text-gray-500 uppercase">Examiner Notes</span>
                  <p className="text-gray-700 mt-0.5 italic bg-gray-50 p-2 border border-gray-200">
                    {product.quality_notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Moderation History Timeline */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              Moderation Audit Log
            </h2>

            <AdminAuditTimeline
              events={moderationActions.map((act: any) => ({
                id: String(act.id),
                timestamp: act.created_at,
                actor: act.admin_name || 'Admin',
                action: act.action,
                description: act.reason || act.notes || undefined,
                status:
                  act.action === 'approve'
                    ? 'success'
                    : act.action === 'reject'
                    ? 'error'
                    : 'warning',
              }))}
            />
          </div>
        </div>
      </div>

      {/* Moderation Modal */}
      <AdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Moderate Listing: ${product.name}`}
        description="Every action updates listing visibility in the buyer store and notifies the farmer."
      >
        <div className="space-y-4 text-sm">
          {action === 'approve' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Certified Quality Grade
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
                >
                  <option value="Grade A">Grade A (Premium Quality)</option>
                  <option value="Grade B">Grade B (Standard Market)</option>
                  <option value="Export Grade">Export Grade (Phytosanitary)</option>
                  <option value="Organic Certified">Organic Certified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Cold-Chain Requirement
                </label>
                <select
                  value={coldChainRequired ? 'true' : 'false'}
                  onChange={(e) => setColdChainRequired(e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
                >
                  <option value="false">Ambient Transit</option>
                  <option value="true">Refrigerated Transit (2°C-6°C)</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              {action === 'approve' ? 'Moderation Summary' : 'Reason Code *'}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Verified farm gate price & grade specs"
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Feedback Notes to Farmer
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide actionable guidance..."
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleModerateSubmit}
              disabled={submitting}
              className={`px-4 py-2 text-xs font-semibold text-white ${
                action === 'approve' ? 'bg-[#1f5400] hover:bg-[#163c00]' : 'bg-rose-700 hover:bg-rose-800'
              } disabled:opacity-50`}
            >
              {submitting ? 'Recording...' : 'Submit Decision'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


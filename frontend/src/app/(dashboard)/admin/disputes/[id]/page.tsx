'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Scale,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  ShieldAlert,
  Sliders,
  DollarSign,
  User,
  Building2,
  Clock,
  Phone,
  Mail,
  Truck,
  Check,
  Eye,
  Maximize2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminModal,
  AdminAuditTimeline,
} from '@/components/admin/ui';

export default function AdminDisputeArbitratorDossierPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const disputeId = params?.id as string;

  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Settlement Calculator State
  const [buyerRefund, setBuyerRefund] = useState<number>(0);
  const [farmerPayout, setFarmerPayout] = useState<number>(0);
  const [platformFee, setPlatformFee] = useState<number>(0);
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Evidence Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchDispute = useCallback(async () => {
    if (!disputeId) return;
    setLoading(true);
    try {
      const res = await api.getAdminDisputeById(disputeId);
      if (res?.dispute) {
        setDispute(res.dispute);

        const escrow = res.dispute.escrow;
        const total = parseFloat(escrow?.escrow_amount || res.dispute.order?.total_price || 0);
        const fee = parseFloat(escrow?.platform_fee_amount || (total * 0.05).toFixed(2));
        const currentPayout = parseFloat(escrow?.farmer_payout_amount || (total - fee).toFixed(2));
        const currentRefund = parseFloat(escrow?.buyer_refund_amount || 0);

        setPlatformFee(fee);
        setBuyerRefund(currentRefund > 0 ? currentRefund : 0);
        setFarmerPayout(currentRefund > 0 ? currentPayout : total - fee);
        if (res.dispute.arbitration_notes) {
          setAdminNotes(res.dispute.arbitration_notes);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load dispute arbitrator dossier', 'error');
    } finally {
      setLoading(false);
    }
  }, [disputeId, showToast]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  const totalEscrow = parseFloat(
    dispute?.escrow?.escrow_amount || dispute?.order?.total_price || 0
  );

  // Balance calculation
  const currentSum = parseFloat((buyerRefund + farmerPayout + platformFee).toFixed(2));
  const isBalanced = Math.abs(currentSum - totalEscrow) <= 0.05;
  const balanceDiff = (totalEscrow - currentSum).toFixed(2);

  // Presets
  const applyPreset = (type: 'full_buyer' | 'half_half' | 'full_farmer') => {
    if (type === 'full_buyer') {
      const refund = parseFloat((totalEscrow - platformFee).toFixed(2));
      setBuyerRefund(refund);
      setFarmerPayout(0);
      setAdminNotes('Full refund issued to buyer due to severe transit loss / unresolvable defect.');
    } else if (type === 'half_half') {
      const remaining = totalEscrow - platformFee;
      const split = parseFloat((remaining / 2).toFixed(2));
      setBuyerRefund(split);
      setFarmerPayout(parseFloat((remaining - split).toFixed(2)));
      setAdminNotes('Shared liability 50/50 compromise settlement between buyer and cooperative.');
    } else if (type === 'full_farmer') {
      setBuyerRefund(0);
      setFarmerPayout(parseFloat((totalEscrow - platformFee).toFixed(2)));
      setAdminNotes('Claim unsubstantiated upon evidence review. Escrow released in full to producer.');
    }
  };

  const handleCommitSettlement = async () => {
    if (!isBalanced) {
      showToast(`Ledger is not balanced. Discrepancy: ETB ${balanceDiff}`, 'error');
      return;
    }
    if (!adminNotes.trim()) {
      showToast('Mandatory arbitration notes must be recorded for this verdict', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.settleAdminDisputeSplit(disputeId, {
        buyer_refund: buyerRefund,
        farmer_payout: farmerPayout,
        platform_fee: platformFee,
        admin_notes: adminNotes.trim(),
      });
      showToast(res.message || 'Dispute settlement executed and ledger balanced', 'success');
      fetchDispute();
    } catch (err: any) {
      showToast(err.message || 'Settlement execution failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FCF9F8] min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-[#1f5400] border-t-transparent rounded-full" />
          <p className="text-xs text-gray-500 font-mono mt-3">Loading arbitration claim #{disputeId}...</p>
        </div>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="flex-1 p-8 bg-[#FCF9F8]">
        <div className="bg-white border border-gray-300 p-8 text-center max-w-lg mx-auto">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-gray-900">Claim Not Found</h2>
          <p className="text-xs text-gray-500 mt-1">Dispute claim #{disputeId} does not exist.</p>
          <Link
            href="/admin/disputes"
            className="inline-block mt-4 px-4 py-2 text-xs font-bold text-white bg-[#1f5400]"
          >
            Return to Claims Queue
          </Link>
        </div>
      </div>
    );
  }

  const evidencePhotos: string[] = Array.isArray(dispute.evidence_image_urls)
    ? dispute.evidence_image_urls
    : [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Dossier Header */}
      <header className="px-8 py-4 bg-white border-b border-gray-300 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/disputes"
            className="p-1.5 text-gray-600 hover:text-gray-900 bg-gray-50 border border-gray-300 transition-colors"
            title="Back to Claims Queue"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-gray-900 font-mono">
                Dispute Claim #{dispute.id}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 border border-gray-300 bg-gray-100 text-gray-800 uppercase tabular-nums">
                CATEGORY: {dispute.dispute_category?.replace('_', ' ').toUpperCase()}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 border tabular-nums ${
                  dispute.status === 'accepted'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : dispute.status === 'rejected'
                    ? 'bg-red-50 text-red-800 border-red-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                STATUS: {dispute.status?.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Associated Consignment:{' '}
              <Link
                href={`/admin/orders/${dispute.order_id}`}
                className="font-bold text-[#1f5400] hover:underline font-mono"
              >
                Order #{dispute.order_id}
              </Link>{' '}
              • Filed on {new Date(dispute.created_at).toLocaleString('en-GB')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/admin/orders/${dispute.order_id}`}
            className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
          >
            <span>Inspect Order Dossier</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Claim Summary Alert Card */}
        <div className="bg-white border border-gray-300 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 border border-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-amber-800" />
            </div>
            <div className="flex-1">
              <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                Claim Narrative & Reported Discrepancy
              </h2>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                &quot;{dispute.reason}&quot;
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-600 font-mono">
                <div>
                  <span className="text-gray-400">Total Escrow at Stake:</span>{' '}
                  <strong className="text-gray-900 font-bold">ETB {totalEscrow.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-gray-400">Tracking Code:</span>{' '}
                  <span className="text-gray-800 font-bold">{dispute.tracking_number || 'GH-RET-000'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Carrier:</span>{' '}
                  <span className="text-gray-800">{dispute.carrier_name || 'Agro-Logistics'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Evidence Photo Gallery + Weighbridge + Order Context */}
          <div className="lg:col-span-7 space-y-6">
            {/* Visual Evidence Photo Gallery */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Physical Inspection Evidence ({evidencePhotos.length})</span>
                </h3>
                <span className="text-[11px] text-gray-500 font-mono">Buyer & Carrier Uploads</span>
              </div>

              <div className="p-5">
                {evidencePhotos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {evidencePhotos.map((url, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(url)}
                        className="group relative aspect-video bg-gray-100 border border-gray-300 overflow-hidden cursor-pointer hover:border-[#1f5400] transition-colors"
                      >
                        <img
                          src={url}
                          alt={`Evidence #${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                          <Maximize2 className="w-4 h-4" />
                          <span>Expand</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-gray-500">
                    No visual defect photographs submitted with this claim.
                  </div>
                )}
              </div>
            </div>

            {/* Weighbridge Slip */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Certified Weighbridge Slip</span>
                </h3>
                {dispute.weighbridge_slip_url && (
                  <button
                    onClick={() => setPreviewImage(dispute.weighbridge_slip_url)}
                    className="text-[11px] font-bold text-[#1f5400] hover:underline flex items-center gap-1"
                  >
                    <span>View Full Slip</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="p-5">
                {dispute.weighbridge_slip_url ? (
                  <div
                    onClick={() => setPreviewImage(dispute.weighbridge_slip_url)}
                    className="group relative h-48 bg-gray-100 border border-gray-300 overflow-hidden cursor-pointer"
                  >
                    <img
                      src={dispute.weighbridge_slip_url}
                      alt="Weighbridge Slip"
                      className="w-full h-full object-contain bg-white"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 flex items-center gap-1">
                      <Maximize2 className="w-3 h-3" />
                      <span>Click to verify weight stamp</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-gray-500 font-mono">
                    No weighbridge certification slip attached.
                  </div>
                )}
              </div>
            </div>

            {/* Consignment Line Items */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Disputed Consignment Items ({dispute.items?.length || 0})
                </h3>
              </div>
              <div className="divide-y divide-gray-200">
                {dispute.items?.map((item: any) => (
                  <div key={item.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-gray-900">{item.product_name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {item.quantity} units booked @ ETB {parseFloat(item.unit_price).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-gray-900">
                      ETB {parseFloat(item.line_total).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit History */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Arbitration Audit Trail
                </h3>
              </div>
              <div className="p-5">
                <AdminAuditTimeline events={dispute.audit_trail || []} />
              </div>
            </div>
          </div>

          {/* Right Column: Split Settlement Calculator & Verdict Desk */}
          <div className="lg:col-span-5 space-y-6">
            {/* Split Settlement Calculator Card */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Escrow Split Settlement Calculator</span>
                </h3>
                <span className="font-mono text-xs font-bold text-[#1f5400]">
                  ETB {totalEscrow.toFixed(2)}
                </span>
              </div>

              <div className="p-5 space-y-5 text-xs">
                {/* Balance Integrity Status Box */}
                <div
                  className={`p-3 border text-xs font-mono flex items-center justify-between ${
                    isBalanced
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-red-50 border-red-300 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold">
                        {isBalanced ? '✓ Ledger Invariant Balanced' : '✕ Balance Integrity Breach'}
                      </div>
                      <div className="text-[11px] opacity-80">
                        Sum: ETB {currentSum.toFixed(2)} / Required: ETB {totalEscrow.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {!isBalanced && (
                    <span className="text-xs font-bold text-red-700">
                      Diff: {balanceDiff > '0' ? `+${balanceDiff}` : balanceDiff}
                    </span>
                  )}
                </div>

                {/* Quick Presets */}
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Arbitration Verdict Presets
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('full_buyer')}
                      className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-[11px] font-bold text-center"
                    >
                      100% Refund (Buyer)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('half_half')}
                      className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold text-center"
                    >
                      50/50 Split
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('full_farmer')}
                      className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold text-center"
                    >
                      100% Farmer
                    </button>
                  </div>
                </div>

                {/* Inputs */}
                <div className="space-y-3 font-mono">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-red-800 uppercase tracking-wider">
                        Buyer Refund Amount (ETB)
                      </label>
                      <span className="text-xs text-gray-500 font-bold">
                        {((buyerRefund / totalEscrow) * 100 || 0).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={totalEscrow}
                      value={buyerRefund}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setBuyerRefund(val);
                        // Auto-adjust farmer payout to balance
                        const remaining = Math.max(0, totalEscrow - platformFee - val);
                        setFarmerPayout(parseFloat(remaining.toFixed(2)));
                      }}
                      className="w-full border border-gray-300 p-2 font-bold text-gray-900 text-sm focus:outline-none focus:border-[#1f5400]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        Farmer Payout Amount (ETB)
                      </label>
                      <span className="text-xs text-gray-500 font-bold">
                        {((farmerPayout / totalEscrow) * 100 || 0).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={totalEscrow}
                      value={farmerPayout}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFarmerPayout(val);
                        // Auto-adjust buyer refund to balance
                        const remaining = Math.max(0, totalEscrow - platformFee - val);
                        setBuyerRefund(parseFloat(remaining.toFixed(2)));
                      }}
                      className="w-full border border-gray-300 p-2 font-bold text-gray-900 text-sm focus:outline-none focus:border-[#1f5400]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                        Platform Retained Fee (5%)
                      </label>
                      <span className="text-xs text-gray-400">Fixed</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={platformFee}
                      onChange={(e) => setPlatformFee(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 p-2 font-bold text-gray-600 bg-gray-50 text-sm"
                    />
                  </div>
                </div>

                {/* Arbitration Verdict Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Mandatory Arbitration Rationale / Verdict Notes
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Document evidence verification, weighbridge stamp authenticity, and reasons for this allocation..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full border border-gray-300 p-2 text-xs focus:outline-none focus:border-[#1f5400] text-gray-800"
                  />
                </div>

                {/* Commit Action */}
                <button
                  type="button"
                  disabled={!isBalanced || isSubmitting || !adminNotes.trim()}
                  onClick={handleCommitSettlement}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {isSubmitting ? 'Executing Settlement...' : 'Commit Arbitrated Settlement'}
                  </span>
                </button>
              </div>
            </div>

            {/* Litigant Parties Dossier Card */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                  Litigant Stakeholders
                </h3>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* Commercial Buyer */}
                <div className="p-3 bg-gray-50 border border-gray-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Commercial Buyer</span>
                    <Link
                      href={`/admin/users/${dispute.buyer_id}`}
                      className="text-[10px] font-bold text-[#1f5400] hover:underline"
                    >
                      User 360 →
                    </Link>
                  </div>
                  <div className="font-bold text-gray-900">{dispute.buyer_name}</div>
                  <div className="text-gray-500 font-mono text-[11px]">{dispute.buyer_phone || dispute.buyer_email}</div>
                </div>

                {/* Agricultural Producer */}
                <div className="p-3 bg-gray-50 border border-gray-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Agricultural Producer</span>
                    <Link
                      href={`/admin/kyc/${dispute.farmer_id}`}
                      className="text-[10px] font-bold text-[#1f5400] hover:underline"
                    >
                      Farmer KYC →
                    </Link>
                  </div>
                  <div className="font-bold text-gray-900">{dispute.farmer_name}</div>
                  <div className="text-gray-500 font-mono text-[11px]">{dispute.farmer_phone || dispute.farmer_email}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <AdminModal
          isOpen={Boolean(previewImage)}
          onClose={() => setPreviewImage(null)}
          title="Evidence Inspection Viewer"
          description="High-resolution document & photographic evidence."
        >
          <div className="space-y-3">
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-gray-900 p-2">
              <img
                src={previewImage}
                alt="Evidence inspection"
                className="max-h-[70vh] object-contain"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Close Preview
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}


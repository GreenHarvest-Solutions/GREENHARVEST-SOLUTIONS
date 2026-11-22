'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  MapPin,
  Calendar,
  User,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Phone,
  Mail,
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

export default function AdminKycDossierPage({ params }: Props) {
  const resolvedParams = use(params);
  const farmerId = resolvedParams.id;
  const { showToast } = useToast();

  const [dossier, setDossier] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'request_info'>('approve');
  const [selectedTier, setSelectedTier] = useState('tier_1');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Field visit modal state
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [findings, setFindings] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState('');
  const [cropsText, setCropsText] = useState('');
  const [recommendation, setRecommendation] = useState('approve');
  const [submittingVisit, setSubmittingVisit] = useState(false);

  // Document upload modal state
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [documentType, setDocumentType] = useState('National ID / Kebele Card');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUrlInput, setDocUrlInput] = useState('');
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    Promise.all([api.getKycDossier(farmerId), api.getKycHistory(farmerId)])
      .then(([dossierRes, historyRes]) => {
        if (!isMounted) return;
        setDossier(dossierRes);
        setHistory(historyRes.history || []);
        if (dossierRes?.farmer?.kyc_tier && dossierRes.farmer.kyc_tier !== 'provisional') {
          setSelectedTier(dossierRes.farmer.kyc_tier);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast(err?.response?.data?.message || 'Failed to load KYC dossier', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [farmerId, showToast, refreshKey]);

  const handleReviewSubmit = async () => {
    if ((decision === 'reject' || decision === 'request_info') && !reason && !notes) {
      showToast('A reason or note is required for this decision', 'error');
      return;
    }

    setSubmittingReview(true);
    try {
      await api.reviewKyc(farmerId, {
        decision,
        tier: selectedTier,
        reason,
        notes,
      });
      showToast(`KYC decision recorded: ${decision.toUpperCase()}`, 'success');
      setReviewModalOpen(false);
      setReason('');
      setNotes('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to record KYC decision', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleFieldVisitSubmit = async () => {
    if (!findings.trim()) {
      showToast('Findings field is required', 'error');
      return;
    }

    setSubmittingVisit(true);
    try {
      const crops = cropsText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      await api.addFieldVisit(farmerId, {
        findings,
        gps_coordinates: gpsCoordinates || undefined,
        verified_crops: crops.length > 0 ? crops : undefined,
        recommendation,
      });

      showToast('Field visit recorded successfully', 'success');
      setVisitModalOpen(false);
      setFindings('');
      setGpsCoordinates('');
      setCropsText('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to log field visit', 'error');
    } finally {
      setSubmittingVisit(false);
    }
  };

  const handleDocumentUpload = async () => {
    if (!docFile && !docUrlInput.trim()) {
      showToast('Please select a file or enter a document URL', 'error');
      return;
    }

    setSubmittingDoc(true);
    try {
      const formData = new FormData();
      formData.append('document_type', documentType);
      if (docFile) {
        formData.append('document', docFile);
      } else {
        formData.append('document_url', docUrlInput.trim());
      }

      await api.addKycDocument(farmerId, formData);
      showToast('KYC document attached to dossier', 'success');
      setDocModalOpen(false);
      setDocFile(null);
      setDocUrlInput('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to upload document', 'error');
    } finally {
      setSubmittingDoc(false);
    }
  };

  const handleDeleteDocument = async (documentId: string | number) => {
    if (!confirm('Are you sure you want to remove this document from the dossier?')) return;
    try {
      await api.deleteKycDocument(farmerId, documentId);
      showToast('Document removed', 'success');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to remove document', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] p-8 flex items-center justify-center">
        <div className="text-sm font-semibold text-gray-500 animate-pulse">
          Loading producer dossier #{farmerId}...
        </div>
      </div>
    );
  }

  if (!dossier || !dossier.farmer) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] p-8 space-y-4">
        <Link
          href="/admin/kyc"
          className="text-xs font-semibold text-[#007a6c] hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to KYC Queue
        </Link>
        <AdminEmptyState
          title="Farmer Dossier Not Found"
          description={`Farmer #${farmerId} does not exist or has been removed.`}
          actionLabel="Return to KYC Queue"
          onAction={() => window.location.assign('/admin/kyc')}
        />
      </div>
    );
  }

  const { farmer, documents = [], fieldVisits = [], riskFlags = [] } = dossier;

  return (
    <div className="min-h-screen bg-[#FCF9F8] p-6 space-y-6">
      {/* Header & Back Link */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/kyc"
            className="text-xs font-semibold text-[#007a6c] hover:underline flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Queue
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{farmer.name}</h1>
            <AdminStatusPill status={farmer.kyc_status} />
            <span className="px-2 py-0.5 text-xs font-semibold uppercase bg-gray-100 text-gray-800 border border-gray-300">
              {farmer.kyc_tier || 'tier_0'}
            </span>
            {riskFlags.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                {riskFlags.length} Risk Alert{riskFlags.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Producer Dossier #{farmer.id} • Registered{' '}
            {new Date(farmer.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/users/${farmer.id}`}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            View User 360
          </Link>
          <button
            onClick={() => {
              setDecision('approve');
              setReviewModalOpen(true);
            }}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1f5400] hover:bg-[#163c00] transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve Accreditation
          </button>
          <button
            onClick={() => {
              setDecision('reject');
              setReviewModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject / Request Info
          </button>
        </div>
      </div>

      {/* Risk Alert Banner */}
      {riskFlags.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Security & Identity Risk Alerts ({riskFlags.length})
          </div>
          <div className="space-y-1.5">
            {riskFlags.map((rf: any) => (
              <div key={rf.id} className="text-xs text-amber-800 flex items-start gap-2">
                <span className="font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[10px]">
                  {rf.severity}
                </span>
                <span>{rf.flag_reason}</span>
                {rf.confidence_score && (
                  <span className="text-amber-700 font-mono text-[10px]">
                    (Confidence: {rf.confidence_score}%)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Profile, Documents, Field Visits */}
        <div className="lg:col-span-2 space-y-6">
          {/* Farm & Profile Overview Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c]">
                Farm Enterprise & Producer Profile
              </h2>
              <span className="text-xs text-gray-500 font-medium">
                Status: {farmer.account_status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <div className="font-semibold text-gray-500 uppercase tracking-wider">Enterprise Name</div>
                <div className="font-bold text-gray-900 text-sm">
                  {farmer.farm_name || 'Individual Smallholder'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-gray-500 uppercase tracking-wider">Region / Woreda / Kebele</div>
                <div className="flex items-center gap-1 text-gray-800 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {[farmer.region, farmer.woreda, farmer.kebele].filter(Boolean).join(' • ') || farmer.farm_type || 'Unspecified Location'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-gray-500 uppercase tracking-wider">Farming Model & Size</div>
                <div className="font-medium text-gray-800 capitalize">
                  {farmer.farming_type || 'Smallholder'} {farmer.farm_size_hectares ? `(${farmer.farm_size_hectares} ha)` : ''}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-gray-500 uppercase tracking-wider">Primary Crops</div>
                <div className="font-medium text-gray-800">
                  {Array.isArray(farmer.primary_crops) && farmer.primary_crops.length > 0
                    ? farmer.primary_crops.join(', ')
                    : 'Not specified'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-gray-500 uppercase tracking-wider">Banking & Payout</div>
                <div className="font-medium text-gray-800">
                  {farmer.bank_name
                    ? `${farmer.bank_name} (${farmer.bank_account_number || 'No Account #'})`
                    : 'No bank account recorded'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-gray-500 uppercase tracking-wider">Email Address</div>
                <div className="flex items-center gap-1 text-gray-800">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {farmer.email}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-gray-500 uppercase tracking-wider">Phone Contact</div>
                <div className="flex items-center gap-1 text-gray-800">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {farmer.phone || 'No phone recorded'}
                </div>
              </div>

              {farmer.pickup_address && (
                <div className="md:col-span-2 space-y-1">
                  <div className="font-semibold text-gray-500 uppercase tracking-wider">Pickup Address & Instructions</div>
                  <div className="text-gray-800 font-medium">
                    {farmer.pickup_address} {farmer.pickup_instructions ? `— ${farmer.pickup_instructions}` : ''}
                  </div>
                </div>
              )}
            </div>

            {farmer.bio && (
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Farm Operations Summary
                </div>
                <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-2.5 border border-gray-200">
                  {farmer.bio}
                </p>
              </div>
            )}
          </div>

          {/* Legal Documents Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c]">
                  Verification Documents Checklist
                </h2>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 font-bold">
                  {documents.length}
                </span>
              </div>
              <button
                onClick={() => setDocModalOpen(true)}
                className="px-2.5 py-1 text-xs font-semibold text-[#007a6c] bg-white border border-[#007a6c] hover:bg-teal-50 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Attach Document
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">
                No KYC documents uploaded yet. Use the Attach Document button above.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">{doc.document_type}</div>
                        <div className="text-xs text-gray-500">
                          Uploaded on {new Date(doc.created_at).toLocaleDateString()}
                          {doc.expires_at && (
                            <> • Expires {new Date(doc.expires_at).toLocaleDateString()}</>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <AdminStatusPill status={doc.status} />
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 border border-gray-300 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1 text-gray-400 hover:text-rose-600"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Field Visits Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c]">
                  Field Agent Inspection Audits
                </h2>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 font-bold">
                  {fieldVisits.length}
                </span>
              </div>
              <button
                onClick={() => setVisitModalOpen(true)}
                className="px-2.5 py-1 text-xs font-semibold text-[#007a6c] bg-white border border-[#007a6c] hover:bg-teal-50 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Field Visit
              </button>
            </div>

            {fieldVisits.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">
                No physical farm field visits logged yet. Field visits are required for Tier 2 and Tier 3 accreditation.
              </div>
            ) : (
              <div className="space-y-3">
                {fieldVisits.map((v: any) => (
                  <div key={v.id} className="p-3.5 bg-gray-50 border border-gray-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-gray-900">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        Audit Date: {new Date(v.visit_date).toLocaleDateString()}
                        {v.agent_name && (
                          <span className="text-gray-500 font-normal">
                            by Agent {v.agent_name}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 text-xs font-bold uppercase border ${
                          v.recommendation === 'approve'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                      >
                        Recommendation: {v.recommendation}
                      </span>
                    </div>

                    <p className="text-gray-700 leading-relaxed">{v.findings}</p>

                    {v.gps_coordinates && (
                      <div className="text-gray-500 flex items-center gap-1 font-mono text-xs">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        Coordinates: {v.gps_coordinates}
                      </div>
                    )}

                    {v.verified_crops && Array.isArray(v.verified_crops) && v.verified_crops.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {v.verified_crops.map((crop: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-white border border-gray-300 text-gray-700 text-xs"
                          >
                            {crop}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Timeline & Decision Controls */}
        <div className="space-y-6">
          {/* Quick Review Console Card */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              Decision & Tier Assessment
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 uppercase mb-1">
                  Current Accreditation
                </label>
                <div className="p-2 bg-gray-50 border border-gray-200 font-bold uppercase text-gray-800">
                  {farmer.kyc_tier || 'tier_0'} ({farmer.kyc_status})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 uppercase mb-1">
                  Target Tier Recommendation
                </label>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
                >
                  <option value="tier_1">Tier 1 — Verified Smallholder</option>
                  <option value="tier_2">Tier 2 — Certified Commercial / Co-op</option>
                  <option value="tier_3">Tier 3 — Export & Cold-Chain Accredited</option>
                </select>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    setDecision('approve');
                    setReviewModalOpen(true);
                  }}
                  className="w-full py-2 bg-[#1f5400] text-white font-semibold hover:bg-[#163c00] transition-colors"
                >
                  Approve Verification
                </button>
                <button
                  onClick={() => {
                    setDecision('request_info');
                    setReviewModalOpen(true);
                  }}
                  className="w-full py-2 bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors"
                >
                  Request Additional Information
                </button>
                <button
                  onClick={() => {
                    setDecision('reject');
                    setReviewModalOpen(true);
                  }}
                  className="w-full py-2 bg-rose-700 text-white font-semibold hover:bg-rose-800 transition-colors"
                >
                  Reject Application
                </button>
              </div>
            </div>
          </div>

          {/* Dossier Audit Timeline */}
          <div className="bg-white border border-gray-300 p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c] border-b border-gray-100 pb-2">
              Dossier Audit Timeline
            </h2>

            <AdminAuditTimeline
              events={history.map((h: any) => ({
                id: String(h.id),
                timestamp: h.created_at,
                actor: h.actor_name || 'System',
                action: h.event_type || h.decision || 'KYC Event',
                description: h.reason || h.notes || undefined,
                status:
                  h.decision === 'approve'
                    ? 'success'
                    : h.decision === 'reject'
                    ? 'error'
                    : 'info',
              }))}
            />
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <AdminModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={
          decision === 'approve'
            ? `Approve Verification for ${farmer.name}`
            : decision === 'reject'
            ? `Reject Application for ${farmer.name}`
            : `Request Additional Documents / Info`
        }
        description="Every state change writes an immutable audit log and notifies the farmer."
      >
        <div className="space-y-4 text-sm">
          {decision === 'approve' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tier Level Assigned
              </label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
              >
                <option value="tier_1">Tier 1 — Verified Smallholder Producer</option>
                <option value="tier_2">Tier 2 — Certified Commercial Cooperative</option>
                <option value="tier_3">Tier 3 — Export & Cold-Chain Accredited</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              {decision === 'approve' ? 'Verification Summary' : 'Mandatory Reason Code'}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                decision === 'approve'
                  ? 'e.g. Identity and landholding title confirmed.'
                  : 'e.g. Mismatched land ownership deed or invalid ID.'
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Internal Examiner Notes / Instructions for Farmer
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide clear notes or instructions..."
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setReviewModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReviewSubmit}
              disabled={submittingReview}
              className={`px-4 py-2 text-xs font-semibold text-white ${
                decision === 'approve'
                  ? 'bg-[#1f5400] hover:bg-[#163c00]'
                  : 'bg-rose-700 hover:bg-rose-800'
              } disabled:opacity-50`}
            >
              {submittingReview ? 'Recording...' : 'Submit Decision'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Field Visit Modal */}
      <AdminModal
        isOpen={visitModalOpen}
        onClose={() => setVisitModalOpen(false)}
        title={`Log Farm Inspection Audit for ${farmer.name}`}
        description="Records physical verification findings from extension field agents."
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Field Findings & Farm Observations *
            </label>
            <textarea
              rows={3}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Detailed observations regarding acreage, water source, post-harvest facilities..."
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                GPS Coordinates
              </label>
              <input
                type="text"
                value={gpsCoordinates}
                onChange={(e) => setGpsCoordinates(e.target.value)}
                placeholder="e.g. 8.7522° N, 38.9785° E"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Recommendation
              </label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
              >
                <option value="approve">Recommend for Approval</option>
                <option value="reject">Recommend for Rejection</option>
                <option value="followup">Needs Re-visit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Verified Crops (comma-separated)
            </label>
            <input
              type="text"
              value={cropsText}
              onChange={(e) => setCropsText(e.target.value)}
              placeholder="e.g. White Teff, Hass Avocados, Tomatoes, Cabbage"
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setVisitModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleFieldVisitSubmit}
              disabled={submittingVisit}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1f5400] hover:bg-[#163c00] disabled:opacity-50"
            >
              {submittingVisit ? 'Saving...' : 'Save Field Visit'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Document Upload Modal */}
      <AdminModal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        title="Attach Legal Document to Dossier"
        description="Upload landholding certificate, kebele ID, or cooperative registration."
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
            >
              <option value="National ID / Kebele Card">National ID / Kebele Card</option>
              <option value="Land Ownership Certificate">Land Ownership Certificate</option>
              <option value="Cooperative Membership Stamp">Cooperative Membership Stamp</option>
              <option value="Agricultural License">Agricultural License</option>
              <option value="Organic Certification">Organic Certification</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Upload File (Max 5MB • JPG, PNG, PDF)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:border file:border-gray-300 file:text-xs file:font-semibold file:bg-gray-50 hover:file:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Or Document URL / Cloud Link
            </label>
            <input
              type="url"
              value={docUrlInput}
              onChange={(e) => setDocUrlInput(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setDocModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDocumentUpload}
              disabled={submittingDoc}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#007a6c] hover:bg-[#005f54] disabled:opacity-50"
            >
              {submittingDoc ? 'Uploading...' : 'Upload & Attach'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Document Preview Modal */}
      <AdminModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.document_type || 'Document Preview'}
        description={`Attached on ${previewDoc?.created_at ? new Date(previewDoc.created_at).toLocaleDateString() : ''}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Visual Document View */}
            <div className="max-h-[50vh] overflow-auto border border-gray-200 bg-gray-50 p-2 flex items-center justify-center">
              {previewDoc?.document_url?.endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.document_url}
                  className="w-full h-80 border-none"
                  title="Document PDF"
                />
              ) : (
                <img
                  src={previewDoc?.document_url}
                  alt="Document preview"
                  className="max-h-[48vh] max-w-full object-contain"
                />
              )}
            </div>

            {/* OCR & Document Intelligence Extraction */}
            <div className="space-y-3 bg-gray-50 border border-gray-200 p-3 text-xs">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span className="font-bold uppercase tracking-wider text-gray-700">
                  OCR Extracted Metadata
                </span>
                {previewDoc?.ocr_confidence ? (
                  <span className={`px-2 py-0.5 font-bold font-mono text-[11px] ${Number(previewDoc.ocr_confidence) >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    Confidence: {previewDoc.ocr_confidence}%
                  </span>
                ) : (
                  <span className="text-gray-400 font-mono text-[11px]">Unscored</span>
                )}
              </div>

              {previewDoc?.extracted_data && Object.keys(previewDoc.extracted_data).length > 0 ? (
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">Extracted Full Name</div>
                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                      {previewDoc.extracted_data.full_name || 'Not detected'}
                      {previewDoc.extracted_data.full_name && (
                        farmer.name.toLowerCase().includes(previewDoc.extracted_data.full_name.toLowerCase()) ||
                        previewDoc.extracted_data.full_name.toLowerCase().includes(farmer.name.toLowerCase()) ? (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 border border-emerald-200">Matches Profile</span>
                        ) : (
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1 border border-amber-200">Name Discrepancy</span>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">Detected ID Number & Type</div>
                    <div className="font-mono font-bold text-gray-900">
                      {previewDoc.extracted_data.id_number || 'Not detected'}
                      {previewDoc.extracted_data.id_type_detected && (
                        <span className="ml-2 text-[10px] text-gray-600 font-sans font-medium uppercase px-1 bg-gray-200">
                          {previewDoc.extracted_data.id_type_detected.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase">Region / Woreda / Kebele</div>
                    <div className="font-medium text-gray-800">
                      {[previewDoc.extracted_data.region, previewDoc.extracted_data.woreda, previewDoc.extracted_data.kebele].filter(Boolean).join(' • ') || 'Not detected'}
                    </div>
                  </div>

                  {previewDoc.id_hash && (
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase">SHA-256 ID Hash</div>
                      <div className="font-mono text-[10px] text-gray-600 truncate bg-white p-1 border border-gray-200 select-all">
                        {previewDoc.id_hash}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 py-6 text-center">
                  No automated OCR fields extracted. Document requires manual inspector review.
                </div>
              )}

              {previewDoc?.ocr_raw_text && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">OCR Raw Output Preview</div>
                  <pre className="text-[10px] text-gray-600 font-mono bg-white p-2 border border-gray-200 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {previewDoc.ocr_raw_text}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-200">
            <a
              href={previewDoc?.document_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#007a6c] font-semibold flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open full resolution
            </a>
            <button
              onClick={() => setPreviewDoc(null)}
              className="px-4 py-1.5 border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


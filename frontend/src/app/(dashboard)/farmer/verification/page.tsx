'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

type KycDocument = {
  id: number;
  document_type: string;
  document_category: string;
  document_url: string;
  public_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type KycReview = {
  id: number;
  decision: string;
  tier: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  reviewer_name: string | null;
};

type KycStatusData = {
  farmer_id: number;
  name: string;
  email: string;
  kyc_status: string;
  kyc_tier: string;
  is_verified: boolean;
  email_verified: boolean;
  documents: KycDocument[];
  latest_review: KycReview | null;
  allowed_actions: string[];
};

export default function FarmerVerificationPage() {
  const { showSuccess, showError } = useToast();
  const [kycData, setKycData] = useState<KycStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Upload Form State
  const [documentCategory, setDocumentCategory] = useState<string>('identity');
  const [documentType, setDocumentType] = useState<string>('National ID');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchKycData = async () => {
    try {
      setLoading(true);
      const res = await api.getFarmerKycStatus();
      setKycData(res);
    } catch (err: any) {
      console.error('Failed to load KYC status', err);
      showError(err.message || 'Failed to load verification status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showError('File size exceeds 5MB limit. Please select a smaller file.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showError('Please choose a document file to upload.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('document_type', documentType);
      formData.append('document_category', documentCategory);

      await api.uploadFarmerKycDocument(formData);
      showSuccess('Document uploaded successfully.');
      setSelectedFile(null);
      // Reset file input element
      const fileInput = document.getElementById('kyc-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      await fetchKycData();
    } catch (err: any) {
      console.error('Document upload failed', err);
      showError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm('Are you sure you want to remove this document?')) return;
    setDeletingId(docId);
    try {
      await api.deleteFarmerKycDocument(docId);
      showSuccess('Document removed successfully.');
      await fetchKycData();
    } catch (err: any) {
      console.error('Failed to delete document', err);
      showError(err.message || 'Failed to remove document');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmitApplication = async () => {
    if (!kycData?.documents || kycData.documents.length === 0) {
      showError('You must upload at least one valid identity or land holding document before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitFarmerKyc();
      showSuccess(res.message || 'Application submitted successfully for review.');
      await fetchKycData();
    } catch (err: any) {
      console.error('Submission failed', err);
      showError(err.message || 'Failed to submit verification application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#2d9a33] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-gray-500">Loading verification details...</p>
        </div>
      </div>
    );
  }

  const status = kycData?.kyc_status || 'not_submitted';
  const isApproved = status === 'approved';
  const isUnderReview = status === 'under_review' || status === 'field_visit';
  const isChangesRequested = status === 'changes_requested';
  const isRejected = status === 'rejected';
  const isDraftOrPending = status === 'not_submitted' || status === 'pending';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-800">
      {/* Top Header */}
      <header className="h-18 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/farmer/dashboard"
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#2d9a33] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Dashboard
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#2d9a33]">verified_user</span>
            Farmer Verification Center
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/farmer/profile"
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit Farm Profile
          </Link>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
              isApproved
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : isUnderReview
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : isChangesRequested
                ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                : isRejected
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-gray-100 text-gray-800 border border-gray-300'
            }`}
          >
            {isApproved ? 'Verified Seller (Tier 1)' : 'Provisional Seller'}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Status Hero Banner */}
        <section
          className={`rounded-2xl p-6 border transition-all ${
            isApproved
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
              : isUnderReview
              ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
              : isChangesRequested
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
              : isRejected
              ? 'bg-gradient-to-r from-rose-50 to-red-50 border-rose-200'
              : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-2xl ${
                    isApproved
                      ? 'text-emerald-600'
                      : isUnderReview
                      ? 'text-blue-600'
                      : isChangesRequested
                      ? 'text-amber-600'
                      : isRejected
                      ? 'text-rose-600'
                      : 'text-gray-500'
                  }`}
                >
                  {isApproved
                    ? 'check_circle'
                    : isUnderReview
                    ? 'hourglass_top'
                    : isChangesRequested
                    ? 'warning'
                    : isRejected
                    ? 'cancel'
                    : 'assignment'}
                </span>
                <h2 className="text-xl font-bold text-gray-900">
                  {isApproved && 'Account Verified — Full Selling Privileges'}
                  {isUnderReview && 'KYC Application Under Review'}
                  {isChangesRequested && 'Action Required: Additional Information Requested'}
                  {isRejected && 'Verification Application Not Approved'}
                  {isDraftOrPending && 'Progressive KYC Onboarding'}
                </h2>
              </div>
              <p className="text-sm text-gray-600 max-w-3xl leading-relaxed">
                {isApproved &&
                  'Your farmer accreditation is active at Tier 1. You benefit from automatic low-risk listing publication, verified seller badge, priority logistics routing, and unrestricted marketplace orders.'}
                {isUnderReview &&
                  'Your submitted identification and agricultural credentials are currently being examined by GreenHarvest compliance officers. Submissions are reviewed sequentially. You will receive an on-platform notification once completed.'}
                {isChangesRequested &&
                  'A compliance officer reviewed your dossier and requested corrections or updated documents. Review the reviewer feedback notes below, remove any rejected records, upload the requested documents, and resubmit.'}
                {isRejected &&
                  'Your verification application was rejected based on administrative criteria. Your account remains active and you can continue editing product drafts, but automated publishing is disabled. Please review the reviewer notes and submit updated credentials.'}
                {isDraftOrPending &&
                  'As an unverified seller, you can progressively complete your farm profile, create product listings, and edit drafts. However, all new listings require manual administrator approval before appearing in the public marketplace. Complete verification below to unlock automated publishing.'}
              </p>
            </div>

            {/* Quick Action Button in Banner */}
            {(isDraftOrPending || isChangesRequested) && (
              <button
                type="button"
                onClick={handleSubmitApplication}
                disabled={submitting || (kycData?.documents?.length || 0) === 0}
                className="self-start md:self-auto inline-flex items-center gap-2 bg-[#2d9a33] hover:bg-[#257d2a] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {submitting ? 'sync' : 'send'}
                </span>
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            )}
          </div>
        </section>

        {/* Reviewer Feedback Notes (if changes requested or rejected) */}
        {kycData?.latest_review && (isChangesRequested || isRejected) && (
          <section className="bg-amber-50 border border-amber-300 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <span className="material-symbols-outlined text-amber-600">rate_review</span>
              Compliance Officer Feedback
              {kycData.latest_review.reviewer_name && (
                <span className="text-xs font-normal text-amber-700">
                  by {kycData.latest_review.reviewer_name} on{' '}
                  {new Date(kycData.latest_review.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {kycData.latest_review.reason && (
              <p className="text-sm font-semibold text-amber-950">
                Reason: {kycData.latest_review.reason}
              </p>
            )}
            {kycData.latest_review.notes && (
              <p className="text-sm text-amber-900 bg-white/70 p-3 rounded-lg border border-amber-200">
                {kycData.latest_review.notes}
              </p>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Upload New Document */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#2d9a33]">upload_file</span>
                  Upload Credentials
                </h3>
                <p className="text-xs text-gray-500">
                  Accepted formats: JPG, PNG, WEBP, or PDF. Max file size: 5MB per document.
                </p>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Document Category
                  </label>
                  <select
                    value={documentCategory}
                    onChange={(e) => {
                      setDocumentCategory(e.target.value);
                      if (e.target.value === 'identity') setDocumentType('National ID');
                      else if (e.target.value === 'land_ownership') setDocumentType('Land Holding Certificate');
                      else if (e.target.value === 'coop_certificate') setDocumentType('Cooperative Membership Proof');
                      else if (e.target.value === 'trade_license') setDocumentType('Agricultural Trade License');
                    }}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                  >
                    <option value="identity">Personal Identity (National ID / Passport / Kebele)</option>
                    <option value="land_ownership">Land Ownership / Holding Rights</option>
                    <option value="coop_certificate">Cooperative / Union Certificate</option>
                    <option value="trade_license">Agricultural Trade License</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Document Title / Type
                  </label>
                  <input
                    type="text"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    placeholder="e.g. Ethiopian National ID Card (Front & Back)"
                    required
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Select File
                  </label>
                  <div className="border-2 border-dashed border-gray-300 hover:border-[#2d9a33] rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-[#2d9a33]/5">
                    <input
                      id="kyc-file-input"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="kyc-file-input" className="cursor-pointer space-y-1 block">
                      <span className="material-symbols-outlined text-gray-400 text-3xl">add_photo_alternate</span>
                      <p className="text-xs font-medium text-gray-700">
                        {selectedFile ? selectedFile.name : 'Click or drop file to choose'}
                      </p>
                      {selectedFile && (
                        <p className="text-[11px] text-gray-400">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      )}
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="w-full bg-[#2d9a33] hover:bg-[#257d2a] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {uploading ? 'sync' : 'cloud_upload'}
                  </span>
                  {uploading ? 'Uploading to Secure Vault...' : 'Upload Document'}
                </button>
              </form>
            </section>

            {/* Verification Tiers Info */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-500">info</span>
                Verification Privileges
              </h4>
              <ul className="text-xs text-gray-600 space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[18px] flex-shrink-0">shield</span>
                  <div>
                    <strong className="text-gray-800">Provisional Seller (Current):</strong> Newly submitted listings require manual admin moderation before publication.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px] flex-shrink-0">verified</span>
                  <div>
                    <strong className="text-gray-800">Tier 1 Verified Producer:</strong> Automatic low-risk product publication, green verification badge, priority carrier dispatch.
                  </div>
                </li>
              </ul>
            </section>
          </div>

          {/* Right Column: Uploaded Documents Table & Submission Action */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#2d9a33]">folder_shared</span>
                    Uploaded Dossier Documents ({kycData?.documents?.length || 0})
                  </h3>
                  <p className="text-xs text-gray-500">
                    All credentials stored in encrypted cloud storage for compliance audits.
                  </p>
                </div>

                {(isDraftOrPending || isChangesRequested) && (
                  <button
                    type="button"
                    onClick={handleSubmitApplication}
                    disabled={submitting || (kycData?.documents?.length || 0) === 0}
                    className="bg-[#2d9a33] hover:bg-[#257d2a] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                )}
              </div>

              {!kycData?.documents || kycData.documents.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center space-y-2">
                  <span className="material-symbols-outlined text-gray-300 text-4xl">inventory_2</span>
                  <p className="text-sm font-semibold text-gray-700">No documents uploaded yet</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Upload your National ID, Kebele card, or Land Holding certificate using the form to start verification.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="pb-3">Document</th>
                        <th className="pb-3">Category</th>
                        <th className="pb-3">Uploaded</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {kycData.documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 font-medium text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-gray-400 text-[20px]">
                              {doc.document_url.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                            </span>
                            <span className="truncate max-w-[200px]" title={doc.document_type}>
                              {doc.document_type}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-gray-500 capitalize">
                            {doc.document_category?.replace('_', ' ') || 'identity'}
                          </td>
                          <td className="py-3 text-xs text-gray-500">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                doc.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : doc.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {doc.status}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-2">
                            <a
                              href={doc.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-[#2d9a33] hover:underline inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              View
                            </a>
                            {!isUnderReview && (
                              <button
                                type="button"
                                onClick={() => handleDelete(doc.id)}
                                disabled={deletingId === doc.id}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50 inline-flex items-center gap-1 ml-2"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {deletingId === doc.id ? 'sync' : 'delete'}
                                </span>
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Farm Profile Progress Summary Card */}
            <section className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <span className="material-symbols-outlined">agriculture</span>
                  Have you completed your Farm Location & Crops?
                </h4>
                <p className="text-xs text-emerald-100 max-w-xl">
                  Accurate Woreda, Kebele, and crop details help compliance officers approve your KYC faster and enable automated cold-chain logistics dispatch.
                </p>
              </div>
              <Link
                href="/farmer/profile"
                className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm text-center self-start md:self-auto"
              >
                Go to Farm Profile
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}


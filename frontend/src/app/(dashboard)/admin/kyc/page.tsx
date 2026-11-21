'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminStatusPill,
  AdminPagination,
  AdminEmptyState,
  AdminTabs,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminKycQueuePage() {
  const { showToast } = useToast();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<any>({
    pending: 0,
    under_review: 0,
    field_visit: 0,
    approved: 0,
    rejected: 0,
    changes_requested: 0,
    all_count: 0,
  });

  // Quick Action Modal state
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    farmer: any | null;
    decision: 'approve' | 'reject' | 'request_info';
  }>({
    isOpen: false,
    farmer: null,
    decision: 'approve',
  });
  const [selectedTier, setSelectedTier] = useState('tier_1');
  const [actionReason, setActionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    api
      .getKycQueue({
        page,
        limit: 15,
        status: tab,
        search,
        tier: tierFilter !== 'all' ? tierFilter : undefined,
      })
      .then((res) => {
        if (!isMounted) return;
        setFarmers(res.farmers || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalCount(res.pagination?.total || 0);
        if (res.counts) setCounts(res.counts);
      })
      .catch((err) => {
        if (!isMounted) return;
        let msg = 'Failed to load KYC queue';
        if (err && typeof err === 'object' && 'response' in err) {
          const resp = (err as any).response;
          if (resp?.data?.message) msg = resp.data.message;
        }
        showToast(msg, 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, tab, search, tierFilter, showToast, refreshKey]);

  const handleQuickReview = async () => {
    if (!actionModal.farmer) return;
    if (
      (actionModal.decision === 'reject' || actionModal.decision === 'request_info') &&
      !actionReason &&
      !actionNotes
    ) {
      showToast('A reason or note is required for this decision', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.reviewKyc(actionModal.farmer.id, {
        decision: actionModal.decision,
        tier: selectedTier,
        reason: actionReason,
        notes: actionNotes,
      });
      showToast(`Farmer #${actionModal.farmer.id} KYC updated successfully`, 'success');
      setActionModal({ isOpen: false, farmer: null, decision: 'approve' });
      setActionReason('');
      setActionNotes('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to submit review decision', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const tabsList = [
    { id: 'pending', label: 'Pending Review', count: Number(counts.pending) },
    { id: 'under_review', label: 'Under Review', count: Number(counts.under_review) },
    { id: 'field_visit', label: 'Field Visit', count: Number(counts.field_visit) },
    { id: 'changes_requested', label: 'Info Requested', count: Number(counts.changes_requested) },
    { id: 'approved', label: 'Approved Tiers', count: Number(counts.approved) },
    { id: 'rejected', label: 'Rejected', count: Number(counts.rejected) },
    { id: 'all', label: 'All Farmers', count: Number(counts.all_count) },
  ];

  const columns = [
    {
      key: 'farmer',
      header: 'Farmer & Profile',
      render: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.name}</div>
          <div className="text-xs text-gray-500">{row.email} • {row.phone || 'No phone'}</div>
          {row.farm_name && (
            <div className="text-xs font-medium text-[#007a6c] mt-0.5">
              {row.farm_name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Region / Crops',
      render: (row: any) => (
        <div className="text-xs text-gray-600">
          <div className="flex items-center gap-1 font-medium text-gray-800">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            {row.farm_type || 'Unspecified Region'}
          </div>
          <div className="text-gray-500 truncate max-w-xs mt-0.5">{row.bio || '—'}</div>
        </div>
      ),
    },
    {
      key: 'kyc_status',
      header: 'KYC Status',
      render: (row: any) => <AdminStatusPill status={row.kyc_status} />,
    },
    {
      key: 'tier',
      header: 'Accreditation Tier',
      render: (row: any) => (
        <span className="inline-block px-2 py-0.5 text-xs font-semibold uppercase bg-gray-100 text-gray-700 border border-gray-300">
          {row.kyc_tier || 'tier_0'}
        </span>
      ),
    },
    {
      key: 'evidence',
      header: 'Evidence Dossier',
      render: (row: any) => (
        <div className="text-xs text-gray-600 space-y-0.5">
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span className="tabular-nums font-semibold text-gray-800">{row.documents_count}</span> documents
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
            <span className="tabular-nums font-semibold text-gray-800">{row.field_visits_count}</span> field visits
          </div>
        </div>
      ),
    },
    {
      key: 'registered',
      header: 'Submitted Date',
      render: (row: any) => (
        <div className="text-xs text-gray-500 tabular-nums">
          {new Date(row.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={`/admin/kyc/${row.id}`}
            className="px-2.5 py-1 text-xs font-semibold text-[#007a6c] bg-white border border-[#007a6c] hover:bg-teal-50 flex items-center gap-1 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Dossier
          </Link>
          {row.kyc_status !== 'approved' && (
            <button
              onClick={() => {
                setSelectedTier(row.kyc_tier && row.kyc_tier !== 'provisional' ? row.kyc_tier : 'tier_1');
                setActionModal({ isOpen: true, farmer: row, decision: 'approve' });
              }}
              className="p-1 text-emerald-700 hover:bg-emerald-50 border border-emerald-300 transition-colors"
              title="Quick Approve"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {row.kyc_status !== 'rejected' && (
            <button
              onClick={() =>
                setActionModal({ isOpen: true, farmer: row, decision: 'reject' })
              }
              className="p-1 text-rose-700 hover:bg-rose-50 border border-rose-300 transition-colors"
              title="Quick Reject"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#FCF9F8] p-6 space-y-6">
      <AdminPageHeader
        title="Producer KYC & Accreditation Queue"
        subtitle="Review farmer legal documentation, land ownership certificates, and field agent farm audits."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'KYC & Accreditation' },
        ]}
      />

      {/* Tabs */}
      <AdminTabs
        tabs={tabsList}
        activeTab={tab}
        onChange={(newTab) => {
          setTab(newTab);
          setPage(1);
        }}
      />

      {/* Toolbar */}
      <AdminToolbar
        searchPlaceholder="Search farmer by name, email, farm name, or phone..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        filters={[
          {
            key: 'tier',
            label: 'Tier',
            value: tierFilter,
            options: [
              { label: 'All Tiers', value: 'all' },
              { label: 'Tier 0 (Provisional)', value: 'tier_0' },
              { label: 'Tier 1 (Certified)', value: 'tier_1' },
              { label: 'Tier 2 (Cooperative)', value: 'tier_2' },
              { label: 'Tier 3 (Export Grade)', value: 'tier_3' },
            ],
            onChange: (val) => {
              setTierFilter(val);
              setPage(1);
            },
          },
        ]}
      />

      {/* Table & Queue */}
      <div className="bg-white border border-gray-300">
        <AdminTable
          columns={columns}
          data={farmers}
          loading={loading}
          keyExtractor={(row) => String(row.id)}
          emptyMessage="No farmers found in this verification status queue."
        />

        {totalCount > 0 && (
          <AdminPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={15}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Quick Review Modal */}
      <AdminModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, farmer: null, decision: 'approve' })}
        title={
          actionModal.decision === 'approve'
            ? `Approve Farmer #${actionModal.farmer?.id}: ${actionModal.farmer?.name}`
            : actionModal.decision === 'reject'
            ? `Reject Farmer #${actionModal.farmer?.id}: ${actionModal.farmer?.name}`
            : `Request Changes for #${actionModal.farmer?.id}`
        }
        description="This action executes an audited maker-checker state mutation and triggers notifications to the producer."
      >
        <div className="space-y-4 text-sm">
          {actionModal.decision === 'approve' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Accreditation Tier
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
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              {actionModal.decision === 'approve' ? 'Review Summary / Reason' : 'Mandatory Reason Code'}
            </label>
            <input
              type="text"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder={
                actionModal.decision === 'approve'
                  ? 'e.g. Land certificate verified and field visit approved.'
                  : 'e.g. Blurred Kebele ID copy / Invalid title deed'
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Internal Examiner Notes / Instructions for Farmer
            </label>
            <textarea
              rows={3}
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Detailed notes explaining the decision or specifying additional items required..."
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setActionModal({ isOpen: false, farmer: null, decision: 'approve' })}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleQuickReview}
              disabled={submitting}
              className={`px-4 py-2 text-xs font-semibold text-white transition-colors ${
                actionModal.decision === 'approve'
                  ? 'bg-[#1f5400] hover:bg-[#163c00]'
                  : 'bg-rose-700 hover:bg-rose-800'
              } disabled:opacity-50`}
            >
              {submitting ? 'Processing...' : 'Confirm Decision'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  CheckCircle,
  XCircle,
  Pause,
  DollarSign,
  TrendingUp,
  Tag,
  Search,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminStatusPill,
  AdminPagination,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminCampaignsPage() {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Moderation Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    campaign: any | null;
    action: 'approve' | 'reject' | 'pause';
  }>({
    isOpen: false,
    campaign: null,
    action: 'approve',
  });
  const [budgetCap, setBudgetCap] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    api
      .getCampaignsAdmin({
        page,
        limit: 15,
        search,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      .then((res) => {
        if (!isMounted) return;
        setCampaigns(res.campaigns || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalCount(res.pagination?.total || 0);
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast(err?.response?.data?.message || 'Failed to load campaigns', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, search, statusFilter, showToast, refreshKey]);

  const handleModerateSubmit = async () => {
    if (!modalState.campaign) return;
    setSubmitting(true);
    try {
      await api.moderateCampaignAdmin(modalState.campaign.id, {
        action: modalState.action,
        reason: reason || undefined,
        budget_cap: budgetCap ? parseFloat(budgetCap) : undefined,
      });

      showToast(`Campaign ${modalState.action.toUpperCase()} successfully`, 'success');
      setModalState({ isOpen: false, campaign: null, action: 'approve' });
      setReason('');
      setBudgetCap('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to execute campaign action', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'campaign',
      header: 'Marketing Promotion',
      render: (row: any) => (
        <div>
          <div className="font-bold text-gray-900">{row.name}</div>
          <div className="text-xs text-gray-500">
            Producer: <span className="font-semibold">{row.farmer_name}</span> • Code:{' '}
            <span className="font-mono bg-gray-100 px-1 border border-gray-300">{row.voucher_code || 'PROMO'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'discount',
      header: 'Discount Terms',
      render: (row: any) => (
        <div className="text-xs">
          <div className="font-bold text-[#007a6c]">
            {row.discount_type === 'percentage'
              ? `${row.discount_value}% OFF`
              : `ETB ${row.discount_value} OFF`}
          </div>
          <div className="text-gray-500">
            Cap: {row.budget_cap ? `ETB ${Number(row.budget_cap).toLocaleString()}` : 'Uncapped'}
          </div>
        </div>
      ),
    },
    {
      key: 'performance',
      header: 'Performance Metrics',
      render: (row: any) => (
        <div className="text-xs space-y-0.5 tabular-nums">
          <div className="text-gray-700">
            Reach: <span className="font-bold">{row.reach || 0}</span> • Conv:{' '}
            <span className="font-bold">{row.conversion_rate || '0.0%'}</span>
          </div>
          <div className="text-emerald-700 font-semibold">
            Sales: ETB {Number(row.revenue_generated || 0).toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Campaign Status',
      render: (row: any) => <AdminStatusPill status={row.status} />,
    },
    {
      key: 'duration',
      header: 'Schedule',
      render: (row: any) => (
        <div className="text-xs text-gray-500 tabular-nums">
          {row.start_date ? new Date(row.start_date).toLocaleDateString() : 'Immediate'} –{' '}
          {row.end_date ? new Date(row.end_date).toLocaleDateString() : 'Ongoing'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.status !== 'active' && (
            <button
              onClick={() => {
                setBudgetCap(row.budget_cap ? String(row.budget_cap) : '');
                setModalState({ isOpen: true, campaign: row, action: 'approve' });
              }}
              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 flex items-center gap-1"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve
            </button>
          )}
          {row.status === 'active' && (
            <button
              onClick={() => {
                setModalState({ isOpen: true, campaign: row, action: 'pause' });
              }}
              className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-white border border-amber-300 hover:bg-amber-50 flex items-center gap-1"
            >
              <Pause className="w-3.5 h-3.5" />
              Pause
            </button>
          )}
          {row.status !== 'rejected' && (
            <button
              onClick={() => {
                setModalState({ isOpen: true, campaign: row, action: 'reject' });
              }}
              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#FCF9F8] p-6 space-y-6">
      <AdminPageHeader
        title="Promotional Campaigns & Subsidy Governance"
        subtitle="Review farmer marketing campaigns, discount vouchers, subsidies, and set platform budget caps."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Catalog Governance', href: '/admin/products' },
          { label: 'Campaigns' },
        ]}
      />

      <AdminToolbar
        searchPlaceholder="Search campaigns by promotion name, farmer, or voucher code..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { label: 'All Campaigns', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Pending Review', value: 'pending' },
              { label: 'Paused', value: 'paused' },
              { label: 'Rejected', value: 'rejected' },
            ],
            onChange: (val) => {
              setStatusFilter(val);
              setPage(1);
            },
          },
        ]}
      />

      <div className="bg-white border border-gray-300">
        <AdminTable
          columns={columns}
          data={campaigns}
          loading={loading}
          keyExtractor={(row) => String(row.id)}
          emptyMessage="No promotional marketing campaigns recorded."
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

      {/* Campaign Moderation Modal */}
      <AdminModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, campaign: null, action: 'approve' })}
        title={`${modalState.action.toUpperCase()} Campaign: ${modalState.campaign?.name}`}
        description="Configure budget caps or supply an administrative justification."
      >
        <div className="space-y-4 text-sm">
          {modalState.action === 'approve' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Platform Budget Cap (ETB)
              </label>
              <input
                type="number"
                value={budgetCap}
                onChange={(e) => setBudgetCap(e.target.value)}
                placeholder="e.g. 50000.00 (leave blank for unlimited)"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              {modalState.action === 'approve' ? 'Approval Summary' : 'Reason Code *'}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Subsidy within quarterly allocation"
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setModalState({ isOpen: false, campaign: null, action: 'approve' })}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleModerateSubmit}
              disabled={submitting}
              className={`px-4 py-2 text-xs font-semibold text-white ${
                modalState.action === 'approve'
                  ? 'bg-[#1f5400] hover:bg-[#163c00]'
                  : 'bg-rose-700 hover:bg-rose-800'
              } disabled:opacity-50`}
            >
              {submitting ? 'Updating...' : 'Confirm Action'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


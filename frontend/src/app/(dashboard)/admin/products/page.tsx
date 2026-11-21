'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Snowflake,
  Award,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminStatusPill,
  AdminPagination,
  AdminTabs,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminProductsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<any>({
    pending: 0,
    approved: 0,
    rejected: 0,
    changes_requested: 0,
    all_count: 0,
  });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Moderation Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    product: any | null;
    action: 'approve' | 'reject' | 'request_changes' | 'deactivate';
  }>({
    isOpen: false,
    product: null,
    action: 'approve',
  });
  const [grade, setGrade] = useState('Grade A');
  const [coldChainRequired, setColdChainRequired] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bulk Action Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'deactivate'>('approve');
  const [bulkReason, setBulkReason] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    api
      .getProductsAdmin({
        page,
        limit: 15,
        moderation_status: tab !== 'all' ? tab : undefined,
        search,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      })
      .then((res) => {
        if (!isMounted) return;
        setProducts(res.products || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalCount(res.pagination?.total || 0);
        if (res.counts) setCounts(res.counts);
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast(err?.response?.data?.message || 'Failed to load products', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, tab, search, categoryFilter, showToast, refreshKey]);

  useEffect(() => {
    api
      .getCategoriesAdmin()
      .then((res) => setCategories(res.categories || []))
      .catch(() => {});
  }, []);

  const handleModerateSingle = async () => {
    if (!modalState.product) return;
    if (
      (modalState.action === 'reject' || modalState.action === 'request_changes') &&
      !reason &&
      !notes
    ) {
      showToast('A reason or note is required for this action', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.moderateProductAdmin(modalState.product.id, {
        action: modalState.action,
        reason,
        notes,
        grade,
        cold_chain_required: coldChainRequired,
      });

      showToast(`Product #${modalState.product.id} ${modalState.action} successfully`, 'success');
      setModalState({ isOpen: false, product: null, action: 'approve' });
      setReason('');
      setNotes('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Moderation action failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkModerate = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      await api.bulkModerateProducts({
        product_ids: selectedIds,
        action: bulkAction,
        reason: bulkReason || `Bulk ${bulkAction} by admin`,
      });
      showToast(`Updated ${selectedIds.length} products`, 'success');
      setBulkModalOpen(false);
      setSelectedIds([]);
      setBulkReason('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Bulk action failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(products.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const tabsList = [
    { id: 'all', label: 'All Catalog', count: Number(counts.all_count) },
    { id: 'pending', label: 'Pending Moderation', count: Number(counts.pending) },
    { id: 'approved', label: 'Approved & Active', count: Number(counts.approved) },
    { id: 'changes_requested', label: 'Changes Requested', count: Number(counts.changes_requested) },
    { id: 'rejected', label: 'Rejected Listings', count: Number(counts.rejected) },
  ];

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectedIds.length > 0 && selectedIds.length === products.length}
          onChange={toggleSelectAll}
          className="rounded-none border-gray-300"
        />
      ),
      width: '40px',
      render: (row: any) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelectOne(row.id)}
          className="rounded-none border-gray-300"
        />
      ),
    },
    {
      key: 'product',
      header: 'Produce Listing',
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 border border-gray-300 overflow-hidden shrink-0 flex items-center justify-center">
            {row.image_url ? (
              <img src={row.image_url} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <div className="font-bold text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">
              {row.category_name || 'Uncategorized'} • ID #{row.id}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'farmer',
      header: 'Producer / Farm',
      render: (row: any) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-900">{row.farmer_name}</div>
          <div className="text-gray-500">{row.farm_name || 'Smallholder'}</div>
        </div>
      ),
    },
    {
      key: 'pricing_stock',
      header: 'Price & Inventory',
      render: (row: any) => (
        <div className="text-xs">
          <div className="font-bold text-gray-900 tabular-nums">
            ETB {Number(row.price).toFixed(2)}
          </div>
          <div className="text-gray-500 tabular-nums">
            Stock: <span className="font-semibold">{row.stock}</span> units
          </div>
        </div>
      ),
    },
    {
      key: 'attributes',
      header: 'Quality & Handling',
      render: (row: any) => (
        <div className="flex flex-col gap-1 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            {row.grade || 'Grade A'}
          </span>
          {row.cold_chain_required && (
            <span className="inline-flex items-center gap-1 text-[#007a6c] font-semibold">
              <Snowflake className="w-3.5 h-3.5 text-teal-600" />
              Cold Chain
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'moderation_status',
      header: 'Moderation Status',
      render: (row: any) => <AdminStatusPill status={row.moderation_status || 'approved'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={`/admin/products/${row.id}`}
            className="px-2.5 py-1 text-xs font-semibold text-[#007a6c] bg-white border border-[#007a6c] hover:bg-teal-50 flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            Dossier
          </Link>
          {row.moderation_status !== 'approved' && (
            <button
              onClick={() => {
                setGrade(row.grade || 'Grade A');
                setColdChainRequired(Boolean(row.cold_chain_required));
                setModalState({ isOpen: true, product: row, action: 'approve' });
              }}
              className="p-1 text-emerald-700 hover:bg-emerald-50 border border-emerald-300"
              title="Approve Listing"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {row.moderation_status !== 'rejected' && (
            <button
              onClick={() => {
                setModalState({ isOpen: true, product: row, action: 'reject' });
              }}
              className="p-1 text-rose-700 hover:bg-rose-50 border border-rose-300"
              title="Reject Listing"
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
        title="Marketplace Catalog & Quality Governance"
        subtitle="Enforce agricultural grading, anti-gouging pricing benchmarks, cold-chain compliance, and listing approval."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Catalog Governance' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/categories"
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Manage Categories
            </Link>
            <Link
              href="/admin/pricing"
              className="px-3 py-1.5 text-xs font-semibold text-[#007a6c] bg-white border border-[#007a6c] hover:bg-teal-50"
            >
              Price Corridors
            </Link>
          </div>
        }
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
        searchPlaceholder="Search produce by name, description, or farmer..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        filters={[
          {
            key: 'category',
            label: 'Category',
            value: categoryFilter,
            options: [
              { label: 'All Categories', value: 'all' },
              ...categories.map((c) => ({ label: c.name, value: String(c.id) })),
            ],
            onChange: (val) => {
              setCategoryFilter(val);
              setPage(1);
            },
          },
        ]}
        actions={
          selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 bg-teal-50 px-3 py-1 border border-teal-200 text-xs text-[#007a6c] font-semibold">
              <span>{selectedIds.length} items selected</span>
              <button
                onClick={() => {
                  setBulkAction('approve');
                  setBulkModalOpen(true);
                }}
                className="px-2 py-0.5 bg-[#1f5400] text-white hover:bg-[#163c00]"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  setBulkAction('reject');
                  setBulkModalOpen(true);
                }}
                className="px-2 py-0.5 bg-rose-700 text-white hover:bg-rose-800"
              >
                Reject
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Table */}
      <div className="bg-white border border-gray-300">
        <AdminTable
          columns={columns}
          data={products}
          loading={loading}
          keyExtractor={(row) => String(row.id)}
          emptyMessage="No products match the selected criteria."
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

      {/* Single Moderation Modal */}
      <AdminModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, product: null, action: 'approve' })}
        title={
          modalState.action === 'approve'
            ? `Approve Listing #${modalState.product?.id}: ${modalState.product?.name}`
            : modalState.action === 'reject'
            ? `Reject Listing #${modalState.product?.id}: ${modalState.product?.name}`
            : `Request Changes for #${modalState.product?.id}`
        }
        description="All moderation actions update listing visibility and record in product_moderation_actions."
      >
        <div className="space-y-4 text-sm">
          {modalState.action === 'approve' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Quality Grade Certified
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
                >
                  <option value="Grade A">Grade A (Premium Commercial)</option>
                  <option value="Grade B">Grade B (Standard Market)</option>
                  <option value="Export Grade">Export Grade (Phytosanitary Verified)</option>
                  <option value="Organic Certified">Organic Certified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Cold-Chain Transit Required
                </label>
                <select
                  value={coldChainRequired ? 'true' : 'false'}
                  onChange={(e) => setColdChainRequired(e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
                >
                  <option value="false">No (Ambient Transit)</option>
                  <option value="true">Yes (2°C - 6°C Reefer Mandatory)</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              {modalState.action === 'approve' ? 'Moderation Summary' : 'Mandatory Reason Code'}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                modalState.action === 'approve'
                  ? 'e.g. Produce meets grade standards and pricing within corridor.'
                  : 'e.g. Price exceeds corridor ceiling / Low resolution photo'
              }
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
              placeholder="Actionable instructions sent to the producer..."
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setModalState({ isOpen: false, product: null, action: 'approve' })}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleModerateSingle}
              disabled={submitting}
              className={`px-4 py-2 text-xs font-semibold text-white ${
                modalState.action === 'approve'
                  ? 'bg-[#1f5400] hover:bg-[#163c00]'
                  : 'bg-rose-700 hover:bg-rose-800'
              } disabled:opacity-50`}
            >
              {submitting ? 'Processing...' : 'Confirm Moderation'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Bulk Moderation Modal */}
      <AdminModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={`Bulk ${bulkAction.toUpperCase()} (${selectedIds.length} Products)`}
        description="Executes atomic batch moderation across all selected product IDs."
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Bulk Reason Code / Audit Log Note
            </label>
            <input
              type="text"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="e.g. Batch verified against regional quality benchmark"
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setBulkModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkModerate}
              disabled={submitting}
              className={`px-4 py-2 text-xs font-semibold text-white ${
                bulkAction === 'approve' ? 'bg-[#1f5400]' : 'bg-rose-700'
              } disabled:opacity-50`}
            >
              {submitting ? 'Executing Batch...' : 'Confirm Bulk Action'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


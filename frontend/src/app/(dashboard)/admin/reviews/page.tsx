'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Star,
  Eye,
  EyeOff,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminPagination,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminReviewsPage() {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hiddenFilter, setHiddenFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Hide Modal state
  const [hideModal, setHideModal] = useState<{
    isOpen: boolean;
    review: any | null;
  }>({
    isOpen: false,
    review: null,
  });
  const [hideReason, setHideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    api
      .getReviewsAdmin({
        page,
        limit: 15,
        search,
        is_hidden: hiddenFilter !== 'all' ? hiddenFilter === 'hidden' : undefined,
        rating: ratingFilter !== 'all' ? ratingFilter : undefined,
      })
      .then((res) => {
        if (!isMounted) return;
        setReviews(res.reviews || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalCount(res.pagination?.total || 0);
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast(err?.response?.data?.message || 'Failed to load reviews', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, search, hiddenFilter, ratingFilter, showToast, refreshKey]);

  const handleConfirmHide = async () => {
    if (!hideModal.review) return;
    setSubmitting(true);
    try {
      await api.moderateReviewAdmin(hideModal.review.id, {
        is_hidden: true,
        reason: hideReason || 'Inappropriate or abusive feedback',
      });
      showToast('Review hidden from marketplace', 'success');
      setHideModal({ isOpen: false, review: null });
      setHideReason('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to hide review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreReview = async (review: any) => {
    try {
      await api.moderateReviewAdmin(review.id, {
        is_hidden: false,
        reason: 'Restored by admin after verification',
      });
      showToast('Review restored to public store', 'success');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to restore review', 'error');
    }
  };

  const columns = [
    {
      key: 'product',
      header: 'Produce Listing',
      render: (row: any) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gray-100 border border-gray-300 overflow-hidden shrink-0 flex items-center justify-center">
            {row.product_image_url ? (
              <img src={row.product_image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Package className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <div>
            <Link
              href={`/admin/products/${row.product_id}`}
              className="font-bold text-gray-900 hover:text-[#007a6c] transition-colors"
            >
              {row.product_name || `Product #${row.product_id}`}
            </Link>
            <div className="text-xs text-gray-500">Farmer: {row.farmer_name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'reviewer',
      header: 'Customer Reviewer',
      render: (row: any) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-900">{row.reviewer_name || 'Anonymous Buyer'}</div>
          <div className="text-gray-500">{row.reviewer_email}</div>
        </div>
      ),
    },
    {
      key: 'rating_comment',
      header: 'Rating & Feedback Comment',
      render: (row: any) => (
        <div className="text-xs space-y-1 max-w-md">
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${i < row.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
              />
            ))}
            <span className="text-gray-700 font-bold ml-1">{row.rating}.0</span>
          </div>
          <p className="text-gray-800 leading-relaxed italic bg-gray-50 p-2 border border-gray-200">
            "{row.comment}"
          </p>
          {row.hidden_reason && (
            <div className="text-xs text-rose-700 font-semibold">
              Hidden note: {row.hidden_reason}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Moderation Status',
      render: (row: any) => (
        <span
          className={`inline-block px-2 py-0.5 text-xs font-semibold uppercase border ${
            row.is_hidden
              ? 'bg-rose-50 text-rose-800 border-rose-300'
              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
          }`}
        >
          {row.is_hidden ? 'Hidden' : 'Public'}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date Posted',
      render: (row: any) => (
        <span className="text-xs text-gray-500 tabular-nums">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.is_hidden ? (
            <button
              onClick={() => handleRestoreReview(row)}
              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              Restore
            </button>
          ) : (
            <button
              onClick={() => setHideModal({ isOpen: true, review: row })}
              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 flex items-center gap-1"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#FCF9F8] p-6 space-y-6">
      <AdminPageHeader
        title="Customer Reviews & Reputation Moderation"
        subtitle="Protect producer integrity by screening misleading reviews, harassment, and spam."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Catalog Governance', href: '/admin/products' },
          { label: 'Reviews' },
        ]}
      />

      <AdminToolbar
        searchPlaceholder="Search reviews by comment text, buyer name, or produce..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        filters={[
          {
            key: 'status',
            label: 'Visibility',
            value: hiddenFilter,
            options: [
              { label: 'All Reviews', value: 'all' },
              { label: 'Public Only', value: 'visible' },
              { label: 'Hidden Only', value: 'hidden' },
            ],
            onChange: (val) => {
              setHiddenFilter(val);
              setPage(1);
            },
          },
          {
            key: 'rating',
            label: 'Rating',
            value: ratingFilter,
            options: [
              { label: 'All Ratings', value: 'all' },
              { label: '5 Stars', value: '5' },
              { label: '4 Stars', value: '4' },
              { label: '3 Stars', value: '3' },
              { label: '2 Stars', value: '2' },
              { label: '1 Star', value: '1' },
            ],
            onChange: (val) => {
              setRatingFilter(val);
              setPage(1);
            },
          },
        ]}
      />

      <div className="bg-white border border-gray-300">
        <AdminTable
          columns={columns}
          data={reviews}
          loading={loading}
          keyExtractor={(row) => String(row.id)}
          emptyMessage="No customer reviews found matching criteria."
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

      {/* Hide Modal */}
      <AdminModal
        isOpen={hideModal.isOpen}
        onClose={() => setHideModal({ isOpen: false, review: null })}
        title={`Hide Review #${hideModal.review?.id}`}
        description="Hidden reviews are suppressed from the public buyer store and produce score calculations."
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Reason for Hiding Review *
            </label>
            <input
              type="text"
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value)}
              placeholder="e.g. Unverified claim / Vulgar language / Competitor sabotage"
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setHideModal({ isOpen: false, review: null })}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmHide}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50"
            >
              {submitting ? 'Hiding...' : 'Confirm Hide'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface ReturnItem {
  product_id?: number;
  product_name: string;
  quantity: number;
  price: number;
  unit?: string;
  image_url?: string;
}

interface ReturnRequest {
  id: number;
  order_id: number;
  buyer_id: number;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  refund_status: 'none' | 'pending' | 'issued';
  restock_quantity: number;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
  buyer_name: string;
  buyer_phone?: string;
  buyer_email?: string;
  order_total?: number | string;
  items?: ReturnItem[];
}

export default function ReturnsManagementPage() {
  const { showSuccess, showError } = useToast();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReturns, setTotalReturns] = useState(0);

  // Active Dispute Resolution Modal
  const [activeReturnModal, setActiveReturnModal] = useState<ReturnRequest | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'accept' | 'reject'>('accept');
  const [resolutionNote, setResolutionNote] = useState('');
  const [shouldRestock, setShouldRestock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReturns = async () => {
    try {
      setLoading(true);
      const res = await api.getReturns({
        page,
        limit: 10,
        status: activeTab === 'all' ? undefined : activeTab,
        search: searchQuery.trim() || undefined,
      });

      setReturns(res.returns || []);
      setTotalPages(res.pagination?.total_pages || 1);
      setTotalReturns(res.pagination?.total || 0);
    } catch (err: any) {
      console.error('Failed to load returns:', err);
      showError('Failed to load return requests.');
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, [page, activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadReturns();
  };

  const handleOpenResolveModal = (ret: ReturnRequest, initialAction: 'accept' | 'reject') => {
    setActiveReturnModal(ret);
    setResolutionAction(initialAction);
    setResolutionNote('');
    setShouldRestock(true);
  };

  const handleSubmitResolution = async () => {
    if (!activeReturnModal) return;

    if (resolutionAction === 'reject' && !resolutionNote.trim()) {
      showError('Please provide a reason when rejecting a return claim.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.updateReturn(activeReturnModal.id, resolutionAction, {
        resolution_note: resolutionNote.trim(),
        restock: resolutionAction === 'accept' ? shouldRestock : false,
      });

      showSuccess(
        resolutionAction === 'accept'
          ? 'Return accepted. Order marked returned and inventory restocked.'
          : 'Return request rejected.'
      );

      setActiveReturnModal(null);
      loadReturns();
    } catch (err: any) {
      console.error('Failed to resolve return:', err);
      showError(err.message || 'Failed to resolve return request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500 text-2xl">assignment_return</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Returns & Quality Disputes</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review customer freshness complaints, manage return requests, and handle inventory restocking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/farmer/orders"
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            Orders Center
          </Link>
          <Link
            href="/farmer/shipping"
            className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">local_shipping</span>
            Logistics Hub
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-gray-900 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">all_inbox</span>
          All Disputes
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('pending');
            setPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">pending_actions</span>
          Pending Action
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('accepted');
            setPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'accepted'
              ? 'bg-[#16a34a] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">check_circle</span>
          Accepted / Restocked
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('rejected');
            setPage(1);
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'rejected'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">cancel</span>
          Rejected Claims
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="bg-white p-4 rounded-2xl border border-gray-100 flex gap-3 items-center">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID, Buyer Name, Email, or Issue Reason..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50/80 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] transition-all"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          Search
        </button>

        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setPage(1);
              loadReturns();
            }}
            className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </form>

      {/* Returns Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading Quality Disputes...</p>
        </div>
      ) : returns.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 p-8">
          <div className="w-14 h-14 bg-orange-50 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl">task_alt</span>
          </div>
          <h3 className="text-base font-bold text-gray-800">No Return Claims</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
            {activeTab === 'pending'
              ? 'Awesome! You have zero unresolved return disputes or product claims.'
              : 'No return records found matching your filters.'}
          </p>
          <Link
            href="/farmer/orders"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#16a34a] text-white text-xs font-bold rounded-xl hover:bg-[#15803d] transition-colors"
          >
            View Active Orders
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">Return ID / Order</th>
                  <th className="p-4">Harvest Produce</th>
                  <th className="p-4">Customer Claim & Reason</th>
                  <th className="p-4">Buyer Contact</th>
                  <th className="p-4">Dispute Status</th>
                  <th className="p-4">Refund Status</th>
                  <th className="p-4 text-right">Farmer Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returns.map((ret) => {
                  const firstItem = ret.items && ret.items[0] ? ret.items[0] : null;

                  return (
                    <tr key={ret.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-4">
                        <span className="font-mono font-bold text-gray-900">RET-#{ret.id}</span>
                        <p className="text-[11px] text-gray-500 mt-0.5">Order Ref: #GH-{ret.order_id}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(ret.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {firstItem?.image_url ? (
                            <img
                              src={firstItem.image_url}
                              alt={firstItem.product_name}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-lg">spa</span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-gray-800 line-clamp-1">{firstItem?.product_name || 'Farm Produce'}</p>
                            <p className="text-[11px] text-gray-500">
                              {firstItem?.quantity} {firstItem?.unit || 'kg'} • ETB{' '}
                              {(Number(firstItem?.price || 0) * Number(firstItem?.quantity || 1)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 max-w-[260px]">
                        <div className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-orange-500 text-sm mt-0.5 shrink-0">
                            report_problem
                          </span>
                          <div>
                            <p className="text-gray-800 font-medium line-clamp-2 leading-relaxed">{ret.reason}</p>
                            {ret.resolution_note && (
                              <p className="text-[10px] text-gray-500 mt-1 italic">
                                Note: &ldquo;{ret.resolution_note}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-gray-800">{ret.buyer_name}</p>
                        {ret.buyer_phone && (
                          <a
                            href={`tel:${ret.buyer_phone}`}
                            className="text-[11px] text-[#16a34a] hover:underline font-mono block mt-0.5"
                          >
                            {ret.buyer_phone}
                          </a>
                        )}
                        {ret.buyer_email && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{ret.buyer_email}</p>
                        )}
                      </td>

                      <td className="p-4">
                        {ret.status === 'pending' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Pending Review
                          </span>
                        )}
                        {ret.status === 'accepted' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Accepted & Restocked
                          </span>
                        )}
                        {ret.status === 'rejected' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                            Claim Rejected
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        {ret.refund_status === 'none' && (
                          <span className="text-[11px] text-gray-400 font-medium">No Refund</span>
                        )}
                        {ret.refund_status === 'pending' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            Refund Pending
                          </span>
                        )}
                        {ret.refund_status === 'issued' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                            Refund Issued
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        {ret.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenResolveModal(ret, 'accept')}
                              className="px-2.5 py-1.5 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold transition-all shadow-2xs"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenResolveModal(ret, 'reject')}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReturnModal(ret);
                              setResolutionAction(ret.status as 'accept' | 'reject');
                              setResolutionNote(ret.resolution_note || '');
                            }}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                          >
                            View Resolution
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Page {page} of {totalPages} ({totalReturns} total return claims)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DISPUTE RESOLUTION MODAL */}
      {activeReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    activeReturnModal.status === 'pending'
                      ? resolutionAction === 'accept'
                        ? 'bg-green-50 text-[#16a34a]'
                        : 'bg-red-50 text-red-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {resolutionAction === 'accept' ? 'check_circle' : 'gavel'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    Dispute RET-#{activeReturnModal.id} • Order #GH-{activeReturnModal.order_id}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Filed by {activeReturnModal.buyer_name} on{' '}
                    {new Date(activeReturnModal.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReturnModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 text-xs">
              {/* Customer Reason Card */}
              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
                <span className="font-bold text-amber-900 block mb-1">Customer Claim Reason:</span>
                <p className="text-gray-700 leading-relaxed">&ldquo;{activeReturnModal.reason}&rdquo;</p>
              </div>

              {/* Items in the return */}
              <div>
                <span className="font-bold text-gray-700 block mb-2">Affected Harvest Items:</span>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {activeReturnModal.items?.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200/60"
                    >
                      <div className="flex items-center gap-2">
                        {it.image_url ? (
                          <img
                            src={it.image_url}
                            alt={it.product_name}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-gray-400">eco</span>
                        )}
                        <div>
                          <p className="font-bold text-gray-800">{it.product_name}</p>
                          <p className="text-[10px] text-gray-500">
                            {it.quantity} {it.unit || 'kg'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-gray-800">
                        ETB {(Number(it.price) * Number(it.quantity)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Switcher if still pending */}
              {activeReturnModal.status === 'pending' ? (
                <>
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block font-bold text-gray-700 mb-2">Select Resolution Decision:</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setResolutionAction('accept')}
                        className={`p-3 rounded-xl border text-center font-bold transition-all ${
                          resolutionAction === 'accept'
                            ? 'border-[#16a34a] bg-green-50 text-[#16a34a]'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        Accept & Refund
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolutionAction('reject')}
                        className={`p-3 rounded-xl border text-center font-bold transition-all ${
                          resolutionAction === 'reject'
                            ? 'border-red-500 bg-red-50 text-red-600'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        Reject Claim
                      </button>
                    </div>
                  </div>

                  {resolutionAction === 'accept' && (
                    <label className="flex items-center gap-2.5 cursor-pointer bg-green-50/50 p-2.5 rounded-xl border border-green-100">
                      <input
                        type="checkbox"
                        checked={shouldRestock}
                        onChange={(e) => setShouldRestock(e.target.checked)}
                        className="rounded border-gray-300 text-[#16a34a] focus:ring-[#16a34a]"
                      />
                      <span className="text-[11px] text-gray-700 font-medium">
                        Automatically restock this harvest quantity back into live available inventory
                      </span>
                    </label>
                  )}

                  <div>
                    <label className="block font-bold text-gray-700 mb-1.5">
                      {resolutionAction === 'accept'
                        ? 'Resolution Notes for Buyer (Optional):'
                        : 'Rejection Reason / Explanation (Required):'}
                    </label>
                    <textarea
                      rows={3}
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder={
                        resolutionAction === 'accept'
                          ? 'e.g., We apologize for transit bruising. We have authorized a prompt refund.'
                          : 'e.g., Produce was inspected fresh and received past the 24h complaint window.'
                      }
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                    />
                  </div>
                </>
              ) : (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="font-bold text-gray-700 block mb-1">Recorded Farmer Resolution:</span>
                  <p className="text-gray-800">{activeReturnModal.resolution_note || 'Resolved without extra notes.'}</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setActiveReturnModal(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50"
              >
                Close
              </button>

              {activeReturnModal.status === 'pending' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitResolution}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 ${
                    resolutionAction === 'accept'
                      ? 'bg-[#16a34a] hover:bg-[#15803d]'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isSubmitting
                    ? 'Submitting...'
                    : resolutionAction === 'accept'
                    ? 'Confirm Acceptance'
                    : 'Confirm Rejection'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

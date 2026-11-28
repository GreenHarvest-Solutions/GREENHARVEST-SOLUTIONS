'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface SubstitutionItem {
  id: number;
  order_id: number;
  order_number?: string;
  suborder_id: number;
  suborder_number?: string;
  original_product_id: number;
  original_product_name?: string;
  original_unit?: string;
  original_branch_id?: number;
  original_branch_name?: string;
  substitution_type: string;
  proposed_branch_id?: number;
  proposed_branch_name?: string;
  proposed_product_id?: number;
  proposed_product_name?: string;
  proposed_unit?: string;
  proposed_quantity?: number;
  price_delta: number;
  delivery_fee_delta: number;
  reason?: string;
  status: 'proposed' | 'approved' | 'rejected';
  created_at: string;
  responded_at?: string;
  farmer_name?: string;
}

const typeLabels: Record<string, string> = {
  other_branch: 'Fulfill From Another Branch',
  alternative_product: 'Alternative Product',
  partial_quantity: 'Adjusted Quantity',
  cancel_item: 'Cancel Unavailable Item',
};

export default function BuyerSubstitutionsPage() {
  const { showSuccess, showError } = useToast();
  const [substitutions, setSubstitutions] = useState<SubstitutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'proposed' | 'approved' | 'rejected'>('proposed');

  const fetchSubstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMySubstitutions();
      setSubstitutions(res.substitutions || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load substitution proposals';
      showError(msg);
      setSubstitutions([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchSubstitutions();
  }, [fetchSubstitutions]);

  const handleRespond = async (substitutionId: number, decision: 'approve' | 'reject') => {
    setResponding(substitutionId);
    try {
      await api.respondSubstitution(substitutionId, { decision });
      showSuccess(
        decision === 'approve'
          ? 'Substitution approved — your order fulfillment has been updated.'
          : 'Substitution rejected. The farmer has been notified.'
      );
      setSubstitutions((prev) =>
        prev.map((s) =>
          s.id === substitutionId
            ? {
                ...s,
                status: decision === 'approve' ? 'approved' : 'rejected',
                responded_at: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to respond to substitution';
      showError(msg);
    } finally {
      setResponding(null);
    }
  };

  const filtered = substitutions.filter((s) => filter === 'all' || s.status === filter);
  const pendingCount = substitutions.filter((s) => s.status === 'proposed').length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-icons text-amber-500">swap_horiz</span>
            Product & Branch Substitutions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review farmer-proposed product replacements, branch reallocations, or quantity adjustments before any financial change is applied.
          </p>
        </div>

        <div className="flex gap-1 mb-5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {([
            { key: 'proposed', label: 'Pending' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'all', label: 'All' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                filter === tab.key
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              {tab.key === 'proposed' && pendingCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <span className="material-icons animate-spin text-green-500 text-3xl">refresh</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
            <span className="material-icons text-gray-300 text-5xl block mb-3">check_circle</span>
            <p className="text-gray-500 font-medium">
              {filter === 'proposed' ? 'No pending substitution proposals' : `No ${filter} substitutions`}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {filter === 'proposed'
                ? 'All your active orders are proceeding as originally placed.'
                : 'Nothing to show here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((sub) => {
              const isPending = sub.status === 'proposed';
              const totalDelta = Number(sub.price_delta || 0) + Number(sub.delivery_fee_delta || 0);
              return (
                <div
                  key={sub.id}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                    isPending ? 'border-amber-300' : sub.status === 'approved' ? 'border-green-200' : 'border-red-200'
                  }`}
                >
                  <div
                    className={`px-4 py-2 flex items-center justify-between text-xs font-medium ${
                      isPending
                        ? 'bg-amber-50 text-amber-700'
                        : sub.status === 'approved'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-icons text-xs">
                        {isPending ? 'pending' : sub.status === 'approved' ? 'check_circle' : 'cancel'}
                      </span>
                      {isPending ? 'Awaiting Your Approval' : sub.status === 'approved' ? 'Approved' : 'Rejected'}
                      <span className="ml-2 px-2 py-0.5 rounded bg-white/70 text-gray-700">
                        {typeLabels[sub.substitution_type] || sub.substitution_type}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      {sub.suborder_number || `Suborder #${sub.suborder_id}`}
                      {sub.farmer_name && ` · ${sub.farmer_name}`}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 font-medium mb-1">Original</p>
                        <p className="font-semibold text-gray-800 text-sm">
                          {sub.original_product_name || `Product #${sub.original_product_id}`}
                        </p>
                        {sub.original_branch_name && (
                          <p className="text-xs text-gray-500 mt-0.5">Branch: {sub.original_branch_name}</p>
                        )}
                      </div>

                      <div className="text-gray-400">
                        <span className="material-icons text-2xl">arrow_forward</span>
                      </div>

                      <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs text-green-600 font-medium mb-1">Proposed Change</p>
                        <p className="font-semibold text-gray-800 text-sm">
                          {sub.substitution_type === 'cancel_item'
                            ? 'Cancel Item & Refund'
                            : sub.proposed_product_name ||
                              sub.original_product_name ||
                              `Product #${sub.proposed_product_id || sub.original_product_id}`}
                        </p>
                        {sub.proposed_branch_name && (
                          <p className="text-xs text-green-700 mt-0.5">New Branch: {sub.proposed_branch_name}</p>
                        )}
                        {sub.proposed_quantity !== null && sub.proposed_quantity !== undefined && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            Quantity: {sub.proposed_quantity} {sub.proposed_unit || sub.original_unit || 'units'}
                          </p>
                        )}
                      </div>
                    </div>

                    {(Number(sub.price_delta) !== 0 || Number(sub.delivery_fee_delta) !== 0) && (
                      <div
                        className={`mt-3 flex flex-wrap items-center gap-4 text-xs px-3 py-2 rounded-lg ${
                          totalDelta > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {Number(sub.price_delta) !== 0 && (
                          <span>
                            Product Price Delta: <strong>{Number(sub.price_delta) > 0 ? '+' : ''}{Number(sub.price_delta).toLocaleString()} ETB</strong>
                          </span>
                        )}
                        {Number(sub.delivery_fee_delta) !== 0 && (
                          <span>
                            Delivery Fee Delta: <strong>{Number(sub.delivery_fee_delta) > 0 ? '+' : ''}{Number(sub.delivery_fee_delta).toLocaleString()} ETB</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {sub.reason && (
                      <div className="mt-3 p-2.5 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                        <span className="material-icons text-xs text-blue-400 mt-0.5">info</span>
                        <div>
                          <span className="font-medium">Reason: </span>
                          {sub.reason}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-400 flex gap-3">
                      <span>Proposed: {new Date(sub.created_at).toLocaleDateString()}</span>
                      {sub.responded_at && <span>Responded: {new Date(sub.responded_at).toLocaleDateString()}</span>}
                    </div>

                    {isPending && (
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => handleRespond(sub.id, 'approve')}
                          disabled={responding === sub.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 text-sm font-medium"
                        >
                          {responding === sub.id ? (
                            <span className="material-icons animate-spin text-sm">refresh</span>
                          ) : (
                            <span className="material-icons text-sm">check</span>
                          )}
                          Approve Proposal
                        </button>
                        <button
                          onClick={() => handleRespond(sub.id, 'reject')}
                          disabled={responding === sub.id}
                          className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-60 text-sm font-medium"
                        >
                          <span className="material-icons text-sm">close</span>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

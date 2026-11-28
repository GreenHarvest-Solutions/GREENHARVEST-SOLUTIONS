'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface SubstitutionItem {
  id: number;
  suborder_id: number;
  suborder_number?: string;
  original_product_id: number;
  original_product_name: string;
  original_quantity: number;
  original_unit_price: number;
  substitute_product_id: number;
  substitute_product_name: string;
  substitute_quantity: number;
  substitute_unit_price: number;
  substitution_reason: string;
  price_difference: number;
  buyer_response: 'pending' | 'accepted' | 'rejected';
  proposed_by: string;
  proposed_at: string;
  responded_at?: string;
  farmer_name?: string;
  image_url?: string;
  substitute_image_url?: string;
}

const reasonLabels: Record<string, string> = {
  out_of_stock: 'Out of Stock',
  quality_concern: 'Quality Concern',
  size_unavailable: 'Size Unavailable',
  seasonal_replacement: 'Seasonal Replacement',
  other: 'Other Reason',
};

export default function BuyerSubstitutionsPage() {
  const { showSuccess, showError } = useToast();
  const [substitutions, setSubstitutions] = useState<SubstitutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');

  const fetchSubstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (api as unknown as { getMySubstitutions: () => Promise<{ substitutions: SubstitutionItem[] }> }).getMySubstitutions();
      setSubstitutions(res.substitutions || []);
    } catch {
      // If endpoint not ready yet, show demo state
      setSubstitutions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubstitutions();
  }, [fetchSubstitutions]);

  const handleRespond = async (substitutionId: number, response: 'accepted' | 'rejected') => {
    setResponding(substitutionId);
    try {
      await (api as unknown as { respondSubstitution: (id: number, data: { response: string }) => Promise<unknown> })
        .respondSubstitution(substitutionId, { response });
      showSuccess(response === 'accepted' ? 'Substitution accepted — order will proceed.' : 'Substitution rejected. The farmer will be notified.');
      setSubstitutions((prev) =>
        prev.map((s) =>
          s.id === substitutionId
            ? { ...s, buyer_response: response, responded_at: new Date().toISOString() }
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

  const filtered = substitutions.filter((s) => filter === 'all' || s.buyer_response === filter);

  const priceDiff = (s: SubstitutionItem) => {
    const diff = s.substitute_quantity * s.substitute_unit_price - s.original_quantity * s.original_unit_price;
    return diff;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-icons text-amber-500">swap_horiz</span>
            Product Substitutions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Farmers sometimes substitute products that are out of stock or unavailable. Review and respond here.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {(['pending', 'accepted', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition capitalize ${
                filter === tab
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'pending' && substitutions.filter(s => s.buyer_response === 'pending').length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {substitutions.filter(s => s.buyer_response === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <span className="material-icons animate-spin text-green-500 text-3xl">refresh</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
            <span className="material-icons text-gray-300 text-5xl block mb-3">check_circle</span>
            <p className="text-gray-500 font-medium">
              {filter === 'pending' ? 'No pending substitutions' : `No ${filter} substitutions`}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {filter === 'pending'
                ? 'All your orders are using the originally requested products.'
                : 'Nothing to show here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((sub) => {
              const diff = priceDiff(sub);
              const isPending = sub.buyer_response === 'pending';
              return (
                <div
                  key={sub.id}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                    isPending ? 'border-amber-300' : sub.buyer_response === 'accepted' ? 'border-green-200' : 'border-red-200'
                  }`}
                >
                  {/* Status bar */}
                  <div className={`px-4 py-2 flex items-center justify-between text-xs font-medium ${
                    isPending ? 'bg-amber-50 text-amber-700' :
                    sub.buyer_response === 'accepted' ? 'bg-green-50 text-green-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    <span className="flex items-center gap-1">
                      <span className="material-icons text-xs">
                        {isPending ? 'pending' : sub.buyer_response === 'accepted' ? 'check_circle' : 'cancel'}
                      </span>
                      {isPending ? 'Awaiting Your Response' :
                       sub.buyer_response === 'accepted' ? 'Accepted' : 'Rejected'}
                    </span>
                    <span className="text-gray-400">
                      Suborder: {sub.suborder_number || `#${sub.suborder_id}`}
                      {sub.farmer_name && ` · ${sub.farmer_name}`}
                    </span>
                  </div>

                  <div className="p-4">
                    {/* Comparison */}
                    <div className="flex items-center gap-3">
                      {/* Original */}
                      <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                          <span className="material-icons text-xs text-gray-400">remove_circle_outline</span>
                          Original Item
                        </p>
                        <p className="font-semibold text-gray-800 text-sm">{sub.original_product_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {sub.original_quantity} units × {sub.original_unit_price.toLocaleString()} ETB
                        </p>
                        <p className="text-sm font-bold text-gray-700 mt-1">
                          = {(sub.original_quantity * sub.original_unit_price).toLocaleString()} ETB
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="text-gray-400">
                        <span className="material-icons text-2xl">arrow_forward</span>
                      </div>

                      {/* Substitute */}
                      <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs text-green-600 font-medium mb-1 flex items-center gap-1">
                          <span className="material-icons text-xs text-green-500">add_circle_outline</span>
                          Proposed Substitute
                        </p>
                        <p className="font-semibold text-gray-800 text-sm">{sub.substitute_product_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {sub.substitute_quantity} units × {sub.substitute_unit_price.toLocaleString()} ETB
                        </p>
                        <p className="text-sm font-bold text-gray-700 mt-1">
                          = {(sub.substitute_quantity * sub.substitute_unit_price).toLocaleString()} ETB
                        </p>
                      </div>
                    </div>

                    {/* Price difference */}
                    {diff !== 0 && (
                      <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
                        diff > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                      }`}>
                        <span className="material-icons text-sm">
                          {diff > 0 ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                        <span>
                          {diff > 0
                            ? `Price increases by ${diff.toLocaleString()} ETB`
                            : `Price decreases by ${Math.abs(diff).toLocaleString()} ETB`}
                        </span>
                      </div>
                    )}

                    {/* Reason */}
                    <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                      <span className="material-icons text-xs text-blue-400 mt-0.5">info</span>
                      <div>
                        <span className="font-medium">Reason: </span>
                        {reasonLabels[sub.substitution_reason] || sub.substitution_reason}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="mt-2 text-xs text-gray-400 flex gap-3">
                      <span>Proposed: {new Date(sub.proposed_at).toLocaleDateString()}</span>
                      {sub.responded_at && (
                        <span>Responded: {new Date(sub.responded_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {/* Action buttons */}
                    {isPending && (
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => handleRespond(sub.id, 'accepted')}
                          disabled={responding === sub.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 text-sm font-medium"
                        >
                          {responding === sub.id ? (
                            <span className="material-icons animate-spin text-sm">refresh</span>
                          ) : (
                            <span className="material-icons text-sm">check</span>
                          )}
                          Accept Substitute
                        </button>
                        <button
                          onClick={() => handleRespond(sub.id, 'rejected')}
                          disabled={responding === sub.id}
                          className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-60 text-sm font-medium"
                        >
                          <span className="material-icons text-sm">close</span>
                          Reject — Cancel Item
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

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

export default function AdminBranchesVerificationPage() {
  const { showSuccess, showError } = useToast();
  const [branches, setBranches] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadBranches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.adminListBranches({ verification_status: filter, search });
      setBranches(res.branches || []);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load branch verification queue');
    } finally {
      setLoading(false);
    }
  }, [filter, search, showError]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleDecision = async (branchId: number, verification_status: string) => {
    const decision_notes =
      verification_status === 'verified'
        ? 'Verified by Admin Logistics Operations'
        : window.prompt(`Enter audit notes for marking branch "${verification_status}":`) || `Status changed to ${verification_status}`;
    try {
      const res = await api.adminVerifyBranch(branchId, { verification_status, decision_notes });
      showSuccess(
        `Branch marked "${verification_status}".${res.impacted_exceptions_created ? ` ${res.impacted_exceptions_created} active suborder exception(s) flagged.` : ''}`
      );
      loadBranches();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Branch review failed');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Farmer Fulfillment Branch KYC &amp; Vetting</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Verify physical farms, warehouses, and collection centers before allowing live marketplace fulfillment.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branch or farmer..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-xs"
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white">
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted Queue</option>
            <option value="under_review">Under Review</option>
            <option value="verified">Verified</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
            <tr>
              <th className="p-3.5">Branch / Code</th>
              <th className="p-3.5">Farmer Owner</th>
              <th className="p-3.5">Location &amp; Region</th>
              <th className="p-3.5">Capacity &amp; Stock</th>
              <th className="p-3.5">Verification</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {branches.map((b) => (
              <tr key={b.id}>
                <td className="p-3.5">
                  <p className="font-bold text-gray-900">{b.name}</p>
                  <p className="font-mono text-[10px] text-gray-500">{b.branch_code} · {b.branch_type}</p>
                </td>
                <td className="p-3.5">
                  <p className="font-semibold text-gray-800">{b.farmer_name}</p>
                  <p className="text-[11px] text-gray-500">{b.farmer_email}</p>
                </td>
                <td className="p-3.5 text-gray-700">{b.physical_address} ({b.region || 'Ethiopia'})</td>
                <td className="p-3.5 tabular-nums">
                  {b.stocked_products || 0} SKUs · {b.total_orders || 0} orders
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[10px] bg-gray-100 text-gray-800">
                    {b.verification_status}
                  </span>
                </td>
                <td className="p-3.5 text-right space-x-1.5">
                  {b.verification_status !== 'verified' && (
                    <button onClick={() => handleDecision(b.id, 'verified')} className="px-2.5 py-1 bg-[#286c00] text-white font-bold rounded cursor-pointer">
                      Verify
                    </button>
                  )}
                  {b.verification_status === 'verified' && (
                    <button onClick={() => handleDecision(b.id, 'suspended')} className="px-2.5 py-1 bg-red-600 text-white font-bold rounded cursor-pointer">
                      Suspend
                    </button>
                  )}
                  {['submitted', 'under_review'].includes(b.verification_status) && (
                    <button onClick={() => handleDecision(b.id, 'rejected')} className="px-2.5 py-1 border border-red-300 text-red-700 font-bold rounded cursor-pointer">
                      Reject
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && branches.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">No branches match the filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

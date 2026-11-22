'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Search,
  SlidersHorizontal,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Eye,
  FileCheck2,
  Lock,
  RotateCcw,
  UserX,
  Package,
  Truck,
  User,
  ShoppingBag,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminTable,
  AdminTableColumn,
  AdminPagination,
  AdminTabs,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminRiskPage() {
  const { showToast } = useToast();
  const [flags, setFlags] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    total_flags: 0,
    open_flags: 0,
    critical_flags: 0,
    under_investigation: 0,
    resolved_safe: 0,
    confirmed_fraud: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Resolution Modal State
  const [resolveModal, setResolveModal] = useState<{
    isOpen: boolean;
    flag: any | null;
    status: string;
    resolutionNotes: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    flag: null,
    status: 'resolved_safe',
    resolutionNotes: '',
    isSubmitting: false,
  });

  // Rules Modal State
  const [rulesModal, setRulesModal] = useState<{
    isOpen: boolean;
    rules: any[];
    loading: boolean;
  }>({
    isOpen: false,
    rules: [],
    loading: false,
  });

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminRiskFlags({
        status: statusTab === 'all' ? undefined : statusTab,
        severity: severityFilter === 'all' ? undefined : severityFilter,
        entity_type: entityFilter === 'all' ? undefined : entityFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setFlags(res.flags || []);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch risk flags', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusTab, severityFilter, entityFilter, search, page, showToast]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleOpenRules = async () => {
    setRulesModal({ isOpen: true, rules: [], loading: true });
    try {
      const res = await api.getAdminRiskRules();
      setRulesModal({ isOpen: true, rules: res.rules || [], loading: false });
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch risk rules', 'error');
      setRulesModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolveModal.flag) return;
    if (!resolveModal.resolutionNotes.trim()) {
      showToast('Investigation findings and resolution notes are required', 'error');
      return;
    }

    setResolveModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.resolveAdminRiskFlag(resolveModal.flag.id, {
        status: resolveModal.status,
        resolution_notes: resolveModal.resolutionNotes.trim(),
      });

      showToast(res.message || 'Risk flag resolved and audited successfully', 'success');
      setResolveModal({
        isOpen: false,
        flag: null,
        status: 'resolved_safe',
        resolutionNotes: '',
        isSubmitting: false,
      });
      fetchFlags();
    } catch (err: any) {
      showToast(err.message || 'Failed to resolve risk flag', 'error');
      setResolveModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const getSeverityBadge = (severity: string) => {
    const s = (severity || '').toLowerCase();
    if (s === 'critical') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-red-50 text-red-800 border border-red-300 rounded-none uppercase tracking-wider">
          Critical
        </span>
      );
    }
    if (s === 'high') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 rounded-none uppercase tracking-wider">
          High
        </span>
      );
    }
    if (s === 'medium') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded-none uppercase tracking-wider">
          Medium
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 rounded-none uppercase tracking-wider">
        Low
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'flagged') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-red-50 text-red-800 border border-red-300 rounded-none">
          Flagged
        </span>
      );
    }
    if (s === 'under_investigation') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 rounded-none">
          Investigating
        </span>
      );
    }
    if (s === 'resolved_safe') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-none">
          ✓ Resolved Safe
        </span>
      );
    }
    if (s === 'confirmed_fraud' || s === 'action_taken') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-purple-50 text-purple-800 border border-purple-300 rounded-none">
          Action Taken
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 rounded-none">
        {status}
      </span>
    );
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Package className="w-3.5 h-3.5 text-gray-500" />;
      case 'product':
        return <ShoppingBag className="w-3.5 h-3.5 text-gray-500" />;
      case 'carrier':
        return <Truck className="w-3.5 h-3.5 text-gray-500" />;
      case 'user':
      default:
        return <User className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const columns: AdminTableColumn<any>[] = [
    {
      header: 'Flag ID & Time',
      render: (f: any) => (
        <div>
          <span className="font-mono text-xs font-bold text-gray-900 tabular-nums">
            #RSK-{f.id}
          </span>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>
              {f.created_at
                ? new Date(f.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Severity',
      render: (f: any) => getSeverityBadge(f.severity),
    },
    {
      header: 'Target Entity',
      render: (f: any) => (
        <div>
          <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs">
            {getEntityIcon(f.entity_type)}
            <span className="font-mono uppercase">{f.entity_type}:</span>
            <span className="font-mono">{f.entity_id}</span>
          </div>
          {f.entity_type === 'order' && (
            <Link
              href={`/admin/orders/${f.entity_id.replace('ORD-', '')}`}
              className="text-[#1f5400] text-[11px] font-bold hover:underline flex items-center gap-0.5 mt-0.5"
            >
              <span>View Order</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          )}
          {f.entity_type === 'carrier' && (
            <Link
              href={`/admin/deliveries?search=${f.entity_id}`}
              className="text-[#1f5400] text-[11px] font-bold hover:underline flex items-center gap-0.5 mt-0.5"
            >
              <span>View Fleet Unit</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          )}
        </div>
      ),
    },
    {
      header: 'Heuristic Rule Triggered',
      render: (f: any) => (
        <div>
          <span className="font-semibold text-gray-900 text-xs block">{f.rule_name || 'System Heuristic'}</span>
          <span className="font-mono text-[10px] text-gray-500 uppercase bg-gray-100 px-1 py-0.2">
            {f.rule_type || 'heuristic'}
          </span>
        </div>
      ),
    },
    {
      header: 'Flag Reason & Evidence',
      className: 'max-w-xs',
      render: (f: any) => (
        <div>
          <p className="text-xs text-gray-900 line-clamp-2">{f.flag_reason}</p>
          {f.resolution_notes && (
            <div className="mt-1 pt-1 border-t border-gray-100 text-[11px] text-emerald-800">
              <span className="font-bold">Resolution: </span>
              {f.resolution_notes}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      render: (f: any) => getStatusBadge(f.status),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (f: any) => {
        const isResolved = f.status === 'resolved_safe' || f.status === 'action_taken';
        return (
          <button
            onClick={() =>
              setResolveModal({
                isOpen: true,
                flag: f,
                status: isResolved ? f.status : 'resolved_safe',
                resolutionNotes: f.resolution_notes || '',
                isSubmitting: false,
              })
            }
            className={`px-3 py-1 text-xs font-bold rounded-none transition-colors ${
              !isResolved
                ? 'bg-[#1f5400] hover:bg-[#173e00] text-white'
                : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            {!isResolved ? 'Resolve Flag' : 'Review Dossier'}
          </button>
        );
      },
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Top Header */}
      <AdminPageHeader
        title="Risk, Fraud & Anomaly Governance"
        subtitle="Deterministic heuristics, order velocity thresholds, corridor price anomaly flags, and review queue."
        icon="fa-shield-virus"
        badge={`${totalCount} Risk Flags`}
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Risk Governance' },
        ]}
        actions={
          <button
            onClick={handleOpenRules}
            className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
            <span>Detection Heuristics Rules</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Flags</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.total_flags || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Cumulative risk events</p>
          </div>

          <div
            className={`border rounded-none p-4 text-center ${
              Number(metrics.open_flags || 0) > 0 ? 'bg-red-50/50 border-red-300' : 'bg-white border-gray-300'
            }`}
          >
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Open Flags</p>
            <p className="text-2xl font-bold text-red-600 mt-1 tabular-nums">
              {Number(metrics.open_flags || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-red-600/80 mt-0.5">Awaiting triage</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Critical Risk</p>
            <p className="text-2xl font-bold text-amber-800 mt-1 tabular-nums">
              {Number(metrics.critical_flags || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Severe financial / thermal</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Investigating</p>
            <p className="text-2xl font-bold text-blue-900 mt-1 tabular-nums">
              {Number(metrics.under_investigation || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Active field inquiry</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-[#1f5400] uppercase tracking-wider">Resolved Safe</p>
            <p className="text-2xl font-bold text-[#1f5400] mt-1 tabular-nums">
              {Number(metrics.resolved_safe || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Verified legitimate</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Action Taken</p>
            <p className="text-2xl font-bold text-purple-900 mt-1 tabular-nums">
              {Number(metrics.confirmed_fraud || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Enforced / suspended</p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white border border-gray-300 rounded-none p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <AdminTabs
              tabs={[
                { id: 'all', label: 'All Flags', count: Number(metrics.total_flags || 0) },
                { id: 'flagged', label: 'Flagged', count: Number(metrics.open_flags || 0) },
                { id: 'under_investigation', label: 'Investigating', count: Number(metrics.under_investigation || 0) },
                { id: 'resolved_safe', label: 'Resolved Safe' },
                { id: 'confirmed_fraud', label: 'Fraud / Action' },
              ]}
              activeTab={statusTab}
              onChange={(t) => {
                setStatusTab(t);
                setPage(1);
              }}
            />

            <div className="flex items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter risk flags by severity level"
                className="text-xs bg-white border border-gray-300 rounded-none px-3 py-1.5 focus:outline-none focus:border-[#1f5400] text-gray-700"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter risk flags by entity type"
                className="text-xs bg-white border border-gray-300 rounded-none px-3 py-1.5 focus:outline-none focus:border-[#1f5400] text-gray-700"
              >
                <option value="all">All Entities</option>
                <option value="order">Orders</option>
                <option value="product">Products</option>
                <option value="carrier">Carriers</option>
                <option value="user">Users</option>
                <option value="review">Reviews</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by entity ID, flag reason, or heuristic rule name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-none focus:outline-none focus:border-[#1f5400] bg-white text-gray-900"
            />
          </div>
        </div>

        {/* Risk Flags Table */}
        <div className="bg-white border border-gray-300 rounded-none overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-300 bg-[#FCF9F8] flex items-center justify-between">
            <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Anomalies & Fraud Surveillance Queue
            </span>
            <span className="text-xs text-gray-500 tabular-nums">
              Showing {flags.length} of {totalCount} records
            </span>
          </div>

          <AdminTable
            columns={columns}
            data={flags}
            loading={loading}
            emptyTitle="No risk flags found"
            emptyDescription={
              search || statusTab !== 'all' || severityFilter !== 'all' || entityFilter !== 'all'
                ? 'No risk flags matched your filter criteria.'
                : 'Surveillance heuristics report normal operational parameters. Zero flags pending.'
            }
            emptyIcon="fa-shield-check"
            keyExtractor={(row) => row.id}
          />

          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-300 bg-[#FCF9F8]">
              <AdminPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={15}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Resolution Modal */}
      <AdminModal
        isOpen={resolveModal.isOpen}
        onClose={() => setResolveModal((prev) => ({ ...prev, isOpen: false }))}
        title={`Resolve Risk Flag #RSK-${resolveModal.flag?.id || ''}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => setResolveModal((prev) => ({ ...prev, isOpen: false }))}
              disabled={resolveModal.isSubmitting}
              className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
            >
              Cancel
            </button>
            <button
              onClick={handleResolveSubmit}
              disabled={resolveModal.isSubmitting}
              className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {resolveModal.isSubmitting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording Resolution...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Confirm Resolution & Audit</span>
                </>
              )}
            </button>
          </div>
        }
      >
        {resolveModal.flag && (
          <div className="space-y-4 text-xs">
            {/* Flag Summary */}
            <div className="p-3 bg-gray-50 border border-gray-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-gray-900 uppercase">
                  {resolveModal.flag.entity_type}: {resolveModal.flag.entity_id}
                </span>
                {getSeverityBadge(resolveModal.flag.severity)}
              </div>
              <p className="text-gray-800">{resolveModal.flag.flag_reason}</p>
              {resolveModal.flag.evidence && (
                <div className="mt-2 p-2 bg-white border border-gray-200 font-mono text-[11px] text-gray-600">
                  {JSON.stringify(resolveModal.flag.evidence, null, 2)}
                </div>
              )}
            </div>

            {/* Resolution Status Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Resolution Determination *
              </label>
              <select
                value={resolveModal.status}
                onChange={(e) =>
                  setResolveModal((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
              >
                <option value="resolved_safe">Resolved Safe (Legitimate Commercial Activity)</option>
                <option value="under_investigation">Under Investigation (Escalate to Field Inspector)</option>
                <option value="confirmed_fraud">Confirmed Fraud (Bad Actor Verification)</option>
                <option value="action_taken">Action Taken (Account Suspended / Escrow Frozen)</option>
              </select>
            </div>

            {/* Investigation Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Investigation Findings & Audit Rationale *
              </label>
              <textarea
                rows={4}
                value={resolveModal.resolutionNotes}
                onChange={(e) =>
                  setResolveModal((prev) => ({ ...prev, resolutionNotes: e.target.value }))
                }
                placeholder="Explain the findings, verified invoices, or corrective enforcement taken..."
                className="w-full text-xs border border-gray-300 rounded-none p-2.5 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                This resolution will be permanently sealed in the system audit log with your operator credentials.
              </p>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Rules Modal */}
      <AdminModal
        isOpen={rulesModal.isOpen}
        onClose={() => setRulesModal((prev) => ({ ...prev, isOpen: false }))}
        title="Configured Surveillance Heuristics"
        maxWidth="lg"
        footer={
          <div className="flex justify-end w-full">
            <button
              onClick={() => setRulesModal((prev) => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {rulesModal.loading ? (
            <div className="p-8 text-center text-gray-500">Loading detection rules...</div>
          ) : rulesModal.rules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No detection rules found.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rulesModal.rules.map((rule) => (
                <div key={rule.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{rule.name}</span>
                      {getSeverityBadge(rule.severity)}
                      <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1 py-0.2">
                        {rule.rule_type}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs">{rule.description}</p>
                    <div className="font-mono text-[10px] text-gray-400">
                      Thresholds: {JSON.stringify(rule.threshold_config)}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold border rounded-none shrink-0 ${
                      rule.is_active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-gray-100 text-gray-600 border-gray-300'
                    }`}
                  >
                    {rule.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}


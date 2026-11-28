'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface DeliveryException {
  id: number;
  exception_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
  order_id?: number;
  suborder_id?: number;
  branch_id?: number;
  branch_name?: string;
  courier_id?: number;
  courier_name?: string;
  description: string;
  resolution_notes?: string;
  assigned_admin_id?: number;
  sla_deadline?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  suborder_number?: string;
}

const severityConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  low:      { label: 'Low',      color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-400' },
  medium:   { label: 'Medium',   color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400' },
  high:     { label: 'High',     color: 'text-orange-700',bg: 'bg-orange-50 border-orange-200',dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-700',   bg: 'bg-red-50 border-red-300',     dot: 'bg-red-500' },
};

const statusConfig: Record<string, { label: string; icon: string; color: string }> = {
  open:        { label: 'Open',        icon: 'radio_button_unchecked', color: 'text-gray-500' },
  in_progress: { label: 'In Progress', icon: 'sync',                   color: 'text-blue-500' },
  escalated:   { label: 'Escalated',   icon: 'warning',                color: 'text-orange-500' },
  resolved:    { label: 'Resolved',    icon: 'check_circle',           color: 'text-green-500' },
  closed:      { label: 'Closed',      icon: 'lock',                   color: 'text-gray-400' },
};

const exceptionTypeLabels: Record<string, string> = {
  sla_breach:          'SLA Breach',
  branch_suspended:    'Branch Suspended',
  courier_no_show:     'Courier No-Show',
  package_lost:        'Package Lost',
  delivery_failed:     'Delivery Failed',
  address_invalid:     'Invalid Address',
  cold_chain_break:    'Cold Chain Breach',
  payment_hold:        'Payment Hold',
  stock_mismatch:      'Stock Mismatch',
  reallocation_needed: 'Reallocation Needed',
  other:               'Other',
};

export default function AdminDeliveryExceptionsPage() {
  const { showSuccess, showError } = useToast();
  const [exceptions, setExceptions] = useState<DeliveryException[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<number, string>>({});
  const [slaResult, setSlaResult] = useState<{ scanned: number; created: number } | null>(null);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminListExceptions();
      setExceptions(res.exceptions || []);
    } catch {
      showError('Failed to load delivery exceptions');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const handleScanSla = async () => {
    setScanning(true);
    setSlaResult(null);
    try {
      const res = await api.adminScanSla();
      setSlaResult({ scanned: res.scanned_overdue_count, created: res.exceptions?.length || 0 });
      showSuccess(`SLA scan complete — ${res.scanned_overdue_count} overdue deliveries found`);
      await fetchExceptions();
    } catch {
      showError('SLA scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleRespondException = async (exceptionId: number, decision: 'approve' | 'reject') => {
    setRespondingId(exceptionId);
    try {
      await api.adminRespondException(exceptionId, {
        decision,
        notes: resolutionNotes[exceptionId] || '',
      });
      showSuccess(decision === 'approve' ? 'Exception resolved' : 'Exception closed');
      await fetchExceptions();
    } catch {
      showError('Failed to update exception');
    } finally {
      setRespondingId(null);
    }
  };

  const filtered = exceptions.filter((e) => {
    if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  const countBySeverity = (sev: string) => exceptions.filter(e => e.severity === sev && e.status === 'open').length;
  const isOverdue = (deadline?: string) => deadline && new Date(deadline) < new Date();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="material-icons text-red-500">warning</span>
              Delivery Exception Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitor, escalate, and resolve delivery failures, SLA breaches, and logistics exceptions.
            </p>
          </div>
          <button
            onClick={handleScanSla}
            disabled={scanning}
            className="shrink-0 flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-60 text-sm font-medium"
          >
            {scanning ? (
              <span className="material-icons animate-spin text-sm">refresh</span>
            ) : (
              <span className="material-icons text-sm">search</span>
            )}
            {scanning ? 'Scanning…' : 'Scan SLA Breaches'}
          </button>
        </div>

        {/* SLA scan result */}
        {slaResult && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-sm text-orange-800">
            <span className="material-icons text-sm text-orange-500">info</span>
            SLA scan: <strong>{slaResult.scanned}</strong> overdue deliveries detected.
            {slaResult.created > 0 && <> <strong>{slaResult.created}</strong> new exceptions created.</>}
          </div>
        )}

        {/* Severity summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
            const cfg = severityConfig[sev];
            const count = countBySeverity(sev);
            return (
              <button
                key={sev}
                onClick={() => setFilterSeverity(filterSeverity === sev ? 'all' : sev)}
                className={`text-left p-3 rounded-xl border transition ${
                  filterSeverity === sev ? cfg.bg + ' ' + cfg.color : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
                  <span className="text-xs font-medium uppercase tracking-wide">{sev}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-gray-400">open exceptions</p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(['open', 'in_progress', 'escalated', 'resolved', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition capitalize ${
                  filterStatus === s ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {s === 'all' ? 'All Status' : statusConfig[s]?.label || s}
              </button>
            ))}
          </div>
        </div>

        {/* Exception list */}
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <span className="material-icons animate-spin text-red-500 text-3xl">refresh</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
            <span className="material-icons text-gray-300 text-5xl block mb-3">
              {filterStatus === 'open' ? 'check_circle' : 'filter_list'}
            </span>
            <p className="text-gray-500 font-medium">
              {filterStatus === 'open' ? 'No open exceptions' : 'No exceptions match your filters'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {filterStatus === 'open' ? 'All deliveries are running smoothly.' : 'Try adjusting the filters above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((exc) => {
              const sevCfg = severityConfig[exc.severity] || severityConfig.low;
              const stCfg = statusConfig[exc.status] || statusConfig.open;
              const overdue = isOverdue(exc.sla_deadline);
              const isExpanded = expanded === exc.id;
              return (
                <div
                  key={exc.id}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                    exc.severity === 'critical' ? 'border-red-300' :
                    exc.severity === 'high' ? 'border-orange-200' : 'border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : exc.id)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-0.5 p-1.5 rounded-lg border ${sevCfg.bg}`}>
                          <span className={`material-icons text-sm ${sevCfg.color}`}>
                            {exc.severity === 'critical' ? 'dangerous' :
                             exc.severity === 'high' ? 'warning' : 'info'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sevCfg.bg} ${sevCfg.color}`}>
                              {sevCfg.label}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
                              {exceptionTypeLabels[exc.exception_type] || exc.exception_type}
                            </span>
                            {overdue && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200 font-medium animate-pulse">
                                OVERDUE
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 truncate">{exc.description}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                            {exc.suborder_number && <span>Suborder: {exc.suborder_number}</span>}
                            {exc.branch_name && (
                              <span className="flex items-center gap-1">
                                <span className="material-icons text-xs">store</span>
                                {exc.branch_name}
                              </span>
                            )}
                            {exc.courier_name && (
                              <span className="flex items-center gap-1">
                                <span className="material-icons text-xs">delivery_dining</span>
                                {exc.courier_name}
                              </span>
                            )}
                            <span>{new Date(exc.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`flex items-center gap-1 text-xs font-medium ${stCfg.color}`}>
                          <span className="material-icons text-xs">{stCfg.icon}</span>
                          {stCfg.label}
                        </span>
                        <span className="material-icons text-gray-400 text-sm">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50">
                      {exc.sla_deadline && (
                        <div className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                          overdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          <span className="material-icons text-sm">schedule</span>
                          SLA Deadline: {new Date(exc.sla_deadline).toLocaleString()}
                          {overdue && <span className="font-bold ml-1">— BREACHED</span>}
                        </div>
                      )}

                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Full Description</p>
                        <p className="text-sm text-gray-700">{exc.description}</p>
                      </div>

                      {exc.resolution_notes && (
                        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                          <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                            <span className="material-icons text-xs">check_circle</span>
                            Resolution Notes
                          </p>
                          <p className="text-sm text-gray-700">{exc.resolution_notes}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {[
                          { label: 'Exception ID', value: `#${exc.id}` },
                          { label: 'Order ID', value: exc.order_id ? `#${exc.order_id}` : '—' },
                          { label: 'Branch ID', value: exc.branch_id ? `#${exc.branch_id}` : '—' },
                          { label: 'Courier', value: exc.courier_name || '—' },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-white rounded-lg p-2 border border-gray-100">
                            <p className="text-gray-400">{label}</p>
                            <p className="font-semibold text-gray-700">{value}</p>
                          </div>
                        ))}
                      </div>

                      {exc.resolved_at && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <span className="material-icons text-xs">check</span>
                          Resolved at {new Date(exc.resolved_at).toLocaleString()}
                        </p>
                      )}

                      {exc.status !== 'resolved' && exc.status !== 'closed' && (
                        <div className="pt-2 border-t border-gray-200 space-y-2">
                          <input
                            type="text"
                            placeholder="Optional admin resolution note..."
                            value={resolutionNotes[exc.id] || ''}
                            onChange={(e) =>
                              setResolutionNotes((prev) => ({ ...prev, [exc.id]: e.target.value }))
                            }
                            className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRespondException(exc.id, 'approve')}
                              disabled={respondingId === exc.id}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-60"
                            >
                              Approve & Resolve
                            </button>
                            <button
                              onClick={() => handleRespondException(exc.id, 'reject')}
                              disabled={respondingId === exc.id}
                              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 disabled:opacity-60"
                            >
                              Close Exception
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info note */}
        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
          <span className="material-icons text-blue-500 text-sm mt-0.5">info</span>
          <span>
            Use <strong>Scan SLA Breaches</strong> to auto-detect overdue deliveries and create exception records.
            Exceptions marked <strong>Critical</strong> require immediate manual intervention.
          </span>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  Database,
  Cpu,
  Server,
  Clock,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Activity,
  Layers,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Wifi,
  FileText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminTable,
  AdminTableColumn,
} from '@/components/admin/ui';

export default function AdminSystemHealthPage() {
  const { showToast } = useToast();
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await api.getAdminSystemHealth();
      if (res) {
        setHealth(res);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch system telemetry', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${Math.floor(seconds % 60)}s`;
  };

  const getSeverityBadge = (severity: string) => {
    const s = (severity || '').toLowerCase();
    if (s === 'critical' || s === 'error') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-red-50 text-red-800 border border-red-300 rounded-none uppercase tracking-wider">
          {severity}
        </span>
      );
    }
    if (s === 'warning') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 rounded-none uppercase tracking-wider">
          Warning
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded-none uppercase tracking-wider">
        Info
      </span>
    );
  };

  const jobColumns: AdminTableColumn<any>[] = [
    {
      header: 'Worker Job Name',
      render: (j: any) => (
        <span className="font-mono text-xs font-bold text-gray-900">
          {j.job_name}
        </span>
      ),
    },
    {
      header: 'Execution Status',
      render: (j: any) => (
        <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-none uppercase">
          ✓ {j.status || 'Completed'}
        </span>
      ),
    },
    {
      header: 'Duration',
      render: (j: any) => (
        <span className="font-mono text-xs font-bold text-gray-800 tabular-nums">
          {j.duration_ms} ms
        </span>
      ),
    },
    {
      header: 'Records Handled',
      render: (j: any) => (
        <span className="font-mono text-xs text-gray-700 tabular-nums">
          {j.records_processed} units
        </span>
      ),
    },
    {
      header: 'Last Run Timestamp',
      align: 'right',
      render: (j: any) => (
        <span className="font-mono text-[11px] text-gray-500">
          {j.completed_at ? new Date(j.completed_at).toLocaleTimeString() : '—'}
        </span>
      ),
    },
  ];

  const eventColumns: AdminTableColumn<any>[] = [
    {
      header: 'Event ID & Time',
      render: (e: any) => (
        <div>
          <span className="font-mono text-xs font-bold text-gray-900">
            #EVT-{e.id}
          </span>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>
              {e.created_at
                ? new Date(e.created_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '—'}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Severity',
      render: (e: any) => getSeverityBadge(e.severity),
    },
    {
      header: 'Subsystem Source',
      render: (e: any) => (
        <span className="font-mono text-[11px] font-bold text-gray-700 uppercase bg-gray-100 px-1.5 py-0.2">
          {e.source}
        </span>
      ),
    },
    {
      header: 'Event Message & Diagnostics',
      className: 'max-w-md',
      render: (e: any) => (
        <div>
          <p className="text-xs text-gray-900">{e.message}</p>
          {e.metadata && Object.keys(e.metadata).length > 0 && (
            <div className="mt-1 font-mono text-[10px] text-gray-500">
              {JSON.stringify(e.metadata)}
            </div>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FCF9F8]">
        <div className="p-8 text-center text-xs font-semibold text-gray-500 flex items-center gap-2">
          <i className="fa-solid fa-spinner animate-spin text-[#007a6c] text-sm" />
          <span>Collecting infrastructure telemetry & database ping...</span>
        </div>
      </div>
    );
  }

  const { database, system_memory, queues, telemetry, recent_jobs, recent_events } = health || {};

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Header */}
      <AdminPageHeader
        title="System Health & Infrastructure Telemetry"
        subtitle="Live PostgreSQL connection latency, queue backlogs, failed webhooks, background jobs, and worker diagnostics."
        icon="fa-heart-pulse"
        badge="System Operational"
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'System Health' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHealth(true)}
              disabled={refreshing}
              className="px-3.5 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#007a6c]' : ''}`} />
              <span>{refreshing ? 'Probing...' : 'Refresh Telemetry'}</span>
            </button>
            <Link
              href="/admin/system/audit"
              className="px-3.5 py-1.5 text-xs font-medium text-[#1f5400] bg-emerald-50 border border-emerald-300 rounded-none hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Immutable Audit Logs</span>
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">PostgreSQL Ping</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {database?.latency_ms || 0} ms
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">Pool: {database?.pool_total_count || 10} connections</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Process Uptime</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {formatUptime(health?.uptime_seconds || 0)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Node {health?.node_version}</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Memory Heap</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {system_memory?.heap_used_mb || 0} MB
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">of {system_memory?.heap_total_mb || 0} MB heap</p>
          </div>

          <div
            className={`border rounded-none p-4 text-center ${
              Number(telemetry?.failed_webhooks_count || 0) > 0
                ? 'bg-amber-50/50 border-amber-300'
                : 'bg-white border-gray-300'
            }`}
          >
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Failed Webhooks</p>
            <p className="text-2xl font-bold text-amber-900 mt-1 tabular-nums">
              {telemetry?.failed_webhooks_count || 0}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Telebirr / Chapa pings</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Delivery Failures</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {telemetry?.failed_deliveries_count || 0}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">In-app / Broadcast</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-[#1f5400] uppercase tracking-wider">Audit Events (24h)</p>
            <p className="text-2xl font-bold text-[#1f5400] mt-1 tabular-nums">
              {Number(telemetry?.audit_events_24h || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">Logged operator actions</p>
          </div>
        </div>

        {/* Operational Queues Backlog Status */}
        <div className="bg-white border border-gray-300 rounded-none p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
                Live Administrative Queues & Processing Backlogs
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time pending workload across platform governance domains.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5">
              Normal Load
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-2">
            <Link
              href="/admin/kyc"
              className="p-3 bg-gray-50 border border-gray-200 hover:border-gray-400 transition-colors block"
            >
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Farmer KYC</span>
              <span className="text-xl font-bold text-gray-900 tabular-nums mt-1 block">
                {queues?.unverified_kyc || 0}
              </span>
              <span className="text-[10px] text-[#1f5400] font-semibold mt-1 inline-flex items-center gap-0.5">
                Review Queue <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </Link>

            <Link
              href="/admin/products"
              className="p-3 bg-gray-50 border border-gray-200 hover:border-gray-400 transition-colors block"
            >
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Product Catalog</span>
              <span className="text-xl font-bold text-gray-900 tabular-nums mt-1 block">
                {queues?.pending_products || 0}
              </span>
              <span className="text-[10px] text-[#1f5400] font-semibold mt-1 inline-flex items-center gap-0.5">
                Moderate <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </Link>

            <Link
              href="/admin/logistics/incidents"
              className="p-3 bg-gray-50 border border-gray-200 hover:border-gray-400 transition-colors block"
            >
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Cold-Chain SLA</span>
              <span
                className={`text-xl font-bold tabular-nums mt-1 block ${
                  Number(queues?.active_breaches || 0) > 0 ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {queues?.active_breaches || 0}
              </span>
              <span className="text-[10px] text-[#1f5400] font-semibold mt-1 inline-flex items-center gap-0.5">
                Inspect Breaches <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </Link>

            <Link
              href="/admin/support"
              className="p-3 bg-gray-50 border border-gray-200 hover:border-gray-400 transition-colors block"
            >
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Support Inbox</span>
              <span className="text-xl font-bold text-gray-900 tabular-nums mt-1 block">
                {queues?.open_tickets || 0}
              </span>
              <span className="text-[10px] text-[#1f5400] font-semibold mt-1 inline-flex items-center gap-0.5">
                Open Tickets <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </Link>

            <Link
              href="/admin/disputes"
              className="p-3 bg-gray-50 border border-gray-200 hover:border-gray-400 transition-colors block"
            >
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Buyer Disputes</span>
              <span className="text-xl font-bold text-gray-900 tabular-nums mt-1 block">
                {queues?.active_disputes || 0}
              </span>
              <span className="text-[10px] text-[#1f5400] font-semibold mt-1 inline-flex items-center gap-0.5">
                Arbitration <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </Link>

            <Link
              href="/admin/payments"
              className="p-3 bg-gray-50 border border-gray-200 hover:border-gray-400 transition-colors block"
            >
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Unreconciled</span>
              <span className="text-xl font-bold text-gray-900 tabular-nums mt-1 block">
                {queues?.unreconciled_payments || 0}
              </span>
              <span className="text-[10px] text-[#1f5400] font-semibold mt-1 inline-flex items-center gap-0.5">
                Reconciliation <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </Link>
          </div>
        </div>

        {/* Background Worker Jobs */}
        <div className="bg-white border border-gray-300 rounded-none overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-300 bg-[#FCF9F8] flex items-center justify-between">
            <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Background Automation & Daemon Job Runs
            </span>
            <span className="text-xs text-gray-500">Scheduled daemons & sweepers</span>
          </div>

          <AdminTable
            columns={jobColumns}
            data={recent_jobs || []}
            emptyTitle="No background job runs recorded"
            emptyIcon="fa-gear"
            keyExtractor={(row) => row.id}
          />
        </div>

        {/* Infrastructure Events Log */}
        <div className="bg-white border border-gray-300 rounded-none overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-300 bg-[#FCF9F8] flex items-center justify-between">
            <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Infrastructure Events & Diagnostics Stream
            </span>
            <span className="text-xs text-gray-500">Subsystem heartbeat & webhook telemetry</span>
          </div>

          <AdminTable
            columns={eventColumns}
            data={recent_events || []}
            emptyTitle="No infrastructure events recorded"
            emptyIcon="fa-heart-pulse"
            keyExtractor={(row) => row.id}
          />
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminStatusPill,
  AdminPagination,
  AdminModal,
  AdminDateRange,
  AdminTableColumn,
} from '@/components/admin/ui';

interface AuditLogEntry {
  id: string | number;
  actor_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_state: unknown;
  after_state: unknown;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    api.getAdminAuditLogs({
      page,
      limit: 20,
      search: search.trim() || undefined,
      action: actionFilter !== 'all' ? actionFilter : undefined,
      entity_type: entityFilter !== 'all' ? entityFilter : undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res?.logs) {
          setLogs(res.logs);
          setTotalPages(res.pagination.total_pages || 1);
          setTotalRecords(res.pagination.total || 0);
        } else {
          setLogs([]);
          setTotalPages(1);
          setTotalRecords(0);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to fetch audit logs:', err);
        setLogs([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, search, actionFilter, entityFilter, fromDate, toDate, refreshTrigger]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const columns: AdminTableColumn<AuditLogEntry>[] = [
    {
      header: 'Timestamp',
      className: 'w-44 tabular-nums',
      render: (log) => (
        <span className="font-mono text-gray-600">
          {new Date(log.created_at).toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      header: 'Actor',
      className: 'w-52',
      render: (log) => (
        <div>
          <p className="font-bold text-gray-900">{log.actor_name || 'System / Auto'}</p>
          <p className="text-[11px] text-gray-500 truncate">{log.actor_email || 'internal@greenharvest.local'}</p>
          {log.actor_role && (
            <span className="text-[10px] font-bold text-[#1f5400] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 uppercase">
              {log.actor_role}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Action',
      className: 'w-48',
      render: (log) => (
        <AdminStatusPill
          status={log.action}
          variant={
            log.action.includes('reject') || log.action.includes('suspend')
              ? 'error'
              : log.action.includes('approve') || log.action.includes('active')
              ? 'success'
              : 'info'
          }
        />
      ),
    },
    {
      header: 'Entity Target',
      className: 'w-40',
      render: (log) => (
        <div>
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">
            {log.entity_type}
          </span>
          {log.entity_id && (
            <span className="block font-mono text-gray-500 text-[11px]">
              ID: {log.entity_id}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Justification Reason',
      render: (log) => (
        <span className="text-gray-700 italic truncate max-w-xs block [text-wrap:pretty]">
          {log.reason ? `“${log.reason}”` : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right w-24',
      render: (log) => (
        <button
          type="button"
          onClick={() => setSelectedLog(log)}
          className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors shadow-2xs"
        >
          Inspect
        </button>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="System Audit Log"
        description="Immutable chronological record of all administrative mutations, approvals, and security interventions"
        icon="fa-clock-rotate-left"
        badge={totalRecords}
        badgeLabel="Events"
        actions={
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            <span>Dashboard</span>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <form onSubmit={handleSearchSubmit}>
          <AdminToolbar
            searchQuery={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search actor, action, reason, entity ID..."
            onRefresh={() => {
              setLoading(true);
              setRefreshTrigger((prev) => prev + 1);
            }}
            isRefreshing={loading}
            actions={
              <button
                type="submit"
                className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Search
              </button>
            }
          >
            {/* Filter by Entity */}
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:border-[#1f5400]"
              aria-label="Filter by target entity"
            >
              <option value="all">All Entity Types</option>
              <option value="user">Users</option>
              <option value="farmer">Farmers (KYC)</option>
              <option value="product">Products</option>
              <option value="dispute">Disputes</option>
              <option value="fleet_shipment">Logistics Fleet</option>
              <option value="platform_settings">Settings</option>
              <option value="admin_user">Admin Team</option>
            </select>

            {/* Filter by Action */}
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:border-[#1f5400]"
              aria-label="Filter by action category"
            >
              <option value="all">All Actions</option>
              <option value="settings.update">Settings Update</option>
              <option value="user.status">User Status Change</option>
              <option value="kyc.approve">KYC Approval</option>
              <option value="kyc.reject">KYC Rejection</option>
              <option value="product.moderate">Product Moderation</option>
              <option value="dispute.resolve">Dispute Resolution</option>
              <option value="team.assign_role">Team Role Change</option>
            </select>

            <AdminDateRange
              fromDate={fromDate}
              toDate={toDate}
              onFromChange={(val) => {
                setFromDate(val);
                setPage(1);
              }}
              onToChange={(val) => {
                setToDate(val);
                setPage(1);
              }}
            />
          </AdminToolbar>
        </form>

        <AdminTable
          columns={columns}
          data={logs}
          loading={loading}
          emptyTitle="No audit log events match criteria"
          emptyDescription="Administrative mutations, status changes, and configurations will be permanently recorded here."
          emptyIcon="fa-clipboard-list"
          rowKey={(log) => log.id}
        />

        <AdminPagination
          page={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          limit={20}
          onPageChange={setPage}
          disabled={loading}
        />
      </div>

      {/* Audit Log Detail Modal */}
      {selectedLog && (
        <AdminModal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log Record #${selectedLog.id}`}
          subtitle={`Captured on ${new Date(selectedLog.created_at).toLocaleString()}`}
          icon="fa-shield-halved"
          maxWidth="2xl"
          footer={
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition-colors"
            >
              Close
            </button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-[#FCF9F8] p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-500 block text-[11px] font-semibold">Actor</span>
                <span className="font-bold text-gray-900">{selectedLog.actor_name || 'System'}</span>
                <span className="text-gray-600 block text-[11px] font-mono">{selectedLog.actor_email || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px] font-semibold">Action & Target</span>
                <span className="font-mono font-bold text-gray-900">{selectedLog.action}</span>
                <span className="text-gray-600 block text-[11px]">
                  {selectedLog.entity_type} {selectedLog.entity_id ? `(#${selectedLog.entity_id})` : ''}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px] font-semibold">Client IP</span>
                <span className="font-mono text-gray-800">{selectedLog.ip_address || 'Internal/Proxy'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px] font-semibold">Reason</span>
                <span className="text-gray-800 font-medium">{selectedLog.reason || 'None specified'}</span>
              </div>
            </div>

            {selectedLog.before_state ? (
              <div>
                <h4 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider mb-1">
                  State Before Mutation
                </h4>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.before_state, null, 2)}
                </pre>
              </div>
            ) : null}

            {selectedLog.after_state ? (
              <div>
                <h4 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider mb-1">
                  State After Mutation
                </h4>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.after_state, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </AdminModal>
      )}
    </div>
  );
}

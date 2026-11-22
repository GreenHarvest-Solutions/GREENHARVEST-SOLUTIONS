'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Clock,
  Layers,
  CheckCircle,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Table as TableIcon,
  Sparkles,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminTable,
  AdminTableColumn,
  AdminPagination,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminReportsPage() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New Export Modal State
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    reportType: string;
    name: string;
    format: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    reportType: 'gmv_commission',
    name: '',
    format: 'csv',
    isSubmitting: false,
  });

  // Schedules Modal State
  const [schedulesModal, setSchedulesModal] = useState<{
    isOpen: boolean;
    schedules: any[];
    loading: boolean;
  }>({
    isOpen: false,
    schedules: [],
    loading: false,
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReports({ page, limit: 10 });
      if (res) {
        setJobs(res.jobs || []);
        if (res.catalog) {
          setCatalog(res.catalog);
        }
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleOpenSchedules = async () => {
    setSchedulesModal({ isOpen: true, schedules: [], loading: true });
    try {
      const res = await api.getAdminReportSchedules();
      setSchedulesModal({ isOpen: true, schedules: res.schedules || [], loading: false });
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch report schedules', 'error');
      setSchedulesModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const triggerExport = async (type: string, customName?: string) => {
    try {
      const res = await api.exportAdminReport({
        report_type: type,
        name: customName || undefined,
        format: 'csv',
      });

      // Trigger browser download of CSV
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${type}_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Export complete: ${res.row_count} rows downloaded as CSV`, 'success');
      fetchReports();
    } catch (err: any) {
      showToast(err.message || 'Failed to generate report export', 'error');
    }
  };

  const handleModalExportSubmit = async () => {
    setExportModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await triggerExport(exportModal.reportType, exportModal.name.trim() || undefined);
      setExportModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
    } catch {
      setExportModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const columns: AdminTableColumn<any>[] = [
    {
      header: 'Job ID & Date',
      render: (j: any) => (
        <div>
          <span className="font-mono text-xs font-bold text-gray-900 tabular-nums">
            #JOB-{j.id}
          </span>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>
              {j.created_at
                ? new Date(j.created_at).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '—'}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Report Title & Type',
      className: 'max-w-xs',
      render: (j: any) => (
        <div>
          <span className="font-semibold text-gray-900 text-xs block line-clamp-1">{j.name}</span>
          <span className="font-mono text-[10px] text-gray-500 uppercase bg-gray-100 px-1 py-0.2">
            {j.report_type}
          </span>
        </div>
      ),
    },
    {
      header: 'Format',
      render: (j: any) => (
        <span className="font-mono text-xs font-bold uppercase text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5">
          {j.format || 'CSV'}
        </span>
      ),
    },
    {
      header: 'Records',
      render: (j: any) => (
        <span className="font-mono text-xs font-bold text-gray-900 tabular-nums">
          {Number(j.row_count || 0).toLocaleString()} rows
        </span>
      ),
    },
    {
      header: 'File Size',
      render: (j: any) => {
        const kb = Math.round(Number(j.file_size_bytes || 0) / 1024);
        return <span className="font-mono text-xs text-gray-600 tabular-nums">{kb} KB</span>;
      },
    },
    {
      header: 'Status',
      render: (j: any) => (
        <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-none">
          ✓ Completed
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      render: (j: any) => (
        <button
          onClick={() => triggerExport(j.report_type, j.name)}
          className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-none flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3 h-3 text-[#1f5400]" />
          <span>Download CSV</span>
        </button>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Header */}
      <AdminPageHeader
        title="Platform Reports & Data Export Center"
        subtitle="Generate, schedule, and export commercial, escrow reconciliation, and cold-chain compliance CSV datasets."
        icon="fa-file-invoice"
        badge={`${totalCount} Export Jobs`}
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Reports & Exports' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSchedules}
              className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span>Automated Schedules</span>
            </button>
            <button
              onClick={() => setExportModal((prev) => ({ ...prev, isOpen: true }))}
              className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Custom Export</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Report Catalog Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Standard Administrative Report Catalog
            </span>
            <span className="text-xs text-gray-500">8 predefined operational datasets</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {catalog.map((item) => (
              <div
                key={item.type}
                className="bg-white border border-gray-300 rounded-none p-4 flex flex-col justify-between hover:border-gray-400 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1f5400] bg-emerald-50 px-1.5 py-0.2 border border-emerald-200">
                      {item.category}
                    </span>
                    <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-900 mt-1">{item.name}</h3>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                </div>

                <div className="pt-4 border-t border-gray-100 mt-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-gray-400 uppercase">FORMAT: CSV</span>
                  <button
                    onClick={() => triggerExport(item.type, item.name)}
                    className="px-2.5 py-1 text-xs font-bold text-[#1f5400] hover:bg-emerald-50 border border-emerald-300 rounded-none transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Report Jobs */}
        <div className="bg-white border border-gray-300 rounded-none overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-300 bg-[#FCF9F8] flex items-center justify-between">
            <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Generated Export Jobs History
            </span>
            <span className="text-xs text-gray-500 tabular-nums">
              Showing {jobs.length} of {totalCount} records
            </span>
          </div>

          <AdminTable
            columns={columns}
            data={jobs}
            loading={loading}
            emptyTitle="No report export jobs recorded"
            emptyDescription="Export jobs generated by your team will appear here for subsequent download."
            emptyIcon="fa-file-invoice"
            keyExtractor={(row) => row.id}
          />

          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-300 bg-[#FCF9F8]">
              <AdminPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={10}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Custom Export Modal */}
      <AdminModal
        isOpen={exportModal.isOpen}
        onClose={() => setExportModal((prev) => ({ ...prev, isOpen: false }))}
        title="Execute Custom Administrative Data Export"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => setExportModal((prev) => ({ ...prev, isOpen: false }))}
              disabled={exportModal.isSubmitting}
              className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
            >
              Cancel
            </button>
            <button
              onClick={handleModalExportSubmit}
              disabled={exportModal.isSubmitting}
              className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {exportModal.isSubmitting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating CSV...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Execute Export</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Select Dataset *
            </label>
            <select
              value={exportModal.reportType}
              onChange={(e) => setExportModal((prev) => ({ ...prev, reportType: e.target.value }))}
              className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
            >
              <option value="gmv_commission">GMV & Platform Commission Ledger</option>
              <option value="refunds_payouts">Escrow Disbursements & Refunds</option>
              <option value="kyc_aging">Farmer KYC Verification Aging</option>
              <option value="moderation_sla">Catalog Moderation SLA</option>
              <option value="dispute_aging">Dispute Resolution Turnaround</option>
              <option value="delivery_performance">Fleet Delivery Performance</option>
              <option value="cold_chain_compliance">Reefer Cold-Chain Compliance</option>
              <option value="user_growth">User Growth & Regional Distribution</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Custom File Label (Optional)
            </label>
            <input
              type="text"
              value={exportModal.name}
              onChange={(e) => setExportModal((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Q4_Executive_Settlement_Audit"
              className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200">
            <span className="font-bold text-gray-800">Export Specifications:</span>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-gray-600 text-[11px]">
              <li>Format: RFC 4180 compliant CSV format</li>
              <li>Encoding: UTF-8</li>
              <li>Max record limit: 1,000 recent historical rows</li>
              <li>Generated with parameterized SQL directly from PostgreSQL database</li>
            </ul>
          </div>
        </div>
      </AdminModal>

      {/* Automated Schedules Modal */}
      <AdminModal
        isOpen={schedulesModal.isOpen}
        onClose={() => setSchedulesModal((prev) => ({ ...prev, isOpen: false }))}
        title="Automated Report Delivery Schedules"
        maxWidth="lg"
        footer={
          <div className="flex justify-end w-full">
            <button
              onClick={() => setSchedulesModal((prev) => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {schedulesModal.loading ? (
            <div className="p-8 text-center text-gray-500">Loading schedules...</div>
          ) : schedulesModal.schedules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No automated schedules configured.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {schedulesModal.schedules.map((s) => (
                <div key={s.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{s.name}</span>
                      <span className="font-mono text-[10px] uppercase font-bold text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.2">
                        {s.cadence}
                      </span>
                    </div>
                    <div className="text-gray-500 text-[11px]">
                      Recipients: {Array.isArray(s.recipients) ? s.recipients.join(', ') : 'none'}
                    </div>
                    {s.next_run_at && (
                      <div className="text-[10px] text-gray-400 font-mono">
                        Next run:{' '}
                        {new Date(s.next_run_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-none shrink-0">
                    Active
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


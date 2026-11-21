'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Scale,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  ThermometerSnowflake,
  Weight,
  Award,
  Truck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminTable,
  AdminPagination,
  AdminEmptyState,
  AdminTabs,
} from '@/components/admin/ui';

export default function AdminDisputesPage() {
  const { showToast } = useToast();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('open');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<any>({
    total_disputes: 0,
    open_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    transit_spoilage_count: 0,
    weight_shortage_count: 0,
    grade_mismatch_count: 0,
    non_delivery_count: 0,
  });

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const res = await api.getAdminDisputes({
        status: statusParam,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setDisputes(res.disputes || []);
        if (res.metrics) setMetrics(res.metrics);
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load disputes queue', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, categoryFilter, search, page, showToast]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const tabs = [
    { key: 'open', label: 'Active Arbitration', count: metrics.open_count },
    { key: 'all', label: 'All Disputes', count: metrics.total_disputes },
    { key: 'accepted', label: 'Settled & Refunded', count: metrics.accepted_count },
    { key: 'rejected', label: 'Rejected Claims', count: metrics.rejected_count },
  ];

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'transit_spoilage':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-300">
            <ThermometerSnowflake className="w-3 h-3 text-blue-700" />
            <span>Transit Spoilage</span>
          </span>
        );
      case 'weight_shortage':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
            <Weight className="w-3 h-3 text-amber-700" />
            <span>Weight Shortage</span>
          </span>
        );
      case 'grade_mismatch':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-300">
            <Award className="w-3 h-3 text-purple-700" />
            <span>Grade Mismatch</span>
          </span>
        );
      case 'non_delivery':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-red-50 text-red-900 border border-red-300">
            <Truck className="w-3 h-3 text-red-700" />
            <span>Non-Delivery</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-gray-100 text-gray-800 border border-gray-300">
            <Scale className="w-3 h-3 text-gray-600" />
            <span>General Discrepancy</span>
          </span>
        );
    }
  };

  const columns = [
    {
      header: 'Claim #',
      accessor: (row: any) => (
        <div>
          <Link
            href={`/admin/disputes/${row.id}`}
            className="font-mono font-bold text-[#1f5400] hover:underline flex items-center gap-1"
          >
            <span>DSP-#{row.id}</span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </Link>
          <div className="text-[11px] text-gray-500 font-mono">
            {new Date(row.created_at).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
      ),
    },
    {
      header: 'Consignment',
      accessor: (row: any) => (
        <div>
          <Link
            href={`/admin/orders/${row.order_id}`}
            className="font-mono font-bold text-gray-900 hover:text-[#1f5400] text-xs"
          >
            Order #{row.order_id}
          </Link>
          <div className="text-[10px] text-gray-500 font-mono">
            Tracking: {row.tracking_number || 'GH-RET-000'}
          </div>
        </div>
      ),
    },
    {
      header: 'Dispute Category',
      accessor: (row: any) => getCategoryBadge(row.dispute_category),
    },
    {
      header: 'Claim Reason & Evidence',
      accessor: (row: any) => (
        <div className="max-w-[280px]">
          <div className="text-gray-900 font-medium text-xs line-clamp-1" title={row.reason}>
            &quot;{row.reason}&quot;
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
            {row.evidence_count > 0 && (
              <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.2 border border-gray-200">
                <ImageIcon className="w-2.5 h-2.5 text-gray-600" />
                <span>{row.evidence_count} Photo(s)</span>
              </span>
            )}
            {row.has_weighbridge_slip && (
              <span className="flex items-center gap-1 bg-amber-50 text-amber-900 px-1.5 py-0.2 border border-amber-200">
                <FileText className="w-2.5 h-2.5 text-amber-700" />
                <span>Weighbridge Slip</span>
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Buyer vs Farmer',
      accessor: (row: any) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-900 truncate max-w-[150px]">{row.buyer_name}</div>
          <div className="text-[11px] text-gray-500 truncate max-w-[150px]">
            vs. <strong className="text-gray-700">{row.farmer_name}</strong>
          </div>
        </div>
      ),
    },
    {
      header: 'Value at Risk',
      accessor: (row: any) => (
        <div className="text-right font-mono">
          <div className="font-bold text-gray-900 tabular-nums">
            ETB {parseFloat(row.order_total || row.escrow_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-700 font-bold uppercase">
            Escrow: {row.escrow_status || 'HELD'}
          </div>
        </div>
      ),
    },
    {
      header: 'Claim State',
      accessor: (row: any) => {
        const s = row.status;
        return (
          <span
            className={`inline-block px-2 py-0.5 text-[11px] font-bold border tabular-nums ${
              s === 'accepted'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : s === 'rejected'
                ? 'bg-red-50 text-red-800 border-red-300'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}
          >
            {s === 'pending' ? '⏳ UNDER REVIEW' : s.toUpperCase()}
          </span>
        );
      },
    },
    {
      header: 'Action',
      className: 'text-right',
      accessor: (row: any) => (
        <Link
          href={`/admin/disputes/${row.id}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-[#1f5400] hover:bg-[#173e00] transition-colors"
        >
          <Scale className="w-3 h-3" />
          <span>Arbitrate</span>
        </Link>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Disputes & Claims Arbitration Queue"
        badge={`${totalCount} Total Claims`}
        subtitle="Weighbridge slips verification, transit spoilage investigation, and multi-party escrow split arbitration."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Commerce', href: '/admin/orders' },
          { label: 'Disputes', href: '/admin/disputes' },
        ]}
      />

      {/* KPI Metric Strip */}
      <div className="px-8 pt-6 pb-2 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Under Arbitration</div>
            <div className="text-xl font-bold text-amber-900 font-mono mt-1 tabular-nums">
              {metrics.open_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Active Claims</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Cold-Chain Spoilage</div>
            <div className="text-xl font-bold text-blue-900 font-mono mt-1 tabular-nums">
              {metrics.transit_spoilage_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Temperature Breaches</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Weight Discrepancy</div>
            <div className="text-xl font-bold text-amber-900 font-mono mt-1 tabular-nums">
              {metrics.weight_shortage_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Weighbridge Slips</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Grade Mismatch</div>
            <div className="text-xl font-bold text-purple-900 font-mono mt-1 tabular-nums">
              {metrics.grade_mismatch_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Quality Discrepancies</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Settled & Closed</div>
            <div className="text-xl font-bold text-[#1f5400] font-mono mt-1 tabular-nums">
              {metrics.accepted_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Split Settlements</div>
          </div>

          <div className="bg-white border border-gray-300 p-3.5 shadow-sm text-center">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Rejected Claims</div>
            <div className="text-xl font-bold text-red-900 font-mono mt-1 tabular-nums">
              {metrics.rejected_count}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Unsubstantiated</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4">
        {/* State Tabs */}
        <div className="bg-white border border-gray-300 px-4 pt-2 shadow-sm">
          <AdminTabs tabs={tabs} activeTab={tab} onChange={(k) => { setTab(k); setPage(1); }} />
        </div>

        {/* Toolbar & Category Filters */}
        <div className="bg-white border border-gray-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search claim #, consignment #, reason, buyer, producer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 bg-white font-medium text-gray-800 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Claim Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="text-xs border border-gray-300 px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:border-[#1f5400]"
            >
              <option value="all">All Discrepancy Types</option>
              <option value="transit_spoilage">Transit Temperature Spoilage</option>
              <option value="weight_shortage">Weighbridge Volume Shortage</option>
              <option value="grade_mismatch">Grade / Quality Mismatch</option>
              <option value="non_delivery">Non-Delivery Claim</option>
            </select>
          </div>
        </div>

        {/* Disputes Table */}
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Claims & Arbitration Docket ({totalCount})
            </h2>
            <div className="text-[11px] text-gray-500">
              Page {page} of {totalPages}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-[#1f5400] border-t-transparent rounded-full" />
              <p className="text-xs text-gray-500 mt-2 font-mono">Loading arbitration claims...</p>
            </div>
          ) : disputes.length === 0 ? (
            <div className="py-16 text-center">
              <AdminEmptyState
                icon={<Scale className="w-8 h-8 text-gray-400 mx-auto" />}
                title="No disputes in this view"
                description="All commercial trades are clear or no claims matched your active filters."
              />
            </div>
          ) : (
            <>
              <AdminTable columns={columns} data={disputes} keyExtractor={(row) => row.id} />
              <div className="p-4 border-t border-gray-200">
                <AdminPagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={15}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

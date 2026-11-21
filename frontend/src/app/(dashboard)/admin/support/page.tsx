'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Headset,
  Search,
  Plus,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  Filter,
  LifeBuoy,
  Phone,
  Mail,
  UserCheck,
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

export default function AdminSupportPage() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    total_tickets: 0,
    open_tickets: 0,
    in_progress_tickets: 0,
    urgent_tickets: 0,
    waiting_customer: 0,
    resolved_today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New Ticket Modal State
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean;
    subject: string;
    category: string;
    priority: string;
    userId: string;
    initialMessage: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    subject: '',
    category: 'general',
    priority: 'medium',
    userId: '',
    initialMessage: '',
    isSubmitting: false,
  });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminTickets({
        status: statusTab === 'all' ? undefined : statusTab,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setTickets(res.tickets || []);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch support tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusTab, priorityFilter, categoryFilter, search, page, showToast]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async () => {
    if (!createModal.subject.trim()) {
      showToast('Ticket subject is required', 'error');
      return;
    }
    if (!createModal.initialMessage.trim()) {
      showToast('Initial message describing the inquiry is required', 'error');
      return;
    }

    setCreateModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.createAdminTicket({
        subject: createModal.subject.trim(),
        category: createModal.category,
        priority: createModal.priority,
        user_id: createModal.userId ? parseInt(createModal.userId, 10) : undefined,
        initial_message: createModal.initialMessage.trim(),
      });

      showToast(res.message || 'Ticket created successfully', 'success');
      setCreateModal({
        isOpen: false,
        subject: '',
        category: 'general',
        priority: 'medium',
        userId: '',
        initialMessage: '',
        isSubmitting: false,
      });
      fetchTickets();
    } catch (err: any) {
      showToast(err.message || 'Failed to create ticket', 'error');
      setCreateModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-red-50 text-red-800 border border-red-300 rounded-none uppercase tracking-wider">
          Urgent
        </span>
      );
    }
    if (p === 'high') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 rounded-none uppercase tracking-wider">
          High
        </span>
      );
    }
    if (p === 'medium') {
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
    if (s === 'open') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-red-50 text-red-800 border border-red-200 rounded-none">
          Open
        </span>
      );
    }
    if (s === 'in_progress') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded-none">
          In Progress
        </span>
      );
    }
    if (s === 'waiting_on_customer') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 rounded-none">
          Waiting Customer
        </span>
      );
    }
    if (s === 'resolved') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-none">
          ✓ Resolved
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 rounded-none">
        Closed
      </span>
    );
  };

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      order_issue: 'Order Issue',
      payment_escrow: 'Payment & Escrow',
      cold_chain_spoilage: 'Cold-Chain Spoilage',
      kyc_verification: 'KYC Verification',
      quality_dispute: 'Quality Dispute',
      technical: 'Technical System',
      general: 'General Inquiry',
    };
    return map[cat] || cat.replace(/_/g, ' ');
  };

  const columns: AdminTableColumn<any>[] = [
    {
      header: 'Ticket ID & Created',
      render: (t: any) => (
        <div>
          <span className="font-mono text-xs font-bold text-gray-900 tabular-nums">
            {t.ticket_number}
          </span>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>
              {t.created_at
                ? new Date(t.created_at).toLocaleDateString('en-US', {
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
      header: 'Priority',
      render: (t: any) => getPriorityBadge(t.priority),
    },
    {
      header: 'Customer & Role',
      render: (t: any) => (
        <div>
          <div className="font-bold text-gray-900 flex items-center gap-1.5">
            <span>{t.customer_name || 'Anonymous User'}</span>
            <span className="text-[10px] uppercase font-bold text-gray-600 bg-gray-100 px-1 py-0.5">
              {t.customer_role || 'User'}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {t.customer_phone || t.customer_email || 'No contact on file'}
          </div>
        </div>
      ),
    },
    {
      header: 'Subject & Category',
      className: 'max-w-xs',
      render: (t: any) => (
        <div>
          <p className="font-semibold text-gray-900 text-xs line-clamp-1">{t.subject}</p>
          <span className="inline-block mt-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.2">
            {getCategoryLabel(t.category)}
          </span>
        </div>
      ),
    },
    {
      header: 'Assigned Agent',
      render: (t: any) => {
        if (t.assignee_name) {
          return (
            <div className="flex items-center gap-1 text-xs font-medium text-gray-800">
              <UserCheck className="w-3.5 h-3.5 text-[#007a6c]" />
              <span>{t.assignee_name}</span>
            </div>
          );
        }
        return (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5">
            Unassigned
          </span>
        );
      },
    },
    {
      header: 'Latest Activity',
      className: 'max-w-xs',
      render: (t: any) => (
        <div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <MessageSquare className="w-3 h-3 text-gray-400" />
            <span className="tabular-nums font-semibold">{t.message_count || 1} messages</span>
          </div>
          {t.last_message_snippet && (
            <p className="text-[11px] text-gray-600 line-clamp-1 mt-0.5">
              {t.last_message_snippet}
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      render: (t: any) => getStatusBadge(t.status),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (t: any) => (
        <Link
          href={`/admin/support/${t.id}`}
          className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-none transition-colors"
        >
          <span>Open Thread</span>
          <ArrowRight className="w-3 h-3 text-gray-500" />
        </Link>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Header */}
      <AdminPageHeader
        title="Support Operations & Inquiry Triage"
        subtitle="Customer, producer, and carrier inquiries, dispute escalations, and technical ticketing."
        icon="fa-headset"
        badge={`${totalCount} Tickets`}
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Support Queue' },
        ]}
        actions={
          <button
            onClick={() => setCreateModal((prev) => ({ ...prev, isOpen: true }))}
            className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Support Ticket</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Tickets</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.total_tickets || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">All customer inquiries</p>
          </div>

          <div
            className={`border rounded-none p-4 text-center ${
              Number(metrics.open_tickets || 0) > 0
                ? 'bg-red-50/50 border-red-300'
                : 'bg-white border-gray-300'
            }`}
          >
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Open / Unassigned</p>
            <p className="text-2xl font-bold text-red-600 mt-1 tabular-nums">
              {Number(metrics.open_tickets || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-red-600/80 mt-0.5">Awaiting agent response</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Urgent Priority</p>
            <p className="text-2xl font-bold text-amber-800 mt-1 tabular-nums">
              {Number(metrics.urgent_tickets || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Critical SLA impact</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">In Progress</p>
            <p className="text-2xl font-bold text-blue-900 mt-1 tabular-nums">
              {Number(metrics.in_progress_tickets || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Under investigation</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Waiting Customer</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.waiting_customer || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Pending user reply</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-[#1f5400] uppercase tracking-wider">Resolved Today</p>
            <p className="text-2xl font-bold text-[#1f5400] mt-1 tabular-nums">
              {Number(metrics.resolved_today || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Cleared tickets</p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white border border-gray-300 rounded-none p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Status Tabs */}
            <AdminTabs
              tabs={[
                { id: 'all', label: 'All Tickets', count: Number(metrics.total_tickets || 0) },
                { id: 'open', label: 'Open', count: Number(metrics.open_tickets || 0) },
                { id: 'in_progress', label: 'In Progress', count: Number(metrics.in_progress_tickets || 0) },
                { id: 'waiting_on_customer', label: 'Waiting', count: Number(metrics.waiting_customer || 0) },
                { id: 'resolved', label: 'Resolved' },
                { id: 'closed', label: 'Closed' },
              ]}
              activeTab={statusTab}
              onChange={(t) => {
                setStatusTab(t);
                setPage(1);
              }}
            />

            {/* Select Filters */}
            <div className="flex items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter tickets by priority level"
                className="text-xs bg-white border border-gray-300 rounded-none px-3 py-1.5 focus:outline-none focus:border-[#1f5400] text-gray-700"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter tickets by category"
                className="text-xs bg-white border border-gray-300 rounded-none px-3 py-1.5 focus:outline-none focus:border-[#1f5400] text-gray-700"
              >
                <option value="all">All Categories</option>
                <option value="order_issue">Order Issue</option>
                <option value="payment_escrow">Payment & Escrow</option>
                <option value="cold_chain_spoilage">Cold-Chain Spoilage</option>
                <option value="kyc_verification">KYC Verification</option>
                <option value="quality_dispute">Quality Dispute</option>
                <option value="technical">Technical</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ticket number, customer name, email, or subject..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-none focus:outline-none focus:border-[#1f5400] bg-white text-gray-900"
            />
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-white border border-gray-300 rounded-none overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-300 bg-[#FCF9F8] flex items-center justify-between">
            <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Customer & Producer Support Registry
            </span>
            <span className="text-xs text-gray-500 tabular-nums">
              Showing {tickets.length} of {totalCount} records
            </span>
          </div>

          <AdminTable
            columns={columns}
            data={tickets}
            loading={loading}
            emptyTitle="No support tickets found"
            emptyDescription={
              search || statusTab !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all'
                ? 'No tickets matched your current search filters. Try clearing your parameters.'
                : 'All customer and farmer inquiries have been resolved. The queue is empty.'
            }
            emptyIcon="fa-check-circle"
            keyExtractor={(row) => row.id}
          />

          {/* Pagination */}
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

      {/* Create Ticket Modal */}
      <AdminModal
        isOpen={createModal.isOpen}
        onClose={() => setCreateModal((prev) => ({ ...prev, isOpen: false }))}
        title="Open Administrative Support Ticket"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => setCreateModal((prev) => ({ ...prev, isOpen: false }))}
              disabled={createModal.isSubmitting}
              className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTicket}
              disabled={createModal.isSubmitting}
              className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors disabled:opacity-50"
            >
              {createModal.isSubmitting ? 'Opening Ticket...' : 'Create Ticket'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Ticket Subject *
            </label>
            <input
              type="text"
              value={createModal.subject}
              onChange={(e) => setCreateModal((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="e.g. Tomato spoilage dispute for order ORD-1029"
              className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={createModal.category}
                onChange={(e) => setCreateModal((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
              >
                <option value="general">General Inquiry</option>
                <option value="order_issue">Order Issue</option>
                <option value="payment_escrow">Payment & Escrow</option>
                <option value="cold_chain_spoilage">Cold-Chain Spoilage</option>
                <option value="kyc_verification">KYC Verification</option>
                <option value="quality_dispute">Quality Dispute</option>
                <option value="technical">Technical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={createModal.priority}
                onChange={(e) => setCreateModal((prev) => ({ ...prev, priority: e.target.value }))}
                className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Customer / User ID (Optional)
            </label>
            <input
              type="number"
              value={createModal.userId}
              onChange={(e) => setCreateModal((prev) => ({ ...prev, userId: e.target.value }))}
              placeholder="Leave empty for unassigned general ticket"
              className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Initial Inquiry / Problem Description *
            </label>
            <textarea
              rows={4}
              value={createModal.initialMessage}
              onChange={(e) => setCreateModal((prev) => ({ ...prev, initialMessage: e.target.value }))}
              placeholder="Detail the customer request, phone call summary, or inquiry details..."
              className="w-full text-xs border border-gray-300 rounded-none p-2.5 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Radio,
  Search,
  Plus,
  Send,
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Layers,
  FileText,
  Bell,
  XCircle,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  MapPin,
  ShieldAlert,
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

export default function AdminAnnouncementsPage() {
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    total_broadcasts: 0,
    sent_count: 0,
    scheduled_count: 0,
    draft_count: 0,
    total_recipients_reached: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Broadcast Modal State
  const [broadcastModal, setBroadcastModal] = useState<{
    isOpen: boolean;
    announcement: any | null;
    title: string;
    message: string;
    targetAudience: string;
    region: string;
    kycTier: string;
    priority: string;
    category: string;
    channels: string[];
    isDismissible: boolean;
    sendImmediately: boolean;
    estimatedReach: number | null;
    isEstimating: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    announcement: null,
    title: '',
    message: '',
    targetAudience: 'all',
    region: 'all',
    kycTier: 'all',
    priority: 'normal',
    category: 'general',
    channels: ['in_app'],
    isDismissible: true,
    sendImmediately: true,
    estimatedReach: null,
    isEstimating: false,
    isSubmitting: false,
  });

  // Templates Modal State
  const [templatesModal, setTemplatesModal] = useState<{
    isOpen: boolean;
    templates: any[];
    loading: boolean;
  }>({
    isOpen: false,
    templates: [],
    loading: false,
  });

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAnnouncements({
        status: statusTab === 'all' ? undefined : statusTab,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setAnnouncements(res.announcements || []);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch announcements', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusTab, categoryFilter, priorityFilter, search, page, showToast]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Recalculate audience estimation when targeting changes
  useEffect(() => {
    if (!broadcastModal.isOpen) return;

    let isMounted = true;
    setBroadcastModal((prev) => ({ ...prev, isEstimating: true }));

    const timer = setTimeout(() => {
      api
        .estimateAdminAudience({
          target_audience: broadcastModal.targetAudience,
          target_filter: {
            region: broadcastModal.region,
            kyc_tier: broadcastModal.kycTier,
          },
        })
        .then((res) => {
          if (isMounted) {
            setBroadcastModal((prev) => ({
              ...prev,
              estimatedReach: res.estimated_reach,
              isEstimating: false,
            }));
          }
        })
        .catch(() => {
          if (isMounted) {
            setBroadcastModal((prev) => ({ ...prev, isEstimating: false }));
          }
        });
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [broadcastModal.isOpen, broadcastModal.targetAudience, broadcastModal.region, broadcastModal.kycTier]);

  const handleOpenTemplates = async () => {
    setTemplatesModal({ isOpen: true, templates: [], loading: true });
    try {
      const res = await api.getAdminNotificationTemplates();
      setTemplatesModal({ isOpen: true, templates: res.templates || [], loading: false });
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch templates', 'error');
      setTemplatesModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSelectTemplate = (tmpl: any) => {
    setBroadcastModal((prev) => ({
      ...prev,
      isOpen: true,
      title: tmpl.subject || tmpl.title,
      message: tmpl.body,
    }));
    setTemplatesModal((prev) => ({ ...prev, isOpen: false }));
    showToast(`Template "${tmpl.title}" loaded into broadcast builder`, 'info');
  };

  const handleSaveBroadcast = async () => {
    if (!broadcastModal.title.trim() || !broadcastModal.message.trim()) {
      showToast('Announcement title and message body are required', 'error');
      return;
    }

    setBroadcastModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const payload = {
        title: broadcastModal.title.trim(),
        message: broadcastModal.message.trim(),
        target_audience: broadcastModal.targetAudience,
        target_filter: {
          region: broadcastModal.region,
          kyc_tier: broadcastModal.kycTier,
        },
        priority: broadcastModal.priority,
        category: broadcastModal.category,
        channels: broadcastModal.channels,
        is_dismissible: broadcastModal.isDismissible,
        status: broadcastModal.sendImmediately ? 'sent' : 'draft',
      };

      const created = await api.createAdminAnnouncement(payload);

      if (broadcastModal.sendImmediately && created.announcement?.id) {
        await api.sendAdminAnnouncement(created.announcement.id);
        showToast('Announcement published and dispatched to recipients', 'success');
      } else {
        showToast('Announcement draft saved successfully', 'success');
      }

      setBroadcastModal((prev) => ({
        ...prev,
        isOpen: false,
        isSubmitting: false,
        title: '',
        message: '',
      }));
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.message || 'Failed to save announcement', 'error');
      setBroadcastModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleSendDraft = async (id: number | string) => {
    try {
      const res = await api.sendAdminAnnouncement(id);
      showToast(res.message || 'Broadcast transmitted successfully', 'success');
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.message || 'Failed to transmit announcement', 'error');
    }
  };

  const handleCancelAnnouncement = async (id: number | string) => {
    try {
      await api.cancelAdminAnnouncement(id);
      showToast('Announcement cancelled', 'info');
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel announcement', 'error');
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
    if (p === 'normal') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded-none uppercase tracking-wider">
          Normal
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
    if (s === 'sent') {
      return (
        <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-none">
          ✓ Dispatched
        </span>
      );
    }
    if (s === 'scheduled') {
      return (
        <span className="px-2.5 py-0.5 text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 rounded-none">
          Scheduled
        </span>
      );
    }
    if (s === 'draft') {
      return (
        <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 rounded-none">
          Draft
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 rounded-none">
        Cancelled
      </span>
    );
  };

  const columns: AdminTableColumn<any>[] = [
    {
      header: 'Title & Created',
      className: 'max-w-xs',
      render: (a: any) => (
        <div>
          <span className="font-bold text-gray-900 text-xs block line-clamp-1">{a.title}</span>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>
              {a.created_at
                ? new Date(a.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '—'}
            </span>
            {a.creator_name && <span>· by {a.creator_name}</span>}
          </div>
        </div>
      ),
    },
    {
      header: 'Priority',
      render: (a: any) => getPriorityBadge(a.priority),
    },
    {
      header: 'Category',
      render: (a: any) => (
        <span className="text-xs uppercase font-medium text-gray-700 bg-gray-100 px-2 py-0.5 border border-gray-200">
          {(a.category || 'general').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Audience & Filters',
      render: (a: any) => {
        const filter = a.target_filter || {};
        return (
          <div className="text-xs">
            <div className="font-bold text-gray-800 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-500" />
              <span>{a.target_audience ? a.target_audience.replace(/_/g, ' ') : 'All Users'}</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Region: {filter.region && filter.region !== 'all' ? filter.region : 'Nationwide'}
              {filter.kyc_tier && filter.kyc_tier !== 'all' ? ` · ${filter.kyc_tier}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Channels',
      render: (a: any) => (
        <div className="flex items-center gap-1">
          {(a.channels || ['in_app']).map((c: string) => (
            <span
              key={c}
              className="text-[10px] font-mono uppercase bg-emerald-50 text-[#1f5400] border border-emerald-200 px-1.5 py-0.2"
            >
              {c.replace(/_/g, '-')}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Delivered',
      render: (a: any) => (
        <div className="font-mono text-xs font-bold text-gray-900 tabular-nums">
          {Number(a.delivered_count || 0).toLocaleString()} recipients
        </div>
      ),
    },
    {
      header: 'Status',
      render: (a: any) => getStatusBadge(a.status),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (a: any) => {
        if (a.status === 'draft') {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => handleSendDraft(a.id)}
                className="px-2.5 py-1 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
              <button
                onClick={() => handleCancelAnnouncement(a.id)}
                className="px-2 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50"
              >
                Cancel
              </button>
            </div>
          );
        }
        return (
          <span className="text-[11px] text-gray-400 font-mono">
            {a.sent_at ? new Date(a.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Header */}
      <AdminPageHeader
        title="Platform Announcements & Broadcast Center"
        subtitle="Audience-targeted advisories, price corridor updates, weather alerts, and in-app notifications."
        icon="fa-tower-broadcast"
        badge={`${totalCount} Broadcasts`}
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Broadcast Center' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenTemplates}
              className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span>Notification Templates</span>
            </button>
            <button
              onClick={() =>
                setBroadcastModal((prev) => ({
                  ...prev,
                  isOpen: true,
                  title: '',
                  message: '',
                  targetAudience: 'all',
                  region: 'all',
                  kycTier: 'all',
                }))
              }
              className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Announcement</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Broadcasts</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.total_broadcasts || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Campaigns & alerts</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-[#1f5400] uppercase tracking-wider">Dispatched</p>
            <p className="text-2xl font-bold text-[#1f5400] mt-1 tabular-nums">
              {Number(metrics.sent_count || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">Live platform banners</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Scheduled</p>
            <p className="text-2xl font-bold text-purple-900 mt-1 tabular-nums">
              {Number(metrics.scheduled_count || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Future transmissions</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Drafts</p>
            <p className="text-2xl font-bold text-amber-900 mt-1 tabular-nums">
              {Number(metrics.draft_count || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Unsent broadcasts</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Total Reached</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.total_recipients_reached || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Cumulative receipts</p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white border border-gray-300 rounded-none p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <AdminTabs
              tabs={[
                { id: 'all', label: 'All Broadcasts', count: Number(metrics.total_broadcasts || 0) },
                { id: 'sent', label: 'Dispatched', count: Number(metrics.sent_count || 0) },
                { id: 'draft', label: 'Drafts', count: Number(metrics.draft_count || 0) },
                { id: 'scheduled', label: 'Scheduled', count: Number(metrics.scheduled_count || 0) },
                { id: 'cancelled', label: 'Cancelled' },
              ]}
              activeTab={statusTab}
              onChange={(t) => {
                setStatusTab(t);
                setPage(1);
              }}
            />

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter announcements by category"
                className="text-xs bg-white border border-gray-300 rounded-none px-3 py-1.5 focus:outline-none focus:border-[#1f5400] text-gray-700"
              >
                <option value="all">All Categories</option>
                <option value="system">System Notice</option>
                <option value="market_update">Market Corridor Update</option>
                <option value="weather_advisory">Weather Advisory</option>
                <option value="compliance">Compliance</option>
                <option value="general">General</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter announcements by priority"
                className="text-xs bg-white border border-gray-300 rounded-none px-3 py-1.5 focus:outline-none focus:border-[#1f5400] text-gray-700"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by announcement title, message content, or creator..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-none focus:outline-none focus:border-[#1f5400] bg-white text-gray-900"
            />
          </div>
        </div>

        {/* Announcements Table */}
        <div className="bg-white border border-gray-300 rounded-none overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-300 bg-[#FCF9F8] flex items-center justify-between">
            <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              System Broadcast Log & Audience Targeting
            </span>
            <span className="text-xs text-gray-500 tabular-nums">
              Showing {announcements.length} of {totalCount} records
            </span>
          </div>

          <AdminTable
            columns={columns}
            data={announcements}
            loading={loading}
            emptyTitle="No platform announcements found"
            emptyDescription={
              search || statusTab !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all'
                ? 'No announcements matched your current filters. Try resetting search parameters.'
                : 'No announcements have been issued yet. Click "Create Announcement" to compose a broadcast.'
            }
            emptyIcon="fa-bullhorn"
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

      {/* Broadcast Builder Modal */}
      <AdminModal
        isOpen={broadcastModal.isOpen}
        onClose={() => setBroadcastModal((prev) => ({ ...prev, isOpen: false }))}
        title="Compose System Announcement & Broadcast"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs font-bold flex items-center gap-1.5 text-gray-700">
              <Users className="w-4 h-4 text-[#007a6c]" />
              <span>Estimated Reach: </span>
              {broadcastModal.isEstimating ? (
                <span className="text-gray-400">Calculating...</span>
              ) : (
                <span className="font-mono text-[#1f5400] text-sm tabular-nums">
                  {broadcastModal.estimatedReach !== null
                    ? `${broadcastModal.estimatedReach.toLocaleString()} users`
                    : 'All matching active users'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setBroadcastModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={broadcastModal.isSubmitting}
                className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBroadcast}
                disabled={broadcastModal.isSubmitting}
                className="px-4 py-2 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {broadcastModal.isSubmitting ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Transmitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {broadcastModal.sendImmediately ? 'Dispatch Broadcast Now' : 'Save as Draft'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Broadcast Title *
            </label>
            <input
              type="text"
              value={broadcastModal.title}
              onChange={(e) => setBroadcastModal((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Mojo Cold Depot Operational Expansion"
              className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Message Content *
            </label>
            <textarea
              rows={4}
              value={broadcastModal.message}
              onChange={(e) => setBroadcastModal((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Enter the full operational bulletin or notice message..."
              className="w-full text-xs border border-gray-300 rounded-none p-2.5 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
            />
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 space-y-3">
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider block">
              Audience Targeting Matrix
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Target Roles</label>
                <select
                  value={broadcastModal.targetAudience}
                  onChange={(e) => setBroadcastModal((prev) => ({ ...prev, targetAudience: e.target.value }))}
                  className="w-full text-xs border border-gray-300 rounded-none p-1.5 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
                >
                  <option value="all">All Platform Users</option>
                  <option value="farmers_only">Farmers / Producers Only</option>
                  <option value="buyers_only">Commercial Buyers Only</option>
                  <option value="logistics_only">Logistics & Carriers Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Regional Corridor</label>
                <select
                  value={broadcastModal.region}
                  onChange={(e) => setBroadcastModal((prev) => ({ ...prev, region: e.target.value }))}
                  className="w-full text-xs border border-gray-300 rounded-none p-1.5 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
                >
                  <option value="all">Nationwide (All Regions)</option>
                  <option value="Oromia">Oromia</option>
                  <option value="Amhara">Amhara</option>
                  <option value="Sidama">Sidama</option>
                  <option value="SNNPR">SNNPR</option>
                  <option value="Tigray">Tigray</option>
                  <option value="Addis Ababa">Addis Ababa</option>
                  <option value="Dire Dawa">Dire Dawa</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">KYC Tier</label>
                <select
                  value={broadcastModal.kycTier}
                  onChange={(e) => setBroadcastModal((prev) => ({ ...prev, kycTier: e.target.value }))}
                  className="w-full text-xs border border-gray-300 rounded-none p-1.5 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
                >
                  <option value="all">All KYC Tiers</option>
                  <option value="tier_1">Tier 1 Basic</option>
                  <option value="tier_2">Tier 2 Verified Farm</option>
                  <option value="tier_3">Tier 3 Certified Cooperative</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={broadcastModal.category}
                onChange={(e) => setBroadcastModal((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
              >
                <option value="general">General Notice</option>
                <option value="system">System Maintenance</option>
                <option value="market_update">Market Price Index</option>
                <option value="weather_advisory">Weather Advisory</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={broadcastModal.priority}
                onChange={(e) => setBroadcastModal((prev) => ({ ...prev, priority: e.target.value }))}
                className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastModal.sendImmediately}
                onChange={(e) => setBroadcastModal((prev) => ({ ...prev, sendImmediately: e.target.checked }))}
                className="rounded-none border-gray-300 text-[#1f5400] focus:ring-0"
              />
              <span className="text-xs text-gray-800 font-medium">Transmit immediately upon saving</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastModal.isDismissible}
                onChange={(e) => setBroadcastModal((prev) => ({ ...prev, isDismissible: e.target.checked }))}
                className="rounded-none border-gray-300 text-[#1f5400] focus:ring-0"
              />
              <span className="text-xs text-gray-800 font-medium">Allow recipients to dismiss banner</span>
            </label>
          </div>
        </div>
      </AdminModal>

      {/* Notification Templates Modal */}
      <AdminModal
        isOpen={templatesModal.isOpen}
        onClose={() => setTemplatesModal((prev) => ({ ...prev, isOpen: false }))}
        title="Reusable Notification Templates"
        maxWidth="lg"
        footer={
          <div className="flex justify-end w-full">
            <button
              onClick={() => setTemplatesModal((prev) => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {templatesModal.loading ? (
            <div className="p-8 text-center text-gray-500">Loading templates...</div>
          ) : templatesModal.templates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No notification templates found.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {templatesModal.templates.map((tmpl) => (
                <div key={tmpl.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      <span>{tmpl.title}</span>
                      <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1 py-0.2">
                        {tmpl.code}
                      </span>
                    </div>
                    <p className="text-gray-600 text-[11px] mt-1 line-clamp-2">{tmpl.body}</p>
                    <div className="text-[10px] text-gray-400 font-mono mt-1">
                      Variables: {Array.isArray(tmpl.variables) ? tmpl.variables.join(', ') : 'none'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectTemplate(tmpl)}
                    className="px-3 py-1 bg-emerald-50 text-[#1f5400] border border-emerald-300 hover:bg-emerald-100 text-xs font-bold rounded-none shrink-0"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}


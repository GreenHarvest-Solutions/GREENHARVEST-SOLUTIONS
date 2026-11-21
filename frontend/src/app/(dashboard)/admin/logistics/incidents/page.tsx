'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  ThermometerSnowflake,
  Truck,
  RotateCcw,
  FileCheck2,
  Wrench,
  Navigation,
  ExternalLink,
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

export default function AdminLogisticsIncidentsPage() {
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    total_incidents: 0,
    unresolved_count: 0,
    critical_unresolved: 0,
    temperature_breaches: 0,
    route_deviations: 0,
    mechanical_failures: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<'all' | 'false' | 'true'>('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Resolution Modal State
  const [resolveModal, setResolveModal] = useState<{
    isOpen: boolean;
    incident: any | null;
    resolutionNotes: string;
    correctiveAction: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    incident: null,
    resolutionNotes: '',
    correctiveAction: 'Reefer compressor serviced and restarted',
    isSubmitting: false,
  });

  // View Details Modal State (for already resolved incidents)
  const [viewModal, setViewModal] = useState<{
    isOpen: boolean;
    incident: any | null;
  }>({
    isOpen: false,
    incident: null,
  });

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminIncidents({
        severity: severityFilter === 'all' ? undefined : severityFilter,
        resolved: statusTab === 'all' ? undefined : statusTab,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      if (res) {
        setIncidents(res.incidents || []);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
        if (res.pagination) {
          setTotalPages(res.pagination.total_pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch logistics incidents', 'error');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusTab, search, page, showToast]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleResolveSubmit = async () => {
    if (!resolveModal.incident) return;
    if (!resolveModal.resolutionNotes.trim()) {
      showToast('Resolution notes detailing root cause are required', 'error');
      return;
    }

    setResolveModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.resolveAdminIncident(resolveModal.incident.id, {
        resolution_notes: resolveModal.resolutionNotes.trim(),
        corrective_action: resolveModal.correctiveAction,
      });

      showToast(res.message || 'Incident resolved and logged successfully', 'success');
      setResolveModal({
        isOpen: false,
        incident: null,
        resolutionNotes: '',
        correctiveAction: 'Reefer compressor serviced and restarted',
        isSubmitting: false,
      });
      fetchIncidents();
    } catch (err: any) {
      showToast(err.message || 'Failed to resolve incident', 'error');
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

  const getTypeBadge = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('temp') || t.includes('spike') || t.includes('chill')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200">
          <ThermometerSnowflake className="w-3 h-3 text-red-600" />
          Temp Breach
        </span>
      );
    }
    if (t.includes('route') || t.includes('deviat')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <Navigation className="w-3 h-3 text-purple-600" />
          Route Deviation
        </span>
      );
    }
    if (t.includes('mech') || t.includes('engine') || t.includes('fail')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <Wrench className="w-3 h-3 text-amber-600" />
          Mechanical
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
        <AlertTriangle className="w-3 h-3 text-gray-500" />
        {type.replace(/_/g, ' ')}
      </span>
    );
  };

  const columns: AdminTableColumn<any>[] = [
    {
      header: 'Incident ID & Time',
      render: (inc: any) => (
        <div>
          <span className="font-mono text-xs font-bold text-gray-900 tabular-nums">
            #INC-{inc.id}
          </span>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>
              {inc.created_at
                ? new Date(inc.created_at).toLocaleDateString('en-US', {
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
      render: (inc: any) => getSeverityBadge(inc.severity),
    },
    {
      header: 'Shipment & Fleet Unit',
      render: (inc: any) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/admin/deliveries?search=${encodeURIComponent(inc.shipment_id)}`}
              className="font-mono text-xs font-bold text-[#1f5400] hover:underline flex items-center gap-1"
            >
              <span>{inc.shipment_id}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="text-xs text-gray-700 font-medium mt-0.5 flex items-center gap-1">
            <Truck className="w-3 h-3 text-gray-400" />
            <span>{inc.vehicle_plate || 'Unassigned'}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{inc.carrier_partner || 'Fleet'}</span>
          </div>
          {inc.driver_name && (
            <div className="text-[11px] text-gray-500">
              {inc.driver_name} {inc.driver_phone ? `(${inc.driver_phone})` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Incident Type & Location',
      render: (inc: any) => (
        <div>
          <div>{getTypeBadge(inc.incident_type)}</div>
          <div className="text-xs text-gray-600 mt-1">
            <span className="font-medium text-gray-700">Checkpoint:</span>{' '}
            {inc.checkpoint || 'En Route Corridor'}
          </div>
        </div>
      ),
    },
    {
      header: 'Telemetry Temp',
      render: (inc: any) => {
        if (inc.recorded_temperature_c !== null && inc.recorded_temperature_c !== undefined) {
          const temp = Number(inc.recorded_temperature_c);
          const isBreached = temp > 4 || temp < 0;
          return (
            <div
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold border tabular-nums ${
                isBreached
                  ? 'bg-red-50 text-red-800 border-red-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
            >
              <ThermometerSnowflake className="w-3 h-3" />
              <span>
                {temp > 0 ? '+' : ''}
                {temp.toFixed(1)}°C
              </span>
            </div>
          );
        }
        return <span className="text-xs text-gray-400">—</span>;
      },
    },
    {
      header: 'Description & Root Cause',
      className: 'max-w-xs',
      render: (inc: any) => (
        <div>
          <p className="text-xs text-gray-900 line-clamp-2">{inc.description}</p>
          {Boolean(inc.is_resolved) && inc.resolution_notes && (
            <div className="mt-1 pt-1 border-t border-gray-100 text-[11px] text-emerald-800">
              <span className="font-bold">Remedy:</span> {inc.resolution_notes}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Resolution Status',
      render: (inc: any) => {
        const isResolved = Boolean(inc.is_resolved);
        if (isResolved) {
          return (
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-none">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                Resolved
              </span>
              {inc.resolver_name && (
                <div className="text-[10px] text-gray-500 mt-0.5">by {inc.resolver_name}</div>
              )}
            </div>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-red-50 text-red-800 border border-red-300 rounded-none">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Action Required
          </span>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      render: (inc: any) => {
        const isResolved = Boolean(inc.is_resolved);
        if (!isResolved) {
          return (
            <button
              onClick={() =>
                setResolveModal({
                  isOpen: true,
                  incident: inc,
                  resolutionNotes: '',
                  correctiveAction: 'Reefer compressor serviced and restarted',
                  isSubmitting: false,
                })
              }
              className="px-3 py-1 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-none transition-colors"
            >
              Resolve
            </button>
          );
        }
        return (
          <button
            onClick={() =>
              setViewModal({
                isOpen: true,
                incident: inc,
              })
            }
            className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Details
          </button>
        );
      },
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Top Header */}
      <AdminPageHeader
        title="Cold-Chain Incident Queue"
        subtitle="Real-time SLA breaches, temperature spikes, mechanical breakdowns, and route deviation root-cause resolution."
        icon="fa-triangle-exclamation"
        badge={`${totalCount} Incidents`}
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Logistics', href: '/admin/deliveries' },
          { label: 'Incident Queue' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/deliveries"
              className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5 text-gray-500" />
              <span>Live Fleet Map</span>
            </Link>
            <Link
              href="/admin/logistics/hubs"
              className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <span>Hubs & Depots</span>
            </Link>
            <Link
              href="/admin/logistics/carriers"
              className="px-3.5 py-1.5 text-xs font-medium text-[#1f5400] bg-emerald-50 border border-emerald-300 rounded-none hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <span>Carrier Partners</span>
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Metric Cards KPI Strip (Section 3 Design Contract) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Incidents</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.total_incidents || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Historical event log</p>
          </div>

          <div
            className={`border rounded-none p-4 text-center ${
              Number(metrics.unresolved_count || 0) > 0
                ? 'bg-red-50/50 border-red-300'
                : 'bg-white border-gray-300'
            }`}
          >
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Active Breaches</p>
            <p className="text-2xl font-bold text-red-600 mt-1 tabular-nums">
              {Number(metrics.unresolved_count || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-red-600/80 mt-0.5">Requiring intervention</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Critical Spikes</p>
            <p className="text-2xl font-bold text-amber-800 mt-1 tabular-nums">
              {Number(metrics.critical_unresolved || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Immediate spoilage risk</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Temp Breaches</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.temperature_breaches || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Out of cold limits</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Route Deviations</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.route_deviations || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Geofence drift & delays</p>
          </div>

          <div className="bg-white border border-gray-300 rounded-none p-4 text-center">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Mechanical Issues</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {Number(metrics.mechanical_failures || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Truck / Reefer units</p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white border border-gray-300 rounded-none p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Status Tabs */}
            <AdminTabs
              tabs={[
                { id: 'all', label: 'All Incidents', count: Number(metrics.total_incidents || 0) },
                { id: 'false', label: 'Active & Unresolved', count: Number(metrics.unresolved_count || 0) },
                {
                  id: 'true',
                  label: 'Resolved',
                  count: Math.max(0, Number(metrics.total_incidents || 0) - Number(metrics.unresolved_count || 0)),
                },
              ]}
              activeTab={statusTab}
              onChange={(t) => {
                setStatusTab(t as any);
                setPage(1);
              }}
            />

            {/* Severity Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Severity:</label>
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter incidents by severity level"
                className="text-xs bg-white border border-gray-300 rounded-none px-3 py-1.5 focus:outline-none focus:border-[#1f5400] text-gray-700"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical Only</option>
                <option value="high">High Severity</option>
                <option value="medium">Medium Severity</option>
                <option value="low">Low Severity</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by shipment ID, license plate, checkpoint, or incident description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-none focus:outline-none focus:border-[#1f5400] bg-white text-gray-900"
            />
          </div>
        </div>

        {/* Incidents Table */}
        <div className="bg-white border border-gray-300 rounded-none overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-300 bg-[#FCF9F8] flex items-center justify-between">
            <span className="text-xs font-bold text-[#007a6c] uppercase tracking-wider">
              Cold-Chain Incident Registry & Telemetry Breaches
            </span>
            <span className="text-xs text-gray-500 tabular-nums">
              Showing {incidents.length} of {totalCount} records
            </span>
          </div>

          <AdminTable
            columns={columns}
            data={incidents}
            loading={loading}
            emptyTitle="No cold-chain incidents found"
            emptyDescription={
              search || statusTab !== 'all' || severityFilter !== 'all'
                ? 'No incidents matched your current filters. Try clearing your search parameters.'
                : 'The cold chain fleet is operating normally with zero recorded breach incidents.'
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

      {/* Resolution Modal */}
      <AdminModal
        isOpen={resolveModal.isOpen}
        onClose={() => setResolveModal((prev) => ({ ...prev, isOpen: false }))}
        title={`Resolve Cold-Chain Incident #INC-${resolveModal.incident?.id || ''}`}
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
                  <span>Confirm Resolution & Close Incident</span>
                </>
              )}
            </button>
          </div>
        }
      >
        {resolveModal.incident && (
          <div className="space-y-4 text-xs">
            {/* Incident Summary Card */}
            <div className="p-3 bg-gray-50 border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-gray-900">
                  Shipment: {resolveModal.incident.shipment_id}
                </span>
                {getSeverityBadge(resolveModal.incident.severity)}
              </div>
              <p className="text-gray-700">{resolveModal.incident.description}</p>
              <div className="flex items-center gap-4 text-gray-500 text-[11px]">
                <span>Plate: {resolveModal.incident.vehicle_plate || 'Unassigned'}</span>
                <span>Location: {resolveModal.incident.checkpoint || 'In Transit'}</span>
                {resolveModal.incident.recorded_temperature_c !== null && (
                  <span className="font-bold text-red-700">
                    Temp: {resolveModal.incident.recorded_temperature_c}°C
                  </span>
                )}
              </div>
            </div>

            {/* Corrective Action Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Primary Corrective Action Taken *
              </label>
              <select
                value={resolveModal.correctiveAction}
                onChange={(e) =>
                  setResolveModal((prev) => ({
                    ...prev,
                    correctiveAction: e.target.value,
                  }))
                }
                className="w-full text-xs border border-gray-300 rounded-none p-2 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
              >
                <option value="Reefer compressor serviced and restarted">
                  Reefer compressor serviced and restarted
                </option>
                <option value="Diverted cargo to nearest regional cold depot">
                  Diverted cargo to nearest regional cold depot
                </option>
                <option value="Transloaded fresh produce to backup carrier vehicle">
                  Transloaded fresh produce to backup carrier vehicle
                </option>
                <option value="Telemetry sensor calibrated; verified actual temp safe">
                  Telemetry sensor calibrated; verified actual temp safe
                </option>
                <option value="Authorized expedited direct route to destination">
                  Authorized expedited direct route to destination
                </option>
                <option value="Consignment written off for insurance / buyer claim initiated">
                  Consignment written off for insurance / buyer claim initiated
                </option>
              </select>
            </div>

            {/* Root-Cause and Resolution Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Investigation Findings & Root Cause Analysis *
              </label>
              <textarea
                rows={4}
                value={resolveModal.resolutionNotes}
                onChange={(e) =>
                  setResolveModal((prev) => ({
                    ...prev,
                    resolutionNotes: e.target.value,
                  }))
                }
                placeholder="Explain the technical root cause (e.g., alternator voltage drop, sensor wire fault, traffic bottleneck) and verify cargo stability before closing..."
                className="w-full text-xs border border-gray-300 rounded-none p-2.5 bg-white text-gray-900 focus:outline-none focus:border-[#1f5400]"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                This entry will be recorded in the immutable audit ledger with your operator ID and timestamp.
              </p>
            </div>
          </div>
        )}
      </AdminModal>

      {/* View Details Modal */}
      <AdminModal
        isOpen={viewModal.isOpen}
        onClose={() => setViewModal({ isOpen: false, incident: null })}
        title={`Incident #INC-${viewModal.incident?.id || ''} Details`}
        maxWidth="md"
        footer={
          <div className="flex justify-end w-full">
            <button
              onClick={() => setViewModal({ isOpen: false, incident: null })}
              className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors rounded-none"
            >
              Close
            </button>
          </div>
        }
      >
        {viewModal.incident && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-gray-50 border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-gray-900">
                  Shipment: {viewModal.incident.shipment_id}
                </span>
                {getSeverityBadge(viewModal.incident.severity)}
              </div>
              <p className="text-gray-700">{viewModal.incident.description}</p>
            </div>

            <div className="border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Resolved by {viewModal.incident.resolver_name || 'Admin'}</span>
              </div>
              {viewModal.incident.resolved_at && (
                <div className="text-[11px] text-gray-500">
                  Resolved on:{' '}
                  {new Date(viewModal.incident.resolved_at).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              )}
              {viewModal.incident.corrective_action && (
                <div className="mt-2 text-xs">
                  <span className="font-bold text-gray-800">Corrective Action: </span>
                  <span className="text-gray-700">{viewModal.incident.corrective_action}</span>
                </div>
              )}
              {viewModal.incident.resolution_notes && (
                <div className="mt-1 text-xs">
                  <span className="font-bold text-gray-800">Remedy & Notes: </span>
                  <span className="text-gray-700">{viewModal.incident.resolution_notes}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

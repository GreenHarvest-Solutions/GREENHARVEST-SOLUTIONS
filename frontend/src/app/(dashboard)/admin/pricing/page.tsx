'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Edit2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminModal,
} from '@/components/admin/ui';

export default function AdminPricingCorridorsPage() {
  const { showToast } = useToast();
  const [corridors, setCorridors] = useState<any[]>([]);
  const [outliers, setOutliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [commodityName, setCommodityName] = useState('');
  const [region, setRegion] = useState('Oromia');
  const [minPrice, setMinPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [unit, setUnit] = useState('kg');
  const [deviationThreshold, setDeviationThreshold] = useState('15.0');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      api.getPriceCorridors({
        region: regionFilter !== 'all' ? regionFilter : undefined,
        commodity: search || undefined,
      }),
      api.getPriceOutliers(),
    ])
      .then(([corridorsRes, outliersRes]) => {
        if (!isMounted) return;
        setCorridors(corridorsRes.corridors || []);
        setOutliers(outliersRes.outliers || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast(err?.response?.data?.message || 'Failed to load pricing data', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [regionFilter, search, showToast, refreshKey]);

  const handleOpenUpsert = (existing?: any) => {
    if (existing) {
      setCommodityName(existing.commodity_name);
      setRegion(existing.region);
      setMinPrice(String(existing.min_price));
      setTargetPrice(String(existing.target_price));
      setMaxPrice(String(existing.max_price));
      setUnit(existing.unit || 'kg');
      setDeviationThreshold(String(existing.deviation_threshold_pct || 15.0));
    } else {
      setCommodityName('');
      setRegion('Oromia');
      setMinPrice('');
      setTargetPrice('');
      setMaxPrice('');
      setUnit('kg');
      setDeviationThreshold('15.0');
    }
    setModalOpen(true);
  };

  const handleSaveCorridor = async () => {
    if (!commodityName || !region || !minPrice || !targetPrice || !maxPrice) {
      showToast('All pricing fields are required', 'error');
      return;
    }

    if (parseFloat(minPrice) >= parseFloat(maxPrice)) {
      showToast('Minimum floor must be less than maximum ceiling', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.upsertPriceCorridor({
        commodity_name: commodityName.trim(),
        region,
        min_price: parseFloat(minPrice),
        target_price: parseFloat(targetPrice),
        max_price: parseFloat(maxPrice),
        unit,
        deviation_threshold_pct: parseFloat(deviationThreshold) || 15.0,
      });

      showToast(`Price corridor saved for ${commodityName} in ${region}`, 'success');
      setModalOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to save price corridor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const outlierColumns = [
    {
      key: 'product',
      header: 'Outlier Produce Listing',
      render: (row: any) => (
        <div>
          <Link
            href={`/admin/products/${row.id}`}
            className="font-bold text-gray-900 hover:text-[#007a6c] transition-colors"
          >
            {row.product_name}
          </Link>
          <div className="text-xs text-gray-500">
            Producer: {row.farmer_name} • Region: {row.region}
          </div>
        </div>
      ),
    },
    {
      key: 'current_price',
      header: 'Listed Price',
      render: (row: any) => (
        <span className="font-bold text-gray-900 tabular-nums text-xs">
          ETB {Number(row.price).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'corridor_range',
      header: 'Permitted Corridor',
      render: (row: any) => (
        <div className="text-xs tabular-nums text-gray-700">
          ETB {Number(row.corridor_min).toFixed(2)} – {Number(row.corridor_max).toFixed(2)}
          <div className="text-gray-500 font-normal">
            Target: ETB {Number(row.corridor_target).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      key: 'deviation',
      header: 'Deviation & Alert',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-xs font-bold uppercase border ${
              row.outlier_type === 'ABOVE_MAX'
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {row.outlier_type === 'ABOVE_MAX' ? 'Gouging Alert' : 'Dumping Risk'}
          </span>
          <span className="text-xs font-mono tabular-nums text-gray-600">
            {row.deviation_pct > 0 ? `+${row.deviation_pct}%` : `${row.deviation_pct}%`}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right' as const,
      render: (row: any) => (
        <Link
          href={`/admin/products/${row.id}`}
          className="px-2.5 py-1 text-xs font-semibold text-[#007a6c] bg-white border border-[#007a6c] hover:bg-teal-50 inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          Review Listing
        </Link>
      ),
    },
  ];

  const corridorColumns = [
    {
      key: 'commodity',
      header: 'Commodity',
      render: (row: any) => (
        <div className="font-bold text-gray-900">{row.commodity_name}</div>
      ),
    },
    {
      key: 'region',
      header: 'Region / Market',
      render: (row: any) => (
        <span className="text-xs text-gray-700 font-medium">{row.region}</span>
      ),
    },
    {
      key: 'target_price',
      header: 'Benchmark Target',
      render: (row: any) => (
        <span className="text-xs font-bold text-[#007a6c] tabular-nums">
          ETB {Number(row.target_price).toFixed(2)} / {row.unit}
        </span>
      ),
    },
    {
      key: 'floor_ceiling',
      header: 'Corridor Bands (Min – Max)',
      render: (row: any) => (
        <span className="text-xs font-medium text-gray-800 tabular-nums">
          ETB {Number(row.min_price).toFixed(2)} – {Number(row.max_price).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'threshold',
      header: 'Tolerance %',
      render: (row: any) => (
        <span className="text-xs text-gray-600 font-mono tabular-nums">
          ±{row.deviation_threshold_pct}%
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Last Updated',
      render: (row: any) => (
        <span className="text-xs text-gray-500 tabular-nums">
          {new Date(row.updated_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Edit',
      align: 'right' as const,
      render: (row: any) => (
        <button
          onClick={() => handleOpenUpsert(row)}
          className="p-1 text-gray-600 hover:text-[#007a6c] border border-gray-300 hover:bg-gray-50 transition-colors"
          title="Edit corridor"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#FCF9F8] p-6 space-y-6">
      <AdminPageHeader
        title="Commodity Price Corridors & Anti-Gouging Watch"
        subtitle="Maintain stable regional farmgate and wholesale corridors to prevent price gouging and predatory dumping."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Catalog Governance', href: '/admin/products' },
          { label: 'Price Corridors' },
        ]}
        actions={
          <button
            onClick={() => handleOpenUpsert()}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#007a6c] hover:bg-[#005f54] flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Set Price Corridor
          </button>
        }
      />

      {/* Outlier Watch Card */}
      <div className="bg-white border border-gray-300 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-900">
              Active Outlier Alerts ({outliers.length})
            </h2>
          </div>
          <span className="text-xs text-gray-500">
            Real-time discrepancy check against published corridors
          </span>
        </div>

        <AdminTable
          columns={outlierColumns}
          data={outliers}
          loading={loading}
          keyExtractor={(row) => String(row.id)}
          emptyMessage="No price outliers detected. All active listings are priced within regional corridors."
        />
      </div>

      {/* Corridors Directory */}
      <div className="bg-white border border-gray-300 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#007a6c]">
            Regional Benchmark Corridors ({corridors.length})
          </h2>
        </div>

        <AdminToolbar
          searchPlaceholder="Filter corridors by commodity..."
          searchValue={search}
          onSearchChange={setSearch}
          filters={[
            {
              key: 'region',
              label: 'Region',
              value: regionFilter,
              options: [
                { label: 'All Regions', value: 'all' },
                { label: 'Oromia', value: 'Oromia' },
                { label: 'Amhara', value: 'Amhara' },
                { label: 'Sidama', value: 'Sidama' },
                { label: 'SNNPR', value: 'SNNPR' },
                { label: 'Tigray', value: 'Tigray' },
              ],
              onChange: setRegionFilter,
            },
          ]}
        />

        <AdminTable
          columns={corridorColumns}
          data={corridors}
          loading={loading}
          keyExtractor={(row) => String(row.id)}
          emptyMessage="No price corridors configured."
        />
      </div>

      {/* Upsert Corridor Modal */}
      <AdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Set Regional Commodity Price Corridor"
        description="Corridors establish the allowable trading band for produce to protect buyers and farmers."
      >
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Commodity Name *
              </label>
              <input
                type="text"
                value={commodityName}
                onChange={(e) => setCommodityName(e.target.value)}
                placeholder="e.g. White Teff / Hass Avocado"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Region / Market *
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:border-[#007a6c]"
              >
                <option value="Oromia">Oromia</option>
                <option value="Amhara">Amhara</option>
                <option value="Sidama">Sidama</option>
                <option value="SNNPR">SNNPR</option>
                <option value="Tigray">Tigray</option>
                <option value="Afar">Afar</option>
                <option value="Benishangul-Gumuz">Benishangul-Gumuz</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Floor (Min ETB) *
              </label>
              <input
                type="number"
                step="0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="e.g. 80.00"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Target (ETB) *
              </label>
              <input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g. 95.00"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Ceiling (Max ETB) *
              </label>
              <input
                type="number"
                step="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="e.g. 115.00"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Unit of Measure
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg, quintal, bunch"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tolerance % (Threshold)
              </label>
              <input
                type="number"
                step="0.5"
                value={deviationThreshold}
                onChange={(e) => setDeviationThreshold(e.target.value)}
                placeholder="15.0"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCorridor}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#007a6c] hover:bg-[#005f54] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Price Corridor'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


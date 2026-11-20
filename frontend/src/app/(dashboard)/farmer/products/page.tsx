'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

export default function ManageProductsPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'All' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'draft'>('All');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const stockStatus =
        activeTab === 'in_stock' || activeTab === 'low_stock' || activeTab === 'out_of_stock'
          ? activeTab
          : undefined;

      const [productsRes, categoriesRes] = await Promise.all([
        api.getFarmerProducts({
          page,
          limit: 10,
          search: searchQuery.trim() || undefined,
          category: categoryFilter !== 'All' ? categoryFilter : undefined,
          stock_status: stockStatus,
        }),
        api.getCategories().catch(() => ({ categories: [] })),
      ]);

      let items = productsRes.products || [];
      if (activeTab === 'draft') {
        items = items.filter((p: any) => p.status === 'draft');
      }

      setProducts(items);
      setTotalPages(productsRes.pagination?.total_pages || 1);
      setTotalProducts(productsRes.pagination?.total || 0);
      setCategories(categoriesRes.categories || []);
    } catch (err) {
      console.error('Failed to load farmer products:', err);
      showError('Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [page, activeTab, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadProducts();
  };

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set<number>(products.map((p) => p.id));
      setSelectedItems(allIds);
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleToggleSelectItem = (id: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatusChange = async (productId: number, newStatus: 'active' | 'draft' | 'deactivated') => {
    try {
      await api.updateProductStatus(productId, newStatus);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: newStatus } : p))
      );
      showSuccess(`Product marked as ${newStatus}`);
    } catch (err: any) {
      console.error('Failed to update product status:', err);
      showError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this produce from your catalog?')) return;
    setDeletingId(id);
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showSuccess('Product deleted successfully');
    } catch (err: any) {
      console.error('Delete failed:', err);
      showError(err.response?.data?.message || 'Failed to delete product');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBatchStatus = async (status: 'active' | 'draft' | 'deactivated') => {
    if (selectedItems.size === 0) return;
    try {
      const ids = Array.from(selectedItems);
      await api.batchUpdateProductsStatus(ids, status);
      setProducts((prev) =>
        prev.map((p) => (selectedItems.has(p.id) ? { ...p, status } : p))
      );
      setSelectedItems(new Set());
      showSuccess(`${ids.length} products updated to ${status}`);
    } catch (err: any) {
      console.error('Batch status update failed:', err);
      showError(err.response?.data?.message || 'Batch update failed');
    }
  };

  // Metrics summary
  const activeCount = products.filter((p) => p.status === 'active' && p.stock > 0).length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 50).length;
  const outOfStockCount = products.filter((p) => Number(p.stock) === 0).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-8 bg-[#fafafa]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Produce Catalog & Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Manage, update, and track your agricultural harvest stock.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/farmer/products/new"
            className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Add New Produce
          </Link>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Total Listed</span>
            <span className="text-xl font-bold text-gray-900">{totalProducts}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Active & Available</span>
            <span className="text-xl font-bold text-gray-900">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Low Stock Alert</span>
            <span className="text-xl font-bold text-amber-600">{lowStockCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">production_quantity_limits</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Sold Out</span>
            <span className="text-xl font-bold text-red-600">{outOfStockCount}</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        {/* Controls: Tabs & Search Filter */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto max-w-full">
            {(
              [
                { label: 'All Crops', val: 'All' },
                { label: 'In Stock', val: 'in_stock' },
                { label: 'Low Stock', val: 'low_stock' },
                { label: 'Sold Out', val: 'out_of_stock' },
                { label: 'Drafts', val: 'draft' },
              ] as const
            ).map((t) => (
              <button
                key={t.val}
                type="button"
                onClick={() => {
                  setActiveTab(t.val);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === t.val ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
              <input
                type="text"
                placeholder="Search crops by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] w-48 sm:w-60 font-medium"
              />
            </form>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Batch Operations Toolbar */}
        {selectedItems.size > 0 && (
          <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-100 flex items-center justify-between text-xs font-semibold text-emerald-800">
            <span>{selectedItems.size} produce items selected</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBatchStatus('active')}
                className="px-3 py-1 bg-white hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
              >
                Publish Active
              </button>
              <button
                type="button"
                onClick={() => handleBatchStatus('draft')}
                className="px-3 py-1 bg-white hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
              >
                Move to Draft
              </button>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="p-4 pl-6 w-10">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selectedItems.size === products.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 text-[#16a34a] rounded focus:ring-emerald-500 border-gray-300"
                  />
                </th>
                <th className="p-4">Produce</th>
                <th className="p-4">Category</th>
                <th className="p-4">Rate (ETB)</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <div className="w-8 h-8 border-3 border-[#16a34a] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading your harvest catalog...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#16a34a] flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-3xl">spa</span>
                    </div>
                    <p className="font-bold text-gray-800 text-base mb-1">No produce found</p>
                    <p className="text-xs text-gray-400 mb-4">Start selling by adding your first agricultural crop.</p>
                    <Link
                      href="/farmer/products/new"
                      className="px-4 py-2 bg-[#16a34a] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      Add Produce
                    </Link>
                  </td>
                </tr>
              ) : (
                products.map((item) => {
                  const isLow = Number(item.stock) > 0 && Number(item.stock) <= 50;
                  const isOut = Number(item.stock) === 0;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => handleToggleSelectItem(item.id)}
                          className="w-4 h-4 text-[#16a34a] rounded focus:ring-emerald-500 border-gray-300"
                        />
                      </td>

                      {/* Name & Image */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200 relative">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <span className="material-symbols-outlined text-xl">grain</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block hover:text-[#16a34a] transition-colors">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.is_organic && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded-sm">
                                  Organic
                                </span>
                              )}
                              <span className="text-[11px] text-gray-400">ID: #{item.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4 text-xs font-medium text-gray-600">
                        {item.category_name || 'Agricultural Produce'}
                      </td>

                      {/* Price */}
                      <td className="p-4">
                        <div className="font-bold text-gray-900">
                          ETB {Number(item.price).toLocaleString()}
                          <span className="text-xs text-gray-400 font-normal ml-1">/ {item.unit || 'kg'}</span>
                        </div>
                        {item.discount_price && (
                          <span className="text-xs text-emerald-600 font-semibold block">
                            Disc: ETB {Number(item.discount_price).toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Stock Badge */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isOut
                              ? 'bg-red-50 text-red-700'
                              : isLow
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {item.stock} {item.unit || 'kg'}
                        </span>
                      </td>

                      {/* Status Dropdown */}
                      <td className="p-4">
                        <select
                          value={item.status || 'active'}
                          onChange={(e) =>
                            handleStatusChange(item.id, e.target.value as 'active' | 'draft' | 'deactivated')
                          }
                          className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors ${
                            item.status === 'active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : item.status === 'draft'
                              ? 'border-gray-200 bg-gray-100 text-gray-600'
                              : 'border-red-200 bg-red-50 text-red-700'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                          <option value="deactivated">Deactivated</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/farmer/products/edit/${item.id}`}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
                            title="Edit produce"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(item.id)}
                            disabled={deletingId === item.id}
                            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
                            title="Delete produce"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Page {page} of {totalPages} ({totalProducts} total crops)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

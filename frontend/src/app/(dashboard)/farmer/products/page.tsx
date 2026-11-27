'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'stock_asc' | 'best_selling' | 'name_asc';
type TraitFilter = 'all' | 'organic' | 'discounted' | 'revision_pending';
type StatusFilter =
  | 'all'
  | 'active'
  | 'draft'
  | 'deactivated'
  | 'mod_pending'
  | 'mod_changes'
  | 'mod_rejected';

export default function ManageProductsPage() {
  const { showSuccess, showError } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);

  // View & UI Controls
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Search & Multi-Faceted Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [traitFilter, setTraitFilter] = useState<TraitFilter>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Batch & Modal Action State
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  // Modals (Stock Quick-Edit & Delete Confirmation)
  const [stockModalItem, setStockModalItem] = useState<any | null>(null);
  const [stockInput, setStockInput] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    mode: 'single' | 'batch';
    item?: any;
    ids?: number[];
  } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Server Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const prevDebouncedSearchRef = useRef('');

  // Debounce search query for server pagination
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const timer = setTimeout(() => {
      if (trimmed !== prevDebouncedSearchRef.current) {
        prevDebouncedSearchRef.current = trimmed;
        setDebouncedSearch(trimmed);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close 3-dot dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuId === null) return;
      const target = e.target as HTMLElement;
      if (!target.closest('[data-row-menu]')) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
        setStockModalItem(null);
        setDeleteTarget(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        api.getFarmerProducts({
          page,
          limit: pageSize,
          search: debouncedSearch || undefined,
          category: categoryFilter !== 'All' ? categoryFilter : undefined,
          stock_status: stockFilter !== 'all' ? stockFilter : undefined,
        }),
        api.getCategories().catch(() => ({ categories: [] })),
      ]);

      const items = productsRes.products || [];
      setProducts(items);
      setTotalPages(Math.max(1, productsRes.pagination?.total_pages || 1));
      setTotalProducts(productsRes.pagination?.total ?? items.length);
      setCategories(categoriesRes.categories || []);
    } catch (err) {
      console.error('Failed to load farmer products:', err);
      showError('Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, categoryFilter, stockFilter, showError]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchQuery.trim());
    setPage(1);
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setCategoryFilter('All');
    setStockFilter('all');
    setStatusFilter('all');
    setTraitFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setPage(1);
  };

  // Client-side refinement for moderation, traits, price range & sorting
  const displayProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minP = minPrice !== '' ? Number(minPrice) : null;
    const maxP = maxPrice !== '' ? Number(maxPrice) : null;

    const filtered = products.filter((item) => {
      if (q) {
        const haystack = [
          item.name,
          String(item.id),
          item.category_name,
          item.farm_location,
          item.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (statusFilter === 'active' && item.status !== 'active') return false;
      if (statusFilter === 'draft' && item.status !== 'draft') return false;
      if (statusFilter === 'deactivated' && item.status !== 'deactivated') return false;
      if (statusFilter === 'mod_pending' && item.moderation_status !== 'pending') return false;
      if (statusFilter === 'mod_changes' && item.moderation_status !== 'changes_requested')
        return false;
      if (statusFilter === 'mod_rejected' && item.moderation_status !== 'rejected') return false;

      if (traitFilter === 'organic' && !item.is_organic) return false;
      if (traitFilter === 'discounted' && !item.discount_price) return false;
      if (traitFilter === 'revision_pending' && !(Number(item.pending_revisions_count) > 0))
        return false;

      const effectivePrice = Number(item.discount_price || item.price || 0);
      if (minP !== null && !isNaN(minP) && effectivePrice < minP) return false;
      if (maxP !== null && !isNaN(maxP) && effectivePrice > maxP) return false;

      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return Number(a.price) - Number(b.price);
        case 'price_desc':
          return Number(b.price) - Number(a.price);
        case 'stock_asc':
          return Number(a.stock || 0) - Number(b.stock || 0);
        case 'best_selling':
          return Number(b.units_sold || 0) - Number(a.units_sold || 0);
        case 'name_asc':
          return String(a.name || '').localeCompare(String(b.name || ''));
        case 'newest':
        default:
          return Number(b.id) - Number(a.id);
      }
    });
  }, [products, searchQuery, statusFilter, traitFilter, minPrice, maxPrice, sortBy]);

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (categoryFilter !== 'All') count++;
    if (stockFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (traitFilter !== 'all') count++;
    if (minPrice !== '' || maxPrice !== '') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [categoryFilter, stockFilter, statusFilter, traitFilter, minPrice, maxPrice, sortBy]);

  const hasAnyFilter = searchQuery.trim() !== '' || activeAdvancedCount > 0;
  const hasSelection = selectedItems.size > 0;

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItems(new Set<number>(displayProducts.map((p) => p.id)));
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

  // CSV Export (Wired to GET /api/dashboard/farmer/products/export-csv)
  const handleExportCsv = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      await api.exportFarmerProductsCSV();
      showSuccess('Catalog exported to CSV');
    } catch (err: any) {
      console.error('CSV export failed:', err);
      showError(err?.message || 'Failed to export products CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  // Single Status Change (Wired to PATCH /api/products/:id/status)
  const handleStatusChange = async (
    productId: number,
    newStatus: 'active' | 'draft' | 'deactivated'
  ) => {
    setOpenMenuId(null);
    setActionBusyId(productId);
    try {
      const res: any = await api.updateProductStatus(productId, newStatus);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, ...(res?.product || {}), status: newStatus } : p
        )
      );
      showSuccess(res?.message || `Product marked as ${newStatus}`);
    } catch (err: any) {
      console.error('Failed to update product status:', err);
      showError(err?.response?.data?.message || err?.message || 'Failed to update status');
    } finally {
      setActionBusyId(null);
    }
  };

  // Quick Stock Adjustment (Wired to PATCH /api/products/:id/stock)
  const openStockModal = (item: any) => {
    setOpenMenuId(null);
    setStockModalItem(item);
    setStockInput(String(item.stock ?? 0));
  };

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalItem) return;
    const parsed = Number(stockInput);
    if (!Number.isInteger(parsed) || parsed < 0) {
      showError('Stock must be a whole number (0 or greater)');
      return;
    }

    setSavingStock(true);
    try {
      await api.updateProductStock(String(stockModalItem.id), parsed);
      showSuccess(`Updated stock for "${stockModalItem.name}" to ${parsed}`);
      setStockModalItem(null);
      await loadProducts();
    } catch (err: any) {
      console.error('Stock update failed:', err);
      showError(err?.response?.data?.message || err?.message || 'Failed to update stock');
    } finally {
      setSavingStock(false);
    }
  };

  // Submit for Moderation (Wired to POST /api/products/:id/submit)
  const handleSubmitForReview = async (id: number | string) => {
    setOpenMenuId(null);
    setActionBusyId(Number(id));
    try {
      const res: any = await api.submitProductForModeration(String(id));
      showSuccess(res?.message || 'Product submitted for review');
      await loadProducts();
    } catch (error: any) {
      console.error('Failed to submit product', error);
      showError(
        error?.response?.data?.message || error?.message || 'Failed to submit product for review'
      );
    } finally {
      setActionBusyId(null);
    }
  };

  // Single & Batch Delete Confirmation (Wired to DELETE /api/products/:id & POST /api/dashboard/farmer/products/batch)
  const executeConfirmedDelete = async () => {
    if (!deleteTarget) return;
    setConfirmingDelete(true);
    try {
      if (deleteTarget.mode === 'single' && deleteTarget.item) {
        const targetId = deleteTarget.item.id;
        await api.deleteProduct(targetId);
        setSelectedItems((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        showSuccess(`"${deleteTarget.item.name}" removed from catalog`);
        setDeleteTarget(null);
        if (products.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          await loadProducts();
        }
      } else if (deleteTarget.mode === 'batch' && deleteTarget.ids?.length) {
        const ids = deleteTarget.ids;
        await api.batchUpdateProducts(ids.map(String), 'delete');
        setSelectedItems(new Set());
        showSuccess(`${ids.length} product(s) deleted`);
        setDeleteTarget(null);
        if (ids.length >= products.length && page > 1) {
          setPage(page - 1);
        } else {
          await loadProducts();
        }
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      showError(err?.response?.data?.message || err?.message || 'Delete failed');
    } finally {
      setConfirmingDelete(false);
    }
  };

  // Batch Status Update (Wired to PATCH /api/products/batch)
  const handleBatchStatus = async (status: 'active' | 'draft' | 'deactivated') => {
    if (selectedItems.size === 0 || batchBusy) return;
    setBatchBusy(true);
    try {
      const ids = Array.from(selectedItems);
      const res: any = await api.batchUpdateProductsStatus(ids, status);
      setSelectedItems(new Set());
      showSuccess(res?.message || `${ids.length} products updated to ${status}`);
      await loadProducts();
    } catch (err: any) {
      console.error('Batch status update failed:', err);
      showError(err?.response?.data?.message || err?.message || 'Batch update failed');
    } finally {
      setBatchBusy(false);
    }
  };

  // Status Inline Indicator (Zero Bordered Box / Div)
  const renderPlainStatus = (item: any) => {
    const status = item.status || 'active';
    const dotClass =
      status === 'active' ? 'bg-[#10B981]' : status === 'draft' ? 'bg-gray-400' : 'bg-rose-600';
    const textClass =
      status === 'active'
        ? 'text-emerald-800'
        : status === 'draft'
        ? 'text-gray-600'
        : 'text-rose-700';

    return (
      <div className="space-y-0.5 leading-tight">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${textClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
          <span>{status}</span>
        </span>

        {item.moderation_status === 'pending' && (
          <span className="block text-[10px] font-semibold text-amber-700">Under Review</span>
        )}
        {item.moderation_status === 'changes_requested' && (
          <span className="block text-[10px] font-semibold text-orange-700">Changes Requested</span>
        )}
        {item.moderation_status === 'rejected' && (
          <span className="block text-[10px] font-semibold text-rose-700">Rejected</span>
        )}
        {Number(item.pending_revisions_count) > 0 && (
          <span className="block text-[10px] font-semibold text-blue-700">Revision Pending</span>
        )}
      </div>
    );
  };

  // Borderless 3-dot Action Menu (No outer square box)
  const renderRowMenu = (item: any, openUpward: boolean) => {
    const isOpen = openMenuId === item.id;
    const isBusy = actionBusyId === item.id;
    const canSubmitReview =
      item.status === 'draft' ||
      item.moderation_status === 'changes_requested' ||
      item.moderation_status === 'rejected';

    return (
      <div className="relative inline-block text-left" data-row-menu>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuId(isOpen ? null : item.id);
          }}
          disabled={isBusy}
          aria-label={`Actions for ${item.name}`}
          aria-expanded={isOpen}
          className={`p-1.5 inline-flex items-center justify-center transition-colors focus:outline-none ${
            isOpen
              ? 'text-[#1f5400]'
              : 'text-gray-500 hover:text-gray-950'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">more_vert</span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: openUpward ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: openUpward ? 4 : -4, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              className={`absolute right-0 w-52 bg-white border border-gray-300 shadow-xl z-50 divide-y divide-gray-200 ${
                openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
              }`}
            >
              {/* Primary Actions */}
              <div className="py-1">
                <Link
                  href={`/farmer/products/edit/${item.id}`}
                  onClick={() => setOpenMenuId(null)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 hover:text-[#1f5400] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#007a6c]">edit</span>
                  <span>Edit Listing</span>
                </Link>

                <button
                  type="button"
                  onClick={() => openStockModal(item)}
                  className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-gray-500">
                    inventory_2
                  </span>
                  <span>Update Stock</span>
                </button>

                <Link
                  href={`/buyer/product/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpenMenuId(null)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-gray-400">
                    open_in_new
                  </span>
                  <span>Preview Buyer View</span>
                </Link>

                {canSubmitReview && (
                  <button
                    type="button"
                    onClick={() => handleSubmitForReview(item.id)}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50/70 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Submit for Review</span>
                  </button>
                )}
              </div>

              {/* Status Transitions */}
              <div className="py-1">
                {item.status !== 'active' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(item.id, 'active')}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50/60 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    <span>Set Active</span>
                  </button>
                )}
                {item.status !== 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(item.id, 'draft')}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-gray-400">
                      edit_note
                    </span>
                    <span>Move to Draft</span>
                  </button>
                )}
                {item.status !== 'deactivated' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(item.id, 'deactivated')}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50/60 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">pause_circle</span>
                    <span>Deactivate</span>
                  </button>
                )}
              </div>

              {/* Destructive Action */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    setDeleteTarget({ mode: 'single', item });
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Delete Produce</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Numbered page array helper
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push('ellipsis');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const rangeStart = totalProducts === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalProducts, page * pageSize);

  return (
    <div className="flex-1 flex flex-col min-h-full bg-white text-gray-900 pb-24">
      {/* ════════════════ TOP HEADER BAR (LINED WHITE + CSV EXPORT + ADD) ════════════════ */}
      <header className="h-16 bg-white border-b border-gray-300 px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Products</h1>
          <span className="text-xs font-semibold text-gray-500 tabular-nums">
            ({totalProducts})
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {exportingCsv ? 'hourglass_top' : 'download'}
            </span>
            <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          <Link
            href="/farmer/products/new"
            className="px-4 py-2 bg-[#1f5400] hover:bg-[#173f00] border border-[#1f5400] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add New Produce</span>
          </Link>
        </div>
      </header>

      {/* ════════════════ MAIN CATALOG WORKBENCH ════════════════ */}
      <div className="flex-1 w-full max-w-[1480px] mx-auto p-6 lg:p-8 space-y-5">
        {/* CENTERED HUGE SEARCH BAR + FILTER + TABLE/GALLERY ICON SWITCHER */}
        <div className="bg-white border border-gray-300 rounded-none">
          <div className="p-4 lg:px-6 grid grid-cols-1 lg:grid-cols-[1fr_minmax(420px,680px)_1fr] items-center gap-4">
            {/* Left Balance Zone (Shows subtle count / selection hint) */}
            <div className="hidden lg:flex items-center text-xs text-gray-500">
              {hasSelection ? (
                <span className="font-semibold text-[#1f5400]">
                  {selectedItems.size} selected
                </span>
              ) : (
                <span></span>
              )}
            </div>

            {/* HUGE CENTERED SEARCH BAR */}
            <form
              onSubmit={handleSearchSubmit}
              className="w-full relative flex items-center bg-white border border-gray-300 focus-within:border-[#1f5400] h-12 px-4 gap-3 transition-colors"
            >
              <span className="material-symbols-outlined text-gray-400 text-[22px] shrink-0">
                search
              </span>
              <input
                type="text"
                placeholder="Search produce by name, #ID, category, farm location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearch('');
                    setPage(1);
                  }}
                  className="text-gray-400 hover:text-gray-800 p-1 transition-colors"
                  title="Clear search"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </form>

            {/* Right Controls: Filter Button + Table & Gallery Icons right next to it */}
            <div className="flex items-center justify-end gap-2">
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="h-10 px-3 border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Reset
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`h-10 px-3.5 border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                  showAdvancedFilters || activeAdvancedCount > 0
                    ? 'border-[#007a6c] bg-teal-50/40 text-[#007a6c]'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>Filters</span>
                {activeAdvancedCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#007a6c] text-white text-[10px] font-bold tabular-nums">
                    {activeAdvancedCount}
                  </span>
                )}
              </button>

              {/* Table & Gallery Icon Buttons right next to Filter Button */}
              <div className="flex border border-gray-300 divide-x divide-gray-300 bg-white">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`w-10 h-10 flex items-center justify-center transition-colors ${
                    viewMode === 'table'
                      ? 'bg-[#1f5400] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title="Table View"
                  aria-label="Table View"
                >
                  <span className="material-symbols-outlined text-[20px]">table_rows</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`w-10 h-10 flex items-center justify-center transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[#1f5400] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title="Gallery View"
                  aria-label="Gallery View"
                >
                  <span className="material-symbols-outlined text-[20px]">grid_view</span>
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Multi-Faceted Filter Drawer */}
          <AnimatePresence initial={false}>
            {showAdvancedFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-gray-300 bg-white"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-gray-300">
                  {/* 1. Category */}
                  <div className="p-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Category
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => {
                        setCategoryFilter(e.target.value);
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#007a6c]"
                    >
                      <option value="All">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Stock Level */}
                  <div className="p-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Stock Level
                    </label>
                    <select
                      value={stockFilter}
                      onChange={(e) => {
                        setStockFilter(e.target.value as StockFilter);
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#007a6c]"
                    >
                      <option value="all">All Stock Levels</option>
                      <option value="in_stock">In Stock (&gt; 50)</option>
                      <option value="low_stock">Low Stock (1 – 50)</option>
                      <option value="out_of_stock">Sold Out (0)</option>
                    </select>
                  </div>

                  {/* 3. Status & Moderation */}
                  <div className="p-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Status &amp; Review
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#007a6c]"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active (Live)</option>
                      <option value="draft">Draft</option>
                      <option value="deactivated">Deactivated</option>
                      <option value="mod_pending">Under Review</option>
                      <option value="mod_changes">Changes Requested</option>
                      <option value="mod_rejected">Rejected</option>
                    </select>
                  </div>

                  {/* 4. Crop Traits */}
                  <div className="p-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Crop Traits
                    </label>
                    <select
                      value={traitFilter}
                      onChange={(e) => setTraitFilter(e.target.value as TraitFilter)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#007a6c]"
                    >
                      <option value="all">All Produce</option>
                      <option value="organic">Organic Only</option>
                      <option value="discounted">Promotional Price</option>
                      <option value="revision_pending">Pending Edit Revision</option>
                    </select>
                  </div>

                  {/* 5. Price Corridor */}
                  <div className="p-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Price Range (ETB)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        placeholder="Min"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-300 rounded-none text-xs font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] tabular-nums"
                      />
                      <span className="text-gray-400 text-xs">–</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Max"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-300 rounded-none text-xs font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] tabular-nums"
                      />
                    </div>
                  </div>

                  {/* 6. Sort By */}
                  <div className="p-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#007a6c]"
                    >
                      <option value="newest">Newest Added</option>
                      <option value="best_selling">Best Selling</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="stock_asc">Lowest Stock First</option>
                      <option value="name_asc">Name: A to Z</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ════════════════ MAIN LISTING CONTAINER (TABLE OR GALLERY) ════════════════ */}
        <div className="bg-white border border-gray-300 rounded-none overflow-visible">
          {loading ? (
            <div className="p-16 text-center text-gray-500">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-[#1f5400] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold uppercase tracking-wider">Loading catalog...</p>
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 border border-gray-300 bg-white text-[#007a6c] flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl">spa</span>
              </div>
              <p className="font-bold text-gray-900 text-sm mb-1">No matching produce found</p>
              <p className="text-xs text-gray-500 mb-5">
                {hasAnyFilter
                  ? 'Adjust or clear your active search filters to see more products.'
                  : 'Start selling by adding your first agricultural crop.'}
              </p>
              {hasAnyFilter ? (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-800"
                >
                  Clear All Filters
                </button>
              ) : (
                <Link
                  href="/farmer/products/new"
                  className="px-4 py-2 bg-[#1f5400] hover:bg-[#173f00] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add New Produce</span>
                </Link>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* ──────── TABLE LEDGER VIEW ──────── */
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="group/thead bg-white border-b border-gray-300 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 pl-5 w-10">
                      <input
                        type="checkbox"
                        checked={
                          displayProducts.length > 0 &&
                          displayProducts.every((p) => selectedItems.has(p.id))
                        }
                        onChange={handleToggleSelectAll}
                        aria-label="Select all visible products"
                        className={`w-4 h-4 text-[#1f5400] rounded-none border-gray-300 focus:ring-[#1f5400] transition-opacity duration-150 ${
                          hasSelection
                            ? 'opacity-100'
                            : 'opacity-0 group-hover/thead:opacity-100 focus:opacity-100'
                        }`}
                      />
                    </th>
                    <th className="py-3.5 px-4">Produce</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Rate (ETB)</th>
                    <th className="py-3.5 px-4">Stock</th>
                    <th className="py-3.5 px-4 text-center">Sold</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 pr-5 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 text-xs bg-white">
                  {displayProducts.map((item, idx) => {
                    const isSelected = selectedItems.has(item.id);
                    const isLow = Number(item.stock) > 0 && Number(item.stock) <= 50;
                    const isOut = Number(item.stock) === 0;
                    const stockPct = Math.min(100, Math.round((Number(item.stock || 0) / 200) * 100));
                    const openUpward =
                      displayProducts.length > 3 && idx >= displayProducts.length - 2;

                    return (
                      <tr
                        key={item.id}
                        className={`group/row transition-colors ${
                          isSelected ? 'bg-emerald-50/35' : 'hover:bg-gray-50/70'
                        }`}
                      >
                        <td className="py-3.5 px-4 pl-5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectItem(item.id)}
                            aria-label={`Select ${item.name}`}
                            className={`w-4 h-4 text-[#1f5400] rounded-none border-gray-300 focus:ring-[#1f5400] transition-opacity duration-150 ${
                              isSelected || hasSelection
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/row:opacity-100 focus:opacity-100'
                            }`}
                          />
                        </td>

                        {/* Produce */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gray-50 border border-gray-300 overflow-hidden shrink-0">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <span className="material-symbols-outlined text-lg">grain</span>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/farmer/products/edit/${item.id}`}
                                className="font-bold text-gray-900 hover:text-[#1f5400] hover:underline block truncate max-w-[230px]"
                              >
                                {item.name}
                              </Link>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
                                <span className="font-mono">#{item.id}</span>
                                {item.is_organic && (
                                  <span className="text-[#1f5400] font-semibold">• Organic</span>
                                )}
                                {item.farm_location && (
                                  <span className="text-gray-400 truncate max-w-[140px]">
                                    • {item.farm_location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 font-medium text-gray-700">
                          {item.category_name || 'Produce'}
                        </td>

                        {/* Rate */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900 tabular-nums">
                            ETB {Number(item.price).toLocaleString()}
                            <span className="text-[11px] text-gray-500 font-normal ml-1">
                              / {item.unit || 'kg'}
                            </span>
                          </div>
                          {(!item.unit || item.unit.toLowerCase() === 'kg') && (
                            <span className="text-[10px] text-[#007a6c] block font-medium tabular-nums">
                              ≈ ETB {(Number(item.price) * 100).toLocaleString()} / qt
                            </span>
                          )}
                          {item.discount_price && (
                            <span className="text-[10px] text-amber-800 font-bold block tabular-nums">
                              Promo: ETB {Number(item.discount_price).toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* Stock */}
                        <td className="py-3.5 px-4">
                          <div className="w-28 space-y-1">
                            <span
                              className={`font-bold tabular-nums block ${
                                isOut
                                  ? 'text-rose-700'
                                  : isLow
                                  ? 'text-amber-700'
                                  : 'text-gray-900'
                              }`}
                            >
                              {item.stock} {item.unit || 'kg'}
                            </span>
                            <div className="w-full h-1 bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full ${
                                  isOut
                                    ? 'bg-rose-600'
                                    : isLow
                                    ? 'bg-amber-500'
                                    : 'bg-[#007a6c]'
                                }`}
                                style={{ width: `${isOut ? 4 : Math.max(12, stockPct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Units Sold */}
                        <td className="py-3.5 px-4 text-center font-semibold text-gray-700 tabular-nums">
                          {item.units_sold || 0}
                        </td>

                        {/* Status (Box-Free Inline Text) */}
                        <td className="py-3.5 px-4">{renderPlainStatus(item)}</td>

                        {/* Borderless 3-Dot Actions */}
                        <td className="py-3.5 px-4 pr-5 text-right">
                          {renderRowMenu(item, openUpward)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ──────── VISUAL GALLERY VIEW ──────── */
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 bg-white">
              {displayProducts.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const isLow = Number(item.stock) > 0 && Number(item.stock) <= 50;
                const isOut = Number(item.stock) === 0;
                const imgCount = Array.isArray(item.images)
                  ? item.images.length
                  : item.image_url
                  ? 1
                  : 0;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group/card bg-white border flex flex-col justify-between transition-colors ${
                      isSelected
                        ? 'border-[#1f5400] ring-1 ring-[#1f5400]'
                        : 'border-gray-300 hover:border-[#007a6c]'
                    }`}
                  >
                    {/* Card Image */}
                    <div className="relative h-44 bg-gray-50 border-b border-gray-300 overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover/card:scale-[1.03] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <span className="material-symbols-outlined text-4xl">grain</span>
                        </div>
                      )}

                      {/* Hover / Selected-Only Checkbox */}
                      <label
                        className={`absolute top-2.5 left-2.5 cursor-pointer bg-white/95 p-1 border border-gray-300 flex items-center justify-center transition-opacity duration-150 ${
                          isSelected || hasSelection
                            ? 'opacity-100'
                            : 'opacity-0 group-hover/card:opacity-100 focus-within:opacity-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectItem(item.id)}
                          aria-label={`Select ${item.name}`}
                          className="w-4 h-4 text-[#1f5400] rounded-none border-gray-300 focus:ring-[#1f5400]"
                        />
                      </label>

                      {imgCount > 1 && (
                        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold tabular-nums">
                          {imgCount} photos
                        </span>
                      )}
                    </div>

                    {/* Card Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[#007a6c]">
                          <span className="truncate">{item.category_name || 'Produce'}</span>
                          <span className="text-gray-400 font-mono">#{item.id}</span>
                        </div>
                        <Link
                          href={`/farmer/products/edit/${item.id}`}
                          className="font-bold text-sm text-gray-900 hover:text-[#1f5400] hover:underline line-clamp-1 mt-1 block"
                        >
                          {item.name}
                        </Link>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          {renderPlainStatus(item)}
                          {item.is_organic && (
                            <span className="text-[11px] font-semibold text-[#1f5400]">
                              Organic
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-gray-900 tabular-nums">
                            ETB {Number(item.price).toLocaleString()}
                            <span className="text-[11px] font-normal text-gray-500">
                              /{item.unit || 'kg'}
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-semibold tabular-nums ${
                              isOut
                                ? 'text-rose-700'
                                : isLow
                                ? 'text-amber-700'
                                : 'text-gray-500'
                            }`}
                          >
                            {item.stock} {item.unit || 'kg'} left • {item.units_sold || 0} sold
                          </span>
                        </div>

                        {renderRowMenu(item, false)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ════════════════ SERVER PAGINATION FOOTER ════════════════ */}
          {totalProducts > 0 && (
            <div className="px-5 py-3.5 border-t border-gray-300 bg-white flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-4">
                <span className="tabular-nums">
                  Showing <strong className="text-gray-900">{rangeStart}</strong>–
                  <strong className="text-gray-900">{rangeEnd}</strong> of{' '}
                  <strong className="text-gray-900">{totalProducts}</strong> crops
                </span>

                <label className="inline-flex items-center gap-1.5 text-xs">
                  <span className="text-gray-500">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-2 py-1 border border-gray-300 bg-white text-gray-800 font-semibold focus:outline-none focus:border-[#007a6c]"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center border border-gray-300 divide-x divide-gray-300 bg-white">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors font-semibold"
                >
                  Previous
                </button>

                {pageNumbers.map((pNum, i) =>
                  pNum === 'ellipsis' ? (
                    <span key={`e-${i}`} className="px-2.5 py-1.5 text-gray-400 select-none">
                      ...
                    </span>
                  ) : (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPage(pNum)}
                      className={`px-3 py-1.5 font-bold tabular-nums transition-colors ${
                        page === pNum
                          ? 'bg-[#1f5400] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pNum}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════ FLOATING BULK ACTIONS DOCK ════════════════ */}
      <AnimatePresence>
        {selectedItems.size > 0 && (
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl bg-[#111827] text-white border border-gray-800 border-t-2 border-t-[#10B981] shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-[#1f5400] border border-[#10B981]/50 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                  {selectedItems.size}
                </span>
                <span className="text-xs font-semibold tracking-wide text-gray-100">
                  selected
                </span>
              </div>

              {displayProducts.length > selectedItems.size && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedItems(new Set<number>(displayProducts.map((p) => p.id)))
                  }
                  className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                >
                  Select page ({displayProducts.length})
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => handleBatchStatus('active')}
                className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">visibility</span>
                <span>Activate</span>
              </button>

              <button
                type="button"
                disabled={batchBusy}
                onClick={() => handleBatchStatus('draft')}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/15 border border-white/15 text-gray-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">edit_note</span>
                <span>Draft</span>
              </button>

              <button
                type="button"
                disabled={batchBusy}
                onClick={() => handleBatchStatus('deactivated')}
                className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">pause_circle</span>
                <span>Deactivate</span>
              </button>

              <button
                type="button"
                disabled={batchBusy}
                onClick={() =>
                  setDeleteTarget({ mode: 'batch', ids: Array.from(selectedItems) })
                }
                className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                <span>Delete</span>
              </button>

              <div className="h-5 w-px bg-gray-700 mx-1" />

              <button
                type="button"
                onClick={() => setSelectedItems(new Set())}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Clear Selection"
                aria-label="Clear Selection"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════ QUICK STOCK UPDATE MODAL ════════════════ */}
      <AnimatePresence>
        {stockModalItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => !savingStock && setStockModalItem(null)}
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveStock}
              className="w-full max-w-md bg-white border border-gray-300 shadow-2xl divide-y divide-gray-200"
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Update Stock Quantity</h2>
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">
                    {stockModalItem.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStockModalItem(null)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="p-5 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                  Available Quantity ({stockModalItem.unit || 'kg'})
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  autoFocus
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#1f5400] tabular-nums"
                />
              </div>

              <div className="px-5 py-3.5 flex items-center justify-end gap-2 bg-gray-50/50">
                <button
                  type="button"
                  disabled={savingStock}
                  onClick={() => setStockModalItem(null)}
                  className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStock}
                  className="px-4 py-2 bg-[#1f5400] hover:bg-[#173f00] text-white text-xs font-bold disabled:opacity-50"
                >
                  {savingStock ? 'Saving...' : 'Save Stock'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════ DELETE CONFIRMATION MODAL ════════════════ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
            onClick={() => !confirmingDelete && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white border border-gray-300 shadow-2xl divide-y divide-gray-200"
            >
              <div className="px-5 py-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-rose-600 text-[22px]">
                  warning
                </span>
                <h2 className="text-sm font-bold text-gray-900">
                  {deleteTarget.mode === 'batch'
                    ? `Delete ${deleteTarget.ids?.length} Selected Products?`
                    : 'Delete Product Listing?'}
                </h2>
              </div>

              <div className="p-5 text-xs text-gray-600 leading-relaxed">
                {deleteTarget.mode === 'batch' ? (
                  <p>
                    You are about to remove{' '}
                    <strong className="text-gray-900">
                      {deleteTarget.ids?.length} produce items
                    </strong>{' '}
                    from your active catalog. Past order records remain preserved.
                  </p>
                ) : (
                  <p>
                    Remove{' '}
                    <strong className="text-gray-900">{deleteTarget.item?.name}</strong> from your
                    catalog? Buyers will no longer see this listing.
                  </p>
                )}
              </div>

              <div className="px-5 py-3.5 flex items-center justify-end gap-2 bg-gray-50/50">
                <button
                  type="button"
                  disabled={confirmingDelete}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmingDelete}
                  onClick={executeConfirmedDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {confirmingDelete ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

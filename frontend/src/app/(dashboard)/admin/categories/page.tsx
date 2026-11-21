'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Package,
  Layers,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  AdminPageHeader,
  AdminToolbar,
  AdminTable,
  AdminStatusPill,
  AdminModal,
  AdminEmptyState,
} from '@/components/admin/ui';

export default function AdminCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [attributesText, setAttributesText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    api
      .getCategoriesAdmin()
      .then((res) => {
        if (!isMounted) return;
        setCategories(res.categories || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        showToast(err?.response?.data?.message || 'Failed to load categories', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [showToast, refreshKey]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setIcon('');
    setIsActive(true);
    setAttributesText('');
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name || '');
    setDescription(cat.description || '');
    setIcon(cat.icon || '');
    setIsActive(cat.is_active !== false);
    setAttributesText(
      cat.attributes && Array.isArray(cat.attributes)
        ? cat.attributes.map((a: any) => (typeof a === 'string' ? a : a.name || '')).join(', ')
        : ''
    );
    setModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    const attrs = attributesText
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
      .map((attr) => ({ name: attr, required: false }));

    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateCategoryAdmin(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
          is_active: isActive,
          attributes: attrs,
        });
        showToast('Category updated successfully', 'success');
      } else {
        await api.createCategoryAdmin({
          name: name.trim(),
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
          attributes: attrs,
        });
        showToast('Category created successfully', 'success');
      }

      setModalOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to save category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat: any) => {
    if (
      !confirm(
        `Are you sure you want to delete category "${cat.name}"? Products linked to this category must be reassigned first.`
      )
    ) {
      return;
    }

    try {
      await api.deleteCategoryAdmin(cat.id);
      showToast('Category deleted successfully', 'success');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to delete category', 'error');
    }
  };

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  const columns = [
    {
      key: 'name',
      header: 'Category Name',
      render: (row: any) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gray-100 border border-gray-300 flex items-center justify-center text-[#007a6c]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500 max-w-sm truncate">{row.description || 'No description'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'products_count',
      header: 'Linked Produce',
      render: (row: any) => (
        <div className="text-xs tabular-nums font-semibold text-gray-800">
          {row.products_count} total <span className="text-gray-500 font-normal">({row.active_products_count || 0} active)</span>
        </div>
      ),
    },
    {
      key: 'attributes',
      header: 'Quality Attributes Schema',
      render: (row: any) => {
        const attrs = row.attributes && Array.isArray(row.attributes) ? row.attributes : [];
        if (attrs.length === 0) return <span className="text-xs text-gray-400">Default produce schema</span>;
        return (
          <div className="flex flex-wrap gap-1 text-xs">
            {attrs.slice(0, 3).map((a: any, i: number) => (
              <span key={i} className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 text-gray-700">
                {typeof a === 'string' ? a : a.name}
              </span>
            ))}
            {attrs.length > 3 && (
              <span className="text-gray-500 text-xs">+{attrs.length - 3} more</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => (
        <span
          className={`inline-block px-2 py-0.5 text-xs font-semibold uppercase border ${
            row.is_active !== false
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-gray-100 text-gray-600 border-gray-300'
          }`}
        >
          {row.is_active !== false ? 'Active' : 'Disabled'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1 text-gray-600 hover:text-[#007a6c] border border-gray-300 hover:bg-gray-50 transition-colors"
            title="Edit category"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteCategory(row)}
            className="p-1 text-gray-400 hover:text-rose-600 border border-gray-300 hover:bg-rose-50 transition-colors"
            title="Delete category"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#FCF9F8] p-6 space-y-6">
      <AdminPageHeader
        title="Commodity & Crop Categories Governance"
        subtitle="Configure crop taxonomies, grading rules, quality attributes, and market definitions."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Catalog Governance', href: '/admin/products' },
          { label: 'Categories' },
        ]}
        actions={
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#007a6c] hover:bg-[#005f54] flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        }
      />

      <AdminToolbar
        searchPlaceholder="Filter categories by name or description..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="bg-white border border-gray-300">
        <AdminTable
          columns={columns}
          data={filtered}
          loading={loading}
          keyExtractor={(row) => String(row.id)}
          emptyMessage="No commodity categories found."
        />
      </div>

      {/* Create / Edit Modal */}
      <AdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit Category #${editingId}` : 'Add New Produce Category'}
        description="Categories organize the marketplace and define commodity-specific quality parameters."
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Category Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Legumes & Pulses / Tropical Fruits"
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief explanation of crops included in this category..."
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Custom Quality Attributes (comma-separated)
            </label>
            <input
              type="text"
              value={attributesText}
              onChange={(e) => setAttributesText(e.target.value)}
              placeholder="e.g. Moisture Content, Seed Purity, Variety, Harvest Date"
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-[#007a6c]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded-none border-gray-300"
            />
            <label htmlFor="is_active" className="text-xs font-semibold text-gray-700">
              Active in Buyer Catalog
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#007a6c] hover:bg-[#005f54] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}


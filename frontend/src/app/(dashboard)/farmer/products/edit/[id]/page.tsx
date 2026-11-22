'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import MultiImageUploader from '@/components/farmer/MultiImageUploader';

interface Category {
  id: number;
  name: string;
}

const UNITS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'quintal', label: 'Quintal (100 kg)' },
  { value: 'crate', label: 'Crate / Wooden Box' },
  { value: 'piece', label: 'Per Piece / Unit' },
];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { showError, showSuccess } = useToast();

  const [loading, setLoading] = useState(true);
  const [productData, setProductData] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    price: '',
    discount_price: '',
    stock: '',
    unit: 'kg',
    min_order_quantity: '1',
    harvest_date: '',
    shelf_life_days: '',
    is_organic: false,
    farm_location: '',
    status: 'active',
  });

  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (!productId) return;

    (async () => {
      try {
        setLoading(true);
        const [productRes, categoriesRes] = await Promise.all([
          api.getProductById(productId),
          api.getCategories().catch(() => ({ categories: [] })),
        ]);

        const p = productRes.product;
        setProductData(p);
        if (!p) {
          showError('Product not found');
          router.push('/farmer/products');
          return;
        }

        setCategories(categoriesRes.categories || []);

        const initialImages: string[] = Array.isArray(p.images) && p.images.length > 0
          ? p.images
          : p.image_url
          ? [p.image_url]
          : [];
        setImages(initialImages);

        const formattedDate = p.harvest_date
          ? new Date(p.harvest_date).toISOString().split('T')[0]
          : '';

        setFormData({
          name: p.name || '',
          category_id: p.category_id ? String(p.category_id) : '',
          description: p.description || '',
          price: p.price ? String(p.price) : '',
          discount_price: p.discount_price ? String(p.discount_price) : '',
          stock: p.stock !== undefined ? String(p.stock) : '0',
          unit: p.unit || 'kg',
          min_order_quantity: p.min_order_quantity ? String(p.min_order_quantity) : '1',
          harvest_date: formattedDate,
          shelf_life_days: p.shelf_life_days ? String(p.shelf_life_days) : '',
          is_organic: Boolean(p.is_organic),
          farm_location: p.farm_location || '',
          status: p.status || 'active',
        });
      } catch (err: any) {
        console.error('Failed to load produce:', err);
        showError('Failed to load produce details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validate = () => {
    if (!formData.name.trim()) {
      showError('Crop/Product name is required');
      return false;
    }
    const priceNum = Number(formData.price);
    if (!formData.price || isNaN(priceNum) || priceNum <= 0) {
      showError('Price must be greater than 0 ETB');
      return false;
    }
    if (formData.discount_price) {
      const discNum = Number(formData.discount_price);
      if (isNaN(discNum) || discNum <= 0) {
        showError('Discount price must be greater than 0');
        return false;
      }
      if (discNum >= priceNum) {
        showError('Discount price must be less than regular price');
        return false;
      }
    }
    const stockNum = Number(formData.stock);
    if (formData.stock === '' || isNaN(stockNum) || stockNum < 0) {
      showError('Stock quantity must be a non-negative number');
      return false;
    }
    return true;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res: any = await api.updateProduct(productId, {
        name: formData.name.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : undefined,
        description: formData.description.trim() || undefined,
        price: Number(formData.price),
        discount_price: formData.discount_price ? Number(formData.discount_price) : null,
        stock: Number(formData.stock),
        unit: formData.unit,
        min_order_quantity: Number(formData.min_order_quantity || 1),
        harvest_date: formData.harvest_date || null,
        shelf_life_days: formData.shelf_life_days ? Number(formData.shelf_life_days) : null,
        is_organic: formData.is_organic,
        farm_location: formData.farm_location.trim() || undefined,
        images,
        image_url: images.length > 0 ? images[0] : null,
        status: formData.status,
      });

      if (res?.is_revision_pending || res?.product?.is_revision_pending) {
        showSuccess(res?.message || 'Significant changes submitted for moderation review. Your live listing remains active until reviewed.');
      } else {
        showSuccess('Produce updated successfully!');
      }
      router.push('/farmer/products');
    } catch (err: any) {
      console.error('Update failed:', err);
      showError(err.response?.data?.message || 'Failed to update produce.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this produce?')) return;
    setIsDeleting(true);
    try {
      await api.deleteProduct(productId);
      showSuccess('Produce deleted successfully');
      router.push('/farmer/products');
    } catch (err: any) {
      console.error('Delete failed:', err);
      showError(err.response?.data?.message || 'Failed to delete produce.');
    } finally {
      setIsDeleting(false);
    }
  };

  const numPrice = Number(formData.price) || 0;
  const quintalEquivalent = formData.unit === 'kg' ? numPrice * 100 : numPrice;
  const kgEquivalent = formData.unit === 'quintal' ? numPrice / 100 : numPrice;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px]">
        <div className="w-10 h-10 border-4 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-gray-800">
      {/* Top Header */}
      <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/farmer/products"
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Edit Produce #{productId}</h1>
            <p className="text-xs text-gray-500">Update harvest details, pricing, and stock status</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-xs font-semibold text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors border border-red-200 flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">delete</span>
          Delete Produce
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
        {productData?.pending_revisions_count > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 mt-0.5">info</span>
            <div className="text-sm">
              <p className="font-bold text-blue-900">Revision Pending Moderation</p>
              <p className="text-blue-700">
                You have submitted significant changes that are currently being reviewed by administrators. Your existing listing remains live on the marketplace until the revision is approved.
              </p>
            </div>
          </div>
        )}
        <form onSubmit={handleUpdate} className="space-y-8">
          {/* Card 1: Visual Media */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#16a34a]">photo_library</span>
              Harvest Photos
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Update photos of your crop. Drag or click &quot;Set as Cover&quot; on your preferred primary image.
            </p>

            <MultiImageUploader images={images} onChange={setImages} maxImages={5} />
          </div>

          {/* Card 2: General Details */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#16a34a]">info</span>
              General Produce Details
            </h2>
            <p className="text-xs text-gray-500 mb-6">Crop name, category, and regional farm location.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Produce / Crop Name</label>
                <input
                  type="text"
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Category</label>
                <select
                  required
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Listing Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-bold transition-all bg-white"
                >
                  <option value="active">Active (Visible in Marketplace)</option>
                  <option value="draft">Draft (Hidden)</option>
                  <option value="deactivated">Deactivated (Archived)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Description & Harvest Notes</label>
                <textarea
                  rows={4}
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all resize-y"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Pricing & Agricultural Specs */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#16a34a]">payments</span>
              Pricing & Inventory
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Selling Unit</label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium bg-white"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Price (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Discount Price (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="discount_price"
                  value={formData.discount_price}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-emerald-700"
                />
              </div>

              {numPrice > 0 && (formData.unit === 'kg' || formData.unit === 'quintal') && (
                <div className="sm:col-span-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 text-xs text-emerald-800">
                  {formData.unit === 'kg' ? (
                    <>Wholesale equivalent: <strong>{quintalEquivalent.toLocaleString()} ETB per Quintal (100 kg)</strong>.</>
                  ) : (
                    <>Retail equivalent: <strong>{kgEquivalent.toFixed(2)} ETB per Kilogram</strong>.</>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Available Stock ({formData.unit})</label>
                <input
                  type="number"
                  min="0"
                  required
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Minimum Order Qty</label>
                <input
                  type="number"
                  min="1"
                  name="min_order_quantity"
                  value={formData.min_order_quantity}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Shelf Life (Days)</label>
                <input
                  type="number"
                  min="1"
                  name="shelf_life_days"
                  value={formData.shelf_life_days}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Harvest Date</label>
                <input
                  type="date"
                  name="harvest_date"
                  value={formData.harvest_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium bg-white"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id="is_organic"
                  name="is_organic"
                  checked={formData.is_organic}
                  onChange={handleChange}
                  className="w-5 h-5 text-[#16a34a] rounded-lg focus:ring-[#16a34a] border-gray-300"
                />
                <label htmlFor="is_organic" className="text-xs font-bold text-gray-800 cursor-pointer">
                  Certified Organic / Naturally Cultivated Harvest
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pb-12">
            <Link
              href="/farmer/products"
              className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 rounded-xl text-sm font-bold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving Produce...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">save</span>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

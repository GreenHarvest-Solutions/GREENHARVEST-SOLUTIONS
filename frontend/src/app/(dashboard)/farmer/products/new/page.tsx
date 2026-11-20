'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import MultiImageUploader from '@/components/farmer/MultiImageUploader';

interface Category {
  id: number;
  name: string;
  description?: string;
}

const UNITS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'quintal', label: 'Quintal (100 kg)' },
  { value: 'crate', label: 'Crate / Wooden Box' },
  { value: 'piece', label: 'Per Piece / Unit' },
];

export default function NewProductPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  });

  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, userRes] = await Promise.all([
          api.getCategories().catch(() => ({ categories: [] })),
          api.getUserProfile().catch(() => ({ user: null })),
        ]);

        const fetchedCats = catRes.categories || [];
        setCategories(fetchedCats);
        if (fetchedCats.length > 0) {
          setFormData((prev) => ({ ...prev, category_id: String(fetchedCats[0].id) }));
        }

        if (userRes.user?.farm_location || userRes.user?.address) {
          setFormData((prev) => ({
            ...prev,
            farm_location: userRes.user.farm_location || userRes.user.address || '',
          }));
        }
      } catch (err) {
        console.error('Failed to load form prerequisites:', err);
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, []);

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
    if (!formData.category_id) {
      showError('Please select a category');
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
    if (images.length === 0) {
      showError('Please upload at least one image of your harvest');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await api.createProduct({
        name: formData.name.trim(),
        category_id: Number(formData.category_id),
        description: formData.description.trim() || undefined,
        price: Number(formData.price),
        discount_price: formData.discount_price ? Number(formData.discount_price) : undefined,
        stock: Number(formData.stock),
        unit: formData.unit,
        min_order_quantity: Number(formData.min_order_quantity || 1),
        harvest_date: formData.harvest_date || undefined,
        shelf_life_days: formData.shelf_life_days ? Number(formData.shelf_life_days) : undefined,
        is_organic: formData.is_organic,
        farm_location: formData.farm_location.trim() || undefined,
        images,
        image_url: images[0] || undefined,
      });

      showSuccess('Product published successfully!');
      router.push('/farmer/products');
    } catch (err: any) {
      console.error('Failed to create product:', err);
      showError(err.response?.data?.message || 'Failed to create product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pricing helper calculation
  const numPrice = Number(formData.price) || 0;
  const quintalEquivalent = formData.unit === 'kg' ? numPrice * 100 : numPrice;
  const kgEquivalent = formData.unit === 'quintal' ? numPrice / 100 : numPrice;

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
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Add New Produce</h1>
            <p className="text-xs text-gray-500">List your harvest on the GreenHarvest marketplace</p>
          </div>
        </div>

        <Link
          href="/farmer/products"
          className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition-colors"
        >
          Cancel
        </Link>
      </header>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Card 1: Visual Media */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#16a34a]">photo_library</span>
              Harvest Photos
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Upload clear photos of your crops. The first image serves as the main marketplace card cover.
            </p>

            <MultiImageUploader images={images} onChange={setImages} maxImages={5} />
          </div>

          {/* Card 2: Basic Information */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#16a34a]">info</span>
              General Produce Details
            </h2>
            <p className="text-xs text-gray-500 mb-6">Specify the crop name, category, and cultivation story.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Produce / Crop Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Organic Magna White Teff (የመገና ነጭ ጤፍ)"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  disabled={loadingCategories}
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
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Origin Farm Location</label>
                <input
                  type="text"
                  name="farm_location"
                  value={formData.farm_location}
                  onChange={handleChange}
                  placeholder="e.g. Debre Zeit, Oromia"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Description & Harvest Notes</label>
                <textarea
                  rows={4}
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe crop grade, grain size, moisture level, organic fertilizer used, and culinary recommendations..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all resize-y"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Pricing, Inventory & Agricultural Specs */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#16a34a]">payments</span>
              Pricing & Agricultural Specifications
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Prices are strictly in Ethiopian Birr (ETB). Dual unit calculation helps wholesale & retail buyers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Unit */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Selling Unit</label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all bg-white"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Price per {formData.unit} (ETB) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="e.g. 120"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-semibold text-gray-900 transition-all pr-12"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-gray-400">ETB</span>
                </div>
              </div>

              {/* Discount Price */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Discount Price (Optional)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="discount_price"
                    value={formData.discount_price}
                    onChange={handleChange}
                    placeholder="e.g. 105"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-semibold text-emerald-700 transition-all pr-12"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-gray-400">ETB</span>
                </div>
              </div>

              {/* Unit Conversion Banner */}
              {numPrice > 0 && (formData.unit === 'kg' || formData.unit === 'quintal') && (
                <div className="sm:col-span-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">calculate</span>
                    <span>
                      {formData.unit === 'kg' ? (
                        <>
                          At <strong>{numPrice.toLocaleString()} ETB / kg</strong>, wholesale rate equals{' '}
                          <strong>{quintalEquivalent.toLocaleString()} ETB per Quintal (100 kg)</strong>.
                        </>
                      ) : (
                        <>
                          At <strong>{numPrice.toLocaleString()} ETB / quintal</strong>, retail rate equals{' '}
                          <strong>{kgEquivalent.toFixed(2)} ETB per Kilogram</strong>.
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Stock */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Available Stock ({formData.unit}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all"
                />
              </div>

              {/* MOQ */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Minimum Order Qty</label>
                <input
                  type="number"
                  min="1"
                  name="min_order_quantity"
                  value={formData.min_order_quantity}
                  onChange={handleChange}
                  placeholder="e.g. 5"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all"
                />
              </div>

              {/* Shelf Life */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Shelf Life (Days)</label>
                <input
                  type="number"
                  min="1"
                  name="shelf_life_days"
                  value={formData.shelf_life_days}
                  onChange={handleChange}
                  placeholder="e.g. 90"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all"
                />
              </div>

              {/* Harvest Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Harvest Date</label>
                <input
                  type="date"
                  name="harvest_date"
                  value={formData.harvest_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] font-medium transition-all bg-white"
                />
              </div>

              {/* Organic Farming Toggle */}
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
                  Certified Organic / Naturally Grown (No synthetic chemical pesticides or chemical fertilizers)
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
              Discard
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 rounded-xl text-sm font-bold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Publishing Produce...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Publish to Marketplace
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

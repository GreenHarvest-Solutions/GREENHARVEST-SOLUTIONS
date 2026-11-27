'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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

const STEPS = [
  { num: 1, key: 'identity', title: 'Crop Identity & Status', short: 'Identity', icon: 'eco' },
  { num: 2, key: 'pricing', title: 'Pricing & Specs', short: 'Pricing', icon: 'payments' },
  { num: 3, key: 'media', title: 'Harvest Gallery', short: 'Photos', icon: 'photo_library' },
  { num: 4, key: 'review', title: 'Review & Save', short: 'Save', icon: 'save' },
];

const stepSlideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 28 : -28,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -24 : 24,
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { showError, showSuccess } = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const [loading, setLoading] = useState(true);
  const [productData, setProductData] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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

        const initialImages: string[] =
          Array.isArray(p.images) && p.images.length > 0
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
    setSubmitError('');
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validateStep = (targetStep: number): string | null => {
    if (targetStep === 1) {
      if (!formData.name.trim() || formData.name.trim().length < 2) {
        return 'Crop / Produce name must be at least 2 characters.';
      }
    }
    if (targetStep === 2) {
      const priceNum = Number(formData.price);
      if (!formData.price || isNaN(priceNum) || priceNum <= 0) {
        return 'Price must be greater than 0 ETB.';
      }
      if (formData.discount_price) {
        const discNum = Number(formData.discount_price);
        if (isNaN(discNum) || discNum <= 0) {
          return 'Discount price must be greater than 0.';
        }
        if (discNum >= priceNum) {
          return 'Discount price must be strictly lower than the regular price.';
        }
      }
      const stockNum = Number(formData.stock);
      if (formData.stock === '' || isNaN(stockNum) || stockNum < 0) {
        return 'Stock quantity must be a non-negative number.';
      }
    }
    return null;
  };

  const validateAll = () => {
    const s1 = validateStep(1);
    if (s1) {
      setSubmitError(s1);
      showError(s1);
      goToStep(1);
      return false;
    }
    const s2 = validateStep(2);
    if (s2) {
      setSubmitError(s2);
      showError(s2);
      goToStep(2);
      return false;
    }
    return true;
  };

  const goToStep = (nextStep: number) => {
    if (nextStep === step) return;
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleNext = () => {
    setSubmitError('');
    const err = validateStep(step);
    if (err) {
      setSubmitError(err);
      showError(err);
      return;
    }
    if (step < 4) {
      goToStep(step + 1);
    } else {
      handleUpdate();
    }
  };

  const handleBack = () => {
    setSubmitError('');
    if (step > 1) {
      goToStep(step - 1);
    } else {
      router.push('/farmer/products');
    }
  };

  const handleUpdate = async () => {
    if (!validateAll()) return;

    setIsSubmitting(true);
    setSubmitError('');
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
        showSuccess(
          res?.message ||
            'Significant changes submitted for moderation review. Your live listing remains active until reviewed.'
        );
      } else {
        showSuccess('Produce updated successfully!');
      }
      router.push('/farmer/products');
    } catch (err: any) {
      console.error('Update failed:', err);
      const msg = err.response?.data?.message || 'Failed to update produce.';
      setSubmitError(msg);
      showError(msg);
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
  const numDiscount = Number(formData.discount_price) || 0;
  const hasValidDiscount = numDiscount > 0 && numPrice > 0 && numDiscount < numPrice;
  const discountPct = hasValidDiscount
    ? Math.round(((numPrice - numDiscount) / numPrice) * 100)
    : 0;

  const quintalEquivalent = formData.unit === 'kg' ? numPrice * 100 : numPrice;
  const kgEquivalent = formData.unit === 'quintal' ? numPrice / 100 : numPrice;

  const selectedCategoryName = useMemo(() => {
    const found = categories.find((c) => String(c.id) === String(formData.category_id));
    return found?.name || 'Produce Category';
  }, [categories, formData.category_id]);

  const progressPercentage = `${(step / 4) * 100}%`;

  const stepHeadline: Record<number, { title: string; subtitle: string }> = {
    1: {
      title: 'Update crop identity & visibility',
      subtitle: 'Refine produce title, category, marketplace visibility status, and origin notes.',
    },
    2: {
      title: 'Adjust pricing & agricultural specs',
      subtitle: 'Modify ETB pricing, promotional discount, stock quantities, and freshness timeline.',
    },
    3: {
      title: 'Customize & manage harvest photos',
      subtitle: 'Upload, reorder, zoom, crop, rotate, or enhance your listing imagery.',
    },
    4: {
      title: 'Review updates & save listing',
      subtitle: 'Verify your updated product specifications before committing changes.',
    },
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] bg-white">
        <div className="w-10 h-10 border-2 border-gray-300 border-t-[#1f5400] rounded-full animate-spin" />
        <p className="mt-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Loading Produce #{productId}...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-full bg-white text-gray-900">
      {/* ════════════════ TOP ONBOARDING BAR (WHITE + LINED BORDERS) ════════════════ */}
      <header className="bg-white border-b border-gray-300 sticky top-0 z-30 shrink-0">
        <div className="px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/farmer/products"
              className="w-9 h-9 border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-500 flex items-center justify-center text-gray-700 transition-colors shrink-0"
              title="Back to Products"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-gray-900 tracking-tight truncate">
                  Edit Produce #{productId}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 border border-gray-300 bg-gray-50 text-gray-700 tabular-nums">
                  STEP 0{step} / 04
                </span>
              </div>
            </div>
          </div>

          {/* Center: Interactive Stepper Rail (All Steps Jumpable in Edit Mode) */}
          <nav
            aria-label="Edit product steps"
            className="hidden lg:flex items-center border border-gray-300 divide-x divide-gray-300 bg-white"
          >
            {STEPS.map((s) => {
              const isCurrent = step === s.num;
              const isCompleted = step > s.num;

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => goToStep(s.num)}
                  className={`px-3.5 py-2 flex items-center gap-2 text-xs transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#1f5400] text-white font-bold'
                      : isCompleted
                      ? 'bg-white text-[#1f5400] font-semibold hover:bg-emerald-50/40'
                      : 'bg-white text-gray-700 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {isCompleted ? 'check_circle' : s.icon}
                  </span>
                  <span>
                    0{s.num}. {s.short}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right: Delete Produce */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="px-3 py-1.5 text-xs font-bold border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
              <span className="hidden sm:inline">Delete Produce</span>
            </button>
          </div>
        </div>

        {/* Continuous Spring-Animated Progress Line */}
        <div className="w-full h-[3px] bg-gray-200 overflow-hidden">
          <motion.div
            className="h-full bg-[#1f5400]"
            initial={false}
            animate={{ width: progressPercentage }}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          />
        </div>
      </header>

      {/* ════════════════ SPLIT EDITORIAL WORKBENCH ════════════════ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT PANE: LIVE MARKETPLACE CARD PREVIEW + STEP CHECKLIST */}
        <aside className="lg:col-span-5 xl:col-span-4 border-b lg:border-b-0 lg:border-r border-gray-300 bg-white flex flex-col justify-between">
          {/* Clean Architectural Intro Strip */}
          <div className="px-6 py-5 border-b border-gray-300 bg-white flex items-center justify-between gap-3">
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border border-gray-300 text-[#007a6c] mb-2">
                Editing Listing #{productId}
              </span>
              <h2 className="text-base font-bold text-gray-900 tracking-tight">
                Live Marketplace Preview
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Jump between sections or preview edits in real time.
              </p>
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between gap-6 bg-white">
            {/* Live Buyer Card Preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Live Buyer Card
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${
                    formData.status === 'active'
                      ? 'border-emerald-300 text-emerald-800 bg-emerald-50/40'
                      : formData.status === 'draft'
                      ? 'border-gray-300 text-gray-700 bg-gray-50'
                      : 'border-rose-300 text-rose-700 bg-rose-50/40'
                  }`}
                >
                  {formData.status}
                </span>
              </div>

              <motion.div
                layout
                className="bg-white border border-gray-300 rounded-none overflow-hidden"
              >
                {/* Cover Image Area */}
                <div className="relative h-44 bg-gray-50 border-b border-gray-300 flex items-center justify-center overflow-hidden">
                  {images.length > 0 ? (
                    <img
                      src={images[0]}
                      alt={formData.name || 'Produce cover'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center px-4">
                      <span className="material-symbols-outlined text-3xl text-gray-300 block mb-1">
                        image
                      </span>
                      <span className="text-[11px] text-gray-400">No cover photo selected</span>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    {formData.is_organic && (
                      <span className="bg-[#1f5400] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                        Organic
                      </span>
                    )}
                    {hasValidDiscount && (
                      <span className="bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                        -{discountPct}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[#007a6c]">
                    <span className="truncate">{selectedCategoryName}</span>
                    {formData.farm_location && (
                      <span className="text-gray-500 font-medium truncate flex items-center gap-0.5 normal-case">
                        <span className="material-symbols-outlined text-[12px]">location_on</span>
                        {formData.farm_location}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 line-clamp-1">
                    {formData.name.trim() || 'Untitled Produce'}
                  </h3>

                  <div className="pt-2 border-t border-gray-200 flex items-baseline justify-between gap-2">
                    <div>
                      {hasValidDiscount ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-[#1f5400] tabular-nums">
                            ETB {numDiscount.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400 line-through tabular-nums">
                            {numPrice.toLocaleString()}
                          </span>
                          <span className="text-[11px] text-gray-500">/ {formData.unit}</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold text-gray-900 tabular-nums">
                            ETB {numPrice > 0 ? numPrice.toLocaleString() : '0.00'}
                          </span>
                          <span className="text-[11px] text-gray-500">/ {formData.unit}</span>
                        </div>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-gray-600 tabular-nums">
                      {formData.stock !== '' ? `${formData.stock} ${formData.unit} avail.` : 'Stock —'}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Interactive Section Navigator */}
            <div className="border border-gray-300 divide-y divide-gray-200 text-xs">
              {STEPS.map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => goToStep(s.num)}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                    step === s.num
                      ? 'bg-gray-50 font-bold text-gray-900'
                      : 'bg-white text-gray-600 hover:bg-gray-50/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 border flex items-center justify-center text-[10px] font-bold ${
                        step === s.num
                          ? 'border-[#1f5400] bg-[#1f5400] text-white'
                          : 'border-gray-300 text-gray-500'
                      }`}
                    >
                      {s.num}
                    </span>
                    <span>{s.title}</span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[16px] ${
                      step === s.num ? 'text-[#007a6c]' : 'text-gray-400'
                    }`}
                  >
                    chevron_right
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT PANE: ANIMATED MULTI-STEP FORM + STICKY FOOTER */}
        <section className="lg:col-span-7 xl:col-span-8 bg-white flex flex-col justify-between min-w-0">
          <div className="flex-1 p-6 sm:p-10 lg:px-14 lg:py-10 max-w-3xl w-full mx-auto">
            {/* Pending Revision Banner */}
            {productData?.pending_revisions_count > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-white border border-gray-300 border-l-4 border-l-blue-600 p-4 flex items-start gap-3"
              >
                <span className="material-symbols-outlined text-blue-600 text-[20px] mt-0.5">
                  info
                </span>
                <div className="text-xs">
                  <p className="font-bold text-gray-900">Revision Pending Moderation</p>
                  <p className="text-gray-600 mt-0.5 leading-relaxed">
                    You have submitted significant changes that are currently being reviewed by
                    administrators. Your existing listing remains live on the marketplace until
                    the revision is approved.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step Contextual Title */}
            <div className="pb-6 mb-8 border-b border-gray-300">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#007a6c] mb-1.5">
                <span className="material-symbols-outlined text-[16px]">
                  {STEPS[step - 1].icon}
                </span>
                <span>
                  Step {step} of 4 — {STEPS[step - 1].title}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                {stepHeadline[step].title}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {stepHeadline[step].subtitle}
              </p>
            </div>

            {/* Validation / Submit Error Alert */}
            <AnimatePresence>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-6 bg-rose-50 border border-rose-300 border-l-4 border-l-rose-600 p-3.5 flex items-start gap-2.5 text-xs font-semibold text-rose-800"
                >
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">
                    error
                  </span>
                  <span>{submitError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Animated Multi-Step Canvas */}
            <AnimatePresence mode="wait" custom={direction}>
              {/* ── STEP 1: CROP IDENTITY & STATUS ── */}
              {step === 1 && (
                <motion.div
                  key="edit-step-1"
                  custom={direction}
                  variants={stepSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Produce / Crop Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Category
                      </label>
                      <select
                        name="category_id"
                        value={formData.category_id}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Listing Status
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-bold text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors"
                      >
                        <option value="active">Active (Visible in Marketplace)</option>
                        <option value="draft">Draft (Hidden)</option>
                        <option value="deactivated">Deactivated (Archived)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Origin Farm Location
                      </label>
                      <input
                        type="text"
                        name="farm_location"
                        value={formData.farm_location}
                        onChange={handleChange}
                        placeholder="e.g. Debre Zeit, Oromia"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007a6c] transition-colors"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Description &amp; Harvest Notes
                      </label>
                      <textarea
                        rows={4}
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors resize-y"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: PRICING & SPECS ── */}
              {step === 2 && (
                <motion.div
                  key="edit-step-2"
                  custom={direction}
                  variants={stepSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Selling Unit
                      </label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors"
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Price / {formData.unit} (ETB) <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="price"
                          value={formData.price}
                          onChange={handleChange}
                          className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-none text-sm font-bold text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                          ETB
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Discount Price (ETB)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="discount_price"
                          value={formData.discount_price}
                          onChange={handleChange}
                          className="w-full px-4 py-3 pr-16 bg-white border border-gray-300 rounded-none text-sm font-bold text-[#1f5400] focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
                        />
                        {hasValidDiscount ? (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5">
                            -{discountPct}%
                          </span>
                        ) : (
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                            ETB
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Animated Unit Conversion Banner */}
                  <AnimatePresence>
                    {numPrice > 0 && (formData.unit === 'kg' || formData.unit === 'quintal') && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border border-gray-300 border-l-4 border-l-[#007a6c] bg-white p-3.5 flex items-center gap-2.5 text-xs text-gray-700"
                      >
                        <span className="material-symbols-outlined text-[#007a6c] text-[18px]">
                          calculate
                        </span>
                        <span>
                          {formData.unit === 'kg' ? (
                            <>
                              Wholesale equivalent:{' '}
                              <strong className="text-gray-900">
                                {quintalEquivalent.toLocaleString()} ETB / Quintal (100 kg)
                              </strong>
                            </>
                          ) : (
                            <>
                              Retail equivalent:{' '}
                              <strong className="text-gray-900">
                                {kgEquivalent.toFixed(2)} ETB / kg
                              </strong>
                            </>
                          )}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Available Stock ({formData.unit}) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="stock"
                        value={formData.stock}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Minimum Order Qty ({formData.unit})
                      </label>
                      <input
                        type="number"
                        min="1"
                        name="min_order_quantity"
                        value={formData.min_order_quantity}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Harvest Date
                      </label>
                      <input
                        type="date"
                        name="harvest_date"
                        value={formData.harvest_date}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Shelf Life (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        name="shelf_life_days"
                        value={formData.shelf_life_days}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
                      />
                    </div>
                  </div>

                  <label
                    htmlFor="is_organic"
                    className={`flex items-start gap-3.5 p-4 border cursor-pointer transition-colors ${
                      formData.is_organic
                        ? 'border-[#1f5400] bg-emerald-50/40'
                        : 'border-gray-300 bg-white hover:bg-gray-50/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="is_organic"
                      name="is_organic"
                      checked={formData.is_organic}
                      onChange={handleChange}
                      className="mt-0.5 w-4 h-4 text-[#1f5400] rounded-none border-gray-300 focus:ring-[#1f5400]"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">
                        Certified Organic / Naturally Cultivated Harvest
                      </span>
                      <span className="text-[11px] text-gray-500 mt-0.5 block">
                        Displayed prominently to wholesale &amp; retail buyers searching for organic
                        lots.
                      </span>
                    </div>
                  </label>
                </motion.div>
              )}

              {/* ── STEP 3: HARVEST GALLERY ── */}
              {step === 3 && (
                <motion.div
                  key="edit-step-3"
                  custom={direction}
                  variants={stepSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-6"
                >
                  <MultiImageUploader
                    images={images}
                    onChange={setImages}
                    maxImages={5}
                    variant="lined"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 border border-gray-300 divide-y sm:divide-y-0 sm:divide-x divide-gray-300 bg-white text-xs">
                    <div className="p-4">
                      <span className="material-symbols-outlined text-[#007a6c] text-[18px] mb-1 block">
                        tune
                      </span>
                      <p className="font-bold text-gray-900">Customize &amp; Zoom</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Hover any uploaded photo and click Customize to zoom, pan, rotate, or
                        enhance.
                      </p>
                    </div>
                    <div className="p-4">
                      <span className="material-symbols-outlined text-[#007a6c] text-[18px] mb-1 block">
                        photo_library
                      </span>
                      <p className="font-bold text-gray-900">Cover Selection</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Click Set Cover or use arrows to arrange which photo buyers see first.
                      </p>
                    </div>
                    <div className="p-4">
                      <span className="material-symbols-outlined text-[#007a6c] text-[18px] mb-1 block">
                        verified
                      </span>
                      <p className="font-bold text-gray-900">Sharp Quality</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Clear product photos improve marketplace conversion and trust.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 4: REVIEW & SAVE ── */}
              {step === 4 && (
                <motion.div
                  key="edit-step-4"
                  custom={direction}
                  variants={stepSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-6"
                >
                  <div className="border border-gray-300 divide-y divide-gray-200 bg-white">
                    <div className="px-5 py-3.5 bg-gray-50/50 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                        Updated Produce Specification Sheet
                      </span>
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="text-[11px] font-bold text-[#007a6c] hover:underline"
                      >
                        Edit Identity
                      </button>
                    </div>

                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Product Title</span>
                      <span className="font-bold text-gray-900">{formData.name}</span>
                    </div>
                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Category &amp; Status</span>
                      <span className="font-semibold text-gray-900 uppercase">
                        {selectedCategoryName} • {formData.status}
                      </span>
                    </div>
                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Unit Price (ETB)</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 tabular-nums">
                          ETB {numPrice.toLocaleString()} / {formData.unit}
                        </span>
                        {hasValidDiscount && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 border border-amber-300 bg-amber-50 text-amber-800">
                            Promo: ETB {numDiscount.toLocaleString()} (-{discountPct}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Stock &amp; MOQ</span>
                      <span className="font-bold text-gray-900 tabular-nums">
                        {formData.stock} {formData.unit} available (MOQ:{' '}
                        {formData.min_order_quantity || 1})
                      </span>
                    </div>
                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Harvest &amp; Gallery</span>
                      <span className="font-semibold text-gray-900">
                        {formData.harvest_date || 'Not set'} • {images.length} photo(s)
                      </span>
                    </div>
                  </div>

                  <div className="border border-gray-300 border-l-4 border-l-[#007a6c] p-4 bg-white flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#007a6c] text-[20px] mt-0.5">
                      shield
                    </span>
                    <div className="text-xs">
                      <p className="font-bold text-gray-900">
                        Live Listing Edit Safeguard
                      </p>
                      <p className="text-gray-600 mt-0.5 leading-relaxed">
                        Minor stock or price tweaks update immediately. Major edits to live
                        published titles, descriptions, or images may create a moderation revision
                        while keeping your current listing active.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* STICKY ONBOARDING BOTTOM NAVIGATION BAR */}
          <div className="sticky bottom-0 z-30 bg-white border-t border-gray-300 px-6 sm:px-10 lg:px-14 py-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-gray-950 border border-gray-300 bg-white hover:bg-gray-50 rounded-none transition-colors inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>{step === 1 ? 'Cancel' : 'Back'}</span>
            </button>

            <div className="flex items-center gap-3">
              {step < 4 && (
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-none text-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-6 sm:px-8 py-2.5 rounded-none text-xs font-bold bg-[#1f5400] hover:bg-[#173f00] text-white border border-[#1f5400] transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Produce...</span>
                  </>
                ) : step === 4 ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>Save Changes</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

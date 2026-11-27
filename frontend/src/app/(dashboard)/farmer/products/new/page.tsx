'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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

const STEPS = [
  { num: 1, key: 'identity', title: 'Crop Identity', short: 'Identity', icon: 'eco' },
  { num: 2, key: 'pricing', title: 'Pricing & Specs', short: 'Pricing', icon: 'payments' },
  { num: 3, key: 'media', title: 'Harvest Gallery', short: 'Photos', icon: 'photo_library' },
  { num: 4, key: 'review', title: 'Review & Launch', short: 'Publish', icon: 'rocket_launch' },
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

export default function NewProductPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [maxVisitedStep, setMaxVisitedStep] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [farmerUser, setFarmerUser] = useState<any>(null);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

        if (userRes.user) {
          setFarmerUser(userRes.user);
          if (userRes.user.farm_location || userRes.user.address) {
            setFormData((prev) => ({
              ...prev,
              farm_location: userRes.user.farm_location || userRes.user.address || '',
            }));
          }
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
      if (!formData.category_id) {
        return 'Please select a produce category.';
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
        return 'Available stock quantity must be a non-negative number.';
      }
    }
    return null;
  };

  const validateAll = (): boolean => {
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
    if (nextStep > maxVisitedStep) {
      setMaxVisitedStep(nextStep);
    }
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
      handlePublish();
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

  const saveDraft = async () => {
    if (!formData.name || formData.name.trim().length === 0) {
      showError('Please enter at least a product name to save a draft.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await api.createProduct({
        name: formData.name.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : undefined,
        description: formData.description.trim() || undefined,
        price: formData.price ? Number(formData.price) : 0,
        discount_price: formData.discount_price ? Number(formData.discount_price) : undefined,
        stock: formData.stock ? Number(formData.stock) : 0,
        unit: formData.unit || 'kg',
        min_order_quantity: Number(formData.min_order_quantity || 1),
        harvest_date: formData.harvest_date || undefined,
        shelf_life_days: formData.shelf_life_days ? Number(formData.shelf_life_days) : undefined,
        is_organic: formData.is_organic,
        farm_location: formData.farm_location.trim() || undefined,
        images,
        image_url: images[0] || undefined,
        status: 'draft',
        is_draft: true,
      });
      showSuccess('Draft saved successfully! You can complete and submit it later.');
      router.push('/farmer/products');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save draft.';
      setSubmitError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!validateAll()) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const finalImages =
        images.length > 0
          ? images
          : [
              'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=600&q=80',
            ];

      const res: any = await api.createProduct({
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
        images: finalImages,
        image_url: finalImages[0] || undefined,
      });

      const modStatus = res?.product?.moderation_status;
      if (modStatus === 'approved') {
        showSuccess('Product listing auto-approved and published live!');
      } else if (modStatus === 'pending') {
        showSuccess('Product submitted! Awaiting administrator review.');
      } else {
        showSuccess('Product published successfully!');
      }
      router.push('/farmer/products');
    } catch (err: any) {
      console.error('Failed to create product:', err);
      const msg = err.response?.data?.message || 'Failed to create product. Please try again.';
      setSubmitError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations for dual-unit helper & discount badge
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
      title: 'Tell buyers about your harvest',
      subtitle: 'Start with a clear crop title, category, regional origin, and cultivation story.',
    },
    2: {
      title: 'Set pricing & agricultural specs',
      subtitle: 'Configure transparent ETB pricing, available stock, minimum order, and freshness specs.',
    },
    3: {
      title: 'Showcase your produce gallery',
      subtitle: 'Upload up to 5 crisp photos so retail & wholesale buyers can inspect harvest quality.',
    },
    4: {
      title: 'Review & publish your listing',
      subtitle: 'Double-check your produce specification before submitting to the GreenHarvest catalog.',
    },
  };

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
              <span className="material-symbols-outlined text-[18px]">close</span>
            </Link>
            <div className="min-w-0">
              
            </div>
          </div>

          {/* Center: Desktop Interactive Stepper Rail */}
          <nav
            aria-label="Product creation steps"
            className="hidden lg:flex items-center border border-gray-300 divide-x divide-gray-300 bg-white"
          >
            {STEPS.map((s) => {
              const isCurrent = step === s.num;
              const isCompleted = step > s.num;
              const isClickable = s.num <= maxVisitedStep || isCompleted;

              return (
                <button
                  key={s.num}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && goToStep(s.num)}
                  className={`px-3.5 py-2 flex items-center gap-2 text-xs transition-colors ${
                    isCurrent
                      ? 'bg-[#1f5400] text-white font-bold'
                      : isCompleted
                      ? 'bg-white text-[#1f5400] font-semibold hover:bg-emerald-50/40 cursor-pointer'
                      : isClickable
                      ? 'bg-white text-gray-700 hover:bg-gray-50 cursor-pointer'
                      : 'bg-white text-gray-400 cursor-not-allowed'
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

          {/* Right: Save & Exit */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={saveDraft}
              disabled={isSubmitting || !formData.name.trim()}
              className="px-3 py-1.5 text-xs font-bold border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-500 text-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save &amp; Exit
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

      {/* ════════════════ SPLIT EDITORIAL ONBOARDING WORKBENCH ════════════════ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT PANE: STORYTELLING + LIVE MARKETPLACE CARD PREVIEW */}
        <aside className="lg:col-span-5 xl:col-span-4 border-b lg:border-b-0 lg:border-r border-gray-300 bg-white flex flex-col justify-between">
          {/* Clean Architectural Left Intro Strip */}
          <div className="px-6 py-5 border-b border-gray-300 bg-white">
            
            <h2 className="text-base font-bold text-gray-900 tracking-tight">
              Marketplace Preview &amp; Progress
            </h2>
            
          </div>

          {/* Live Marketplace Card Preview */}
          <div className="p-6 flex-1 flex flex-col justify-between gap-6 bg-white">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Live Buyer Card Preview
                </span>
                
              </div>

              {/* Actual Lined Preview Card */}
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
                      <span className="text-[11px] text-gray-400">
                        Cover photo will appear here
                      </span>
                    </div>
                  )}

                  {/* Top Badges */}
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
                    {formData.name.trim() || 'Your Crop Title'}
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

            {/* Step Checklist Summary */}
            <div className="border border-gray-300 divide-y divide-gray-200 text-xs">
              {STEPS.map((s) => {
                const done =
                  (s.num === 1 && formData.name.trim().length >= 2 && Boolean(formData.category_id)) ||
                  (s.num === 2 && numPrice > 0 && formData.stock !== '') ||
                  (s.num === 3 && images.length > 0) ||
                  (s.num === 4 && step === 4);

                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => (s.num <= maxVisitedStep ? goToStep(s.num) : undefined)}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors ${
                      step === s.num ? 'bg-gray-50 font-bold text-gray-900' : 'bg-white text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-5 h-5 border flex items-center justify-center text-[10px] font-bold ${
                          done
                            ? 'bg-[#1f5400] border-[#1f5400] text-white'
                            : step === s.num
                            ? 'border-[#007a6c] text-[#007a6c]'
                            : 'border-gray-300 text-gray-400'
                        }`}
                      >
                        {done ? '✓' : s.num}
                      </span>
                      <span>{s.title}</span>
                    </div>
                    {step === s.num && (
                      <span className="text-[10px] font-bold uppercase text-[#007a6c]">Active</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* RIGHT PANE: ANIMATED ONBOARDING STEP CONTENT + STICKY FOOTER */}
        <section className="lg:col-span-7 xl:col-span-8 bg-white flex flex-col justify-between min-w-0">
          <div className="flex-1 p-6 sm:p-10 lg:px-14 lg:py-10 max-w-3xl w-full mx-auto">
            {/* Step Contextual Title */}
            <div className="pb-6 mb-8 border-b border-gray-300">
              
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                {stepHeadline[step].title}
              </h2>
             
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
              {/* ── STEP 1: CROP IDENTITY ── */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  custom={direction}
                  variants={stepSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-6"
                >
                  {/* Form Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Product Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder=""
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007a6c] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                        Category <span className="text-rose-600">*</span>
                      </label>
                      <select
                        name="category_id"
                        value={formData.category_id}
                        onChange={handleChange}
                        disabled={loadingCategories}
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
                        placeholder="Describe crop grade, grain size, moisture level, organic cultivation methods, and packaging..."
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007a6c] transition-colors resize-y"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: PRICING & AGRICULTURAL SPECS ── */}
              {step === 2 && (
                <motion.div
                  key="step-2"
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
                          placeholder="120.00"
                          className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-none text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                          ETB
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
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
                          placeholder="105.00"
                          className="w-full px-4 py-3 pr-16 bg-white border border-gray-300 rounded-none text-sm font-bold text-[#1f5400] placeholder-gray-400 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
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
                              At <strong>{numPrice.toLocaleString()} ETB / kg</strong>, wholesale
                              rate equals{' '}
                              <strong className="text-gray-900">
                                {quintalEquivalent.toLocaleString()} ETB / Quintal (100 kg)
                              </strong>
                              .
                            </>
                          ) : (
                            <>
                              At <strong>{numPrice.toLocaleString()} ETB / quintal</strong>, retail
                              rate equals{' '}
                              <strong className="text-gray-900">
                                {kgEquivalent.toFixed(2)} ETB / kg
                              </strong>
                              .
                            </>
                          )}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Inventory & Dates */}
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
                        placeholder="e.g. 500"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
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
                        placeholder="1"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
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
                        placeholder="e.g. 90"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-none text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007a6c] transition-colors tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Selectable Organic Certification Box */}
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
                        Certified Organic / Naturally Grown Produce
                      </span>
                      <span className="text-[11px] text-gray-500 mt-0.5 block">
                        Check if cultivated without synthetic chemical pesticides or industrial
                        fertilizers.
                      </span>
                    </div>
                  </label>
                </motion.div>
              )}

              {/* ── STEP 3: HARVEST GALLERY ── */}
              {step === 3 && (
                <motion.div
                  key="step-3"
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
                        wb_sunny
                      </span>
                      <p className="font-bold text-gray-900">Natural Daylight</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Photograph crops in crisp natural lighting without heavy filters.
                      </p>
                    </div>
                    <div className="p-4">
                      <span className="material-symbols-outlined text-[#007a6c] text-[18px] mb-1 block">
                        grain
                      </span>
                      <p className="font-bold text-gray-900">Close-Up Texture</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Include a close-up shot so wholesale buyers see grain or fruit grade.
                      </p>
                    </div>
                    <div className="p-4">
                      <span className="material-symbols-outlined text-[#007a6c] text-[18px] mb-1 block">
                        inventory_2
                      </span>
                      <p className="font-bold text-gray-900">Packaging View</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Optional photo of sacks, crates, or bulk harvest storage.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 4: REVIEW & LAUNCH ── */}
              {step === 4 && (
                <motion.div
                  key="step-4"
                  custom={direction}
                  variants={stepSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-6"
                >
                  {/* Structured Review Specification Sheet */}
                  <div className="border border-gray-300 divide-y divide-gray-200 bg-white">
                    <div className="px-5 py-3.5 bg-gray-50/50 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                        Listing Specification Sheet
                      </span>
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="text-[11px] font-bold text-[#007a6c] hover:underline"
                      >
                        Edit Details
                      </button>
                    </div>

                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Product Title</span>
                      <span className="font-bold text-gray-900">{formData.name}</span>
                    </div>
                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Category &amp; Origin</span>
                      <span className="font-semibold text-gray-900">
                        {selectedCategoryName}
                        {formData.farm_location ? ` • ${formData.farm_location}` : ''}
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
                      <span className="text-gray-500 font-medium">Stock &amp; Minimum Order</span>
                      <span className="font-bold text-gray-900 tabular-nums">
                        {formData.stock} {formData.unit} available (MOQ:{' '}
                        {formData.min_order_quantity || 1} {formData.unit})
                      </span>
                    </div>
                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Harvest &amp; Shelf Life</span>
                      <span className="font-semibold text-gray-900">
                        {formData.harvest_date || 'Not set'} •{' '}
                        {formData.shelf_life_days
                          ? `${formData.shelf_life_days} days shelf life`
                          : 'Standard'}
                      </span>
                    </div>
                    <div className="px-5 py-3 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Cultivation &amp; Photos</span>
                      <span className="font-semibold text-gray-900">
                        {formData.is_organic ? 'Certified Organic' : 'Conventional'} •{' '}
                        {images.length > 0
                          ? `${images.length} uploaded image(s)`
                          : 'Default cover photo'}
                      </span>
                    </div>
                    {formData.description && (
                      <div className="px-5 py-3.5 text-xs">
                        <span className="text-gray-500 font-medium block mb-1">Description</span>
                        <p className="text-gray-800 leading-relaxed">{formData.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Moderation Policy Notice */}
                  <div
                    className={`border border-gray-300 border-l-4 p-4 bg-white flex items-start gap-3 ${
                      farmerUser?.is_verified ? 'border-l-[#1f5400]' : 'border-l-amber-500'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] mt-0.5 ${
                        farmerUser?.is_verified ? 'text-[#1f5400]' : 'text-amber-600'
                      }`}
                    >
                      {farmerUser?.is_verified ? 'verified' : 'policy'}
                    </span>
                    <div className="text-xs">
                      <p className="font-bold text-gray-900">
                        {farmerUser?.is_verified
                          ? 'Verified Seller: Eligible for Hybrid Auto-Publication'
                          : 'Provisional Seller: Administrator Moderation Queue'}
                      </p>
                      <p className="text-gray-600 mt-0.5 leading-relaxed">
                        {farmerUser?.is_verified
                          ? 'Your listing passes through automated quality & price-corridor checks and publishes immediately if clean.'
                          : 'Because your farm KYC is not yet verified, newly published listings undergo human review before going live to buyers.'}
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
              <button
                type="button"
                onClick={saveDraft}
                disabled={isSubmitting || !formData.name.trim()}
                className="px-4 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-none text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save as Draft
              </button>

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
                    <span>Publishing...</span>
                  </>
                ) : step === 4 ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                    <span>Publish to Marketplace</span>
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

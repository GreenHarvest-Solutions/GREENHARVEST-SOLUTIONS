'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Product } from '@/types';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';

const STAR_VALUES = [1, 2, 3, 4, 5];

const IMAGE_VIEWS = [
    { label: 'Center view', position: '50% 50%' },
    { label: 'Top view', position: '50% 18%' },
    { label: 'Bottom view', position: '50% 82%' },
];

interface ProductReview {
    id?: number | string;
    review_id?: number | string;
    user_name?: string;
    name?: string;
    rating: number | string;
    comment?: string;
    created_at?: string;
}

interface ProductReviewsData {
    average_rating?: number | string;
    total_reviews?: number | string;
    reviews?: ProductReview[];
}

interface RelatedProduct {
    id: number | string;
    name: string;
    price: number | string;
    discount_price?: number | string | null;
    image_url?: string;
    category_name?: string;
}

const getApiErrorMessage = (err: unknown, fallback: string) => {
    if (typeof err === 'object' && err !== null) {
        const candidate = err as { response?: { data?: { message?: string } } };
        if (candidate.response?.data?.message) {
            return candidate.response.data.message;
        }
    }
    return fallback;
};

const formatMoney = (value: number | string) =>
    Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const formatDate = (value?: string) =>
    value
        ? new Date(value).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
        : 'Recently';

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [reviewsData, setReviewsData] = useState<ProductReviewsData | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [addingToCart, setAddingToCart] = useState(false);
    const [addedSuccess, setAddedSuccess] = useState(false);
    const [buyingNow, setBuyingNow] = useState(false);
    const [activeImage, setActiveImage] = useState(0);
    const [isSaved, setIsSaved] = useState(false);
    const { showError } = useToast();
    const { addToCart, openCart, cart, clearCart } = useCart();

    // Review form state
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewError, setReviewError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const [productRes, reviewsRes] = await Promise.all([
                    api.getProductById(id),
                    api.getProductReviews(id).catch(() => null)
                ]);
                setProduct(productRes.product);
                if (reviewsRes) {
                    setReviewsData(reviewsRes);
                }

                // Fetch related products from same farmer
                if (productRes.product?.farmer_id) {
                    try {
                        const related = await api.getProducts({ farmer_id: productRes.product.farmer_id, limit: 6 });
                        setRelatedProducts((related.products || []).filter((p: RelatedProduct) => p.id !== productRes.product.id).slice(0, 5));
                    } catch { /* silent */ }
                }
            } catch (err) {
                console.error("Failed to load product details", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const handleAddToCart = async () => {
        if (!product) return;
        setAddingToCart(true);
        try {
            await addToCart(product.id, quantity);
            setAddedSuccess(true);
            setTimeout(() => setAddedSuccess(false), 2000);
        } catch (err: unknown) {
            console.error("Failed to add to cart", err);
            showError(getApiErrorMessage(err, "Failed to add to cart. Please try again."));
        } finally {
            setAddingToCart(false);
        }
    };

    const handleBuyNow = async () => {
        if (!product) return;
        setBuyingNow(true);
        try {
            await clearCart();
            await addToCart(product.id, quantity);
            router.push('/buyer/checkout'); // Redirect to checkout directly
        } catch (err: unknown) {
            console.error("Failed to add to cart for buy now", err);
            showError(getApiErrorMessage(err, "Failed to process. Please try again."));
            setBuyingNow(false);
        }
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!product) return;
        setReviewError('');
        setIsSubmittingReview(true);
        try {
            await api.createReview({
                product_id: product.id,
                rating,
                comment: comment.trim() || undefined
            });
            // Refresh reviews
            const reviewsRes = await api.getProductReviews(id).catch(() => null);
            if (reviewsRes) {
                setReviewsData(reviewsRes);
            }
            setRating(5);
            setComment('');
            alert("Review submitted successfully!");
        } catch (err: unknown) {
            console.error("Failed to submit review", err);
            setReviewError(getApiErrorMessage(err, "Failed to submit review. Have you already reviewed this product?"));
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleShare = async () => {
        if (!product || typeof window === 'undefined') return;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: product.name,
                    text: `Check out ${product.name} on GreenHarvest.`,
                    url: window.location.href,
                });
                return;
            }
            await navigator.clipboard.writeText(window.location.href);
            alert("Product link copied to clipboard.");
        } catch (err: unknown) {
            if (!(err instanceof Error) || err.name !== 'AbortError') {
                console.error("Failed to share product", err);
            }
        }
    };

    const handleSave = () => {
        setIsSaved((previous) => !previous);
    };

    const hasDiscount = Boolean(product?.discount_price && Number(product.discount_price) > 0 && Number(product.discount_price) < Number(product.price));
    const discountPercent = hasDiscount ? Math.round((1 - Number(product!.discount_price) / Number(product!.price)) * 100) : 0;
    const displayPrice = hasDiscount ? Number(product!.discount_price) : (product ? Number(product.price) : 0);
    const averageRating = reviewsData?.average_rating ? Number(reviewsData.average_rating) : 0;
    const totalReviews = reviewsData?.total_reviews ? Number(reviewsData.total_reviews) : 0;
    const stockValue = product ? Number(product.stock) : 0;
    const isInStock = stockValue > 0;
    const stockLabel = stockValue > 50 ? 'In stock' : stockValue > 0 ? 'Low stock' : 'Out of stock';
    const stockTone = stockValue > 50 ? 'text-[#286c00]' : stockValue > 0 ? 'text-amber-700' : 'text-red-700';

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin border-4 border-[#286c00] border-t-transparent rounded-full"></div>
                    <span className="text-sm font-medium text-[#6B7280]">Loading product...</span>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white px-4">
                <div className="border border-[#D1D5DB] bg-white p-8 text-center">
                    <p className="text-sm font-bold text-[#111827]">Product not found.</p>
                    <button
                        type="button"
                        onClick={() => router.push('/buyer/dashboard')}
                        className="mt-4 border border-[#286c00] bg-white px-4 py-2 text-xs font-bold text-[#286c00] transition-colors hover:bg-[#F0FDF4]"
                    >
                        Back to marketplace
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-body text-[#111827] antialiased">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-[#D1D5DB] bg-white">
                <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
                    <div className="flex shrink-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            aria-label="Go back"
                            className="flex h-9 w-9 items-center justify-center border border-[#D1D5DB] bg-white text-[#4B5563] transition-colors hover:border-[#286c00] hover:text-[#286c00]"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </button>
                        <Link href="/buyer/dashboard" className="flex items-center gap-2 text-[#286c00]">
                            <span className="material-symbols-outlined text-[24px]">eco</span>
                            <span className="text-lg font-extrabold tracking-tight">GreenHarvest</span>
                        </Link>
                    </div>

                    <div className="hidden flex-1 justify-center px-4 md:flex">
                        <div className="relative w-full max-w-xl">
                            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-[#6B7280]">search</span>
                            <input
                                type="text"
                                aria-label="Search products"
                                placeholder="Search produce, farms, and more"
                                className="h-10 w-full rounded-none border border-[#D1D5DB] bg-white pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#286c00] focus:outline-none focus:ring-1 focus:ring-[#286c00]"
                            />
                        </div>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                        <Link
                            href="/buyer/profile"
                            className="flex h-10 items-center gap-2 border border-transparent px-2 text-xs font-semibold text-[#4B5563] transition-colors hover:text-[#286c00]"
                        >
                            <span className="material-symbols-outlined text-[21px]">person</span>
                            <span className="hidden sm:inline">Account</span>
                        </Link>
                        <button
                            type="button"
                            onClick={openCart}
                            aria-label="Open cart"
                            className="relative flex h-10 items-center gap-2 border border-[#D1D5DB] bg-white px-3 text-xs font-semibold text-[#4B5563] transition-colors hover:border-[#286c00] hover:text-[#286c00]"
                        >
                            <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                            <span className="hidden sm:inline">Cart</span>
                            {cart.length > 0 && (
                                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center border border-white bg-[#286c00] px-1 text-[10px] font-bold leading-none text-white tabular-nums">
                                    {cart.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {/* Breadcrumbs */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-[#6B7280]">
                    <Link href="/" className="transition-colors hover:text-[#286c00]">Home</Link>
                    <span className="material-symbols-outlined text-[14px] text-[#9CA3AF]">chevron_right</span>
                    <Link href="/products" className="transition-colors hover:text-[#286c00]">{product.category_name || 'Produce'}</Link>
                    <span className="material-symbols-outlined text-[14px] text-[#9CA3AF]">chevron_right</span>
                    <span className="font-semibold text-[#111827]" aria-current="page">{product.name}</span>
                </nav>

                <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,66fr)_minmax(0,34fr)] xl:gap-8">
                    {/* Hero card */}
                    <section className="min-w-0 border border-[#D1D5DB] bg-white lg:col-start-1 lg:row-start-1">
                        <div className="p-5 sm:p-6">
                            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
                                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#286c00]">
                                    <span className="material-symbols-outlined text-[16px]">verified</span>
                                    Farm-direct listing
                                </p>
                                <span className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isInStock ? 'border-[#286c00] text-[#286c00]' : 'border-red-300 text-red-700'}`}>
                                    {stockLabel}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {/* Gallery */}
                                <div className="min-w-0">
                                    <div className="relative aspect-square overflow-hidden border border-[#D1D5DB] bg-white">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                className="h-full w-full object-cover"
                                                style={{ objectPosition: IMAGE_VIEWS[activeImage].position }}
                                                alt={product.name}
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-white">
                                                <span className="material-symbols-outlined text-6xl text-[#D1D5DB]">image</span>
                                            </div>
                                        )}
                                        {hasDiscount && (
                                            <span className="absolute left-3 top-3 bg-[#286c00] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white tabular-nums">
                                                Save {discountPercent}%
                                            </span>
                                        )}
                                    </div>

                                    {/* 3-thumbnail rail */}
                                    <div className="mt-2 grid grid-cols-3 gap-2" aria-label="Product image views">
                                        {IMAGE_VIEWS.map((view, index) => (
                                            <button
                                                key={view.label}
                                                type="button"
                                                onClick={() => setActiveImage(index)}
                                                aria-label={`Show ${view.label}`}
                                                aria-pressed={activeImage === index}
                                                className={`relative aspect-square overflow-hidden border bg-white transition-colors ${activeImage === index ? 'border-[#286c00]' : 'border-[#D1D5DB] hover:border-[#9CA3AF]'}`}
                                            >
                                                {product.image_url ? (
                                                    <img
                                                        src={product.image_url}
                                                        className="h-full w-full object-cover"
                                                        style={{ objectPosition: view.position }}
                                                        alt={`${product.name} — ${view.label}`}
                                                    />
                                                ) : (
                                                    <span className="flex h-full w-full items-center justify-center">
                                                        <span className="material-symbols-outlined text-xl text-[#D1D5DB]">image</span>
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick info */}
                                <div className="flex min-w-0 flex-col">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6B7280]">
                                        {product.category_name || 'Fresh produce'}
                                    </p>
                                    <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight text-[#111827]">
                                        {product.name}
                                    </h1>

                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                        <span className="flex items-center text-[#286c00]" aria-hidden="true">
                                            {STAR_VALUES.map((star) => (
                                                <span
                                                    key={star}
                                                    className={`material-symbols-outlined text-[15px] ${star <= Math.round(averageRating) ? 'text-[#286c00]' : 'text-[#D1D5DB]'}`}
                                                    style={{ fontVariationSettings: star <= Math.round(averageRating) ? '"FILL" 1' : '"FILL" 0' }}
                                                >
                                                    star
                                                </span>
                                            ))}
                                        </span>
                                        <span className="font-bold text-[#111827] tabular-nums">{averageRating.toFixed(1)}</span>
                                        <span className="text-[#D1D5DB]">|</span>
                                        <a href="#reviews" className="text-[#6B7280] underline decoration-[#D1D5DB] underline-offset-2 transition-colors hover:text-[#286c00]">
                                            <span className="tabular-nums">{totalReviews}</span> {totalReviews === 1 ? 'Review' : 'Reviews'}
                                        </a>
                                    </div>

                                    {/* Price accent box */}
                                    <div className="mt-4 flex items-stretch border border-[#D1D5DB] bg-white">
                                        <div className="flex w-14 shrink-0 items-center justify-center bg-[#286c00] px-2 text-[10px] font-bold uppercase tracking-wider text-white">
                                            ETB
                                        </div>
                                        <div className="min-w-0 flex-1 px-4 py-3">
                                            <div className="flex flex-wrap items-baseline gap-2">
                                                <span className="text-3xl font-black leading-none tracking-tight text-[#286c00] tabular-nums">
                                                    {formatMoney(displayPrice)}
                                                </span>
                                                {hasDiscount && (
                                                    <span className="text-sm font-medium text-[#9CA3AF] line-through tabular-nums">
                                                        ETB {formatMoney(product.price)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#6B7280]">
                                                <span>per unit</span>
                                                <span>•</span>
                                                <span>tax excluded</span>
                                                {hasDiscount && (
                                                    <span className="border border-[#286c00] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#286c00]">
                                                        Save {discountPercent}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2x2 metadata grid */}
                                    <div className="mt-4 grid grid-cols-2 gap-px border border-[#D1D5DB] bg-[#E5E7EB]">
                                        <Link
                                            href={`/buyer/farmer/${product.farmer_id}`}
                                            className="group bg-white p-3 transition-colors hover:bg-[#F9FAFB]"
                                        >
                                            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Farm</p>
                                            <p className="mt-1 flex items-center gap-1 text-xs font-bold leading-tight text-[#111827] transition-colors group-hover:text-[#286c00]">
                                                <span className="truncate">{product.farmer_name || 'Partner Farm'}</span>
                                                <span className="material-symbols-outlined shrink-0 text-[12px] text-[#9CA3AF] transition-colors group-hover:text-[#286c00]">open_in_new</span>
                                            </p>
                                            <p className="mt-0.5 truncate text-[10px] text-[#6B7280]">{product.farm_location || 'Local region'}</p>
                                        </Link>

                                        <div className="bg-white p-3">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Category</p>
                                            <p className="mt-1 text-xs font-bold leading-tight text-[#111827]">{product.category_name || 'General'}</p>
                                            <p className="mt-0.5 text-[10px] text-[#6B7280]">Marketplace</p>
                                        </div>

                                        <div className="bg-white p-3">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Stock</p>
                                            <p className={`mt-1 text-xs font-bold leading-tight tabular-nums ${stockTone}`}>
                                                {isInStock ? `${stockValue.toLocaleString('en-US')} available` : 'Out of stock'}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-[#6B7280]">Ready to ship</p>
                                        </div>

                                        <div className="bg-white p-3">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Listed</p>
                                            <p className="mt-1 text-xs font-bold leading-tight text-[#111827] tabular-nums">{formatDate(product.created_at)}</p>
                                            <p className="mt-0.5 text-[10px] text-[#6B7280]">On GreenHarvest</p>
                                        </div>
                                    </div>

                                    <div className="flex-1" aria-hidden="true"></div>

                                    <div className="mt-4 flex items-start gap-2 border-t border-[#E5E7EB] pt-3 text-[11px] leading-relaxed text-[#6B7280]">
                                        <span className="material-symbols-outlined mt-0.5 text-[16px] text-[#286c00]">local_shipping</span>
                                        <p>Ships directly from the farm. Freshness and quality checked before dispatch.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Sticky purchase panel */}
                    <aside className="min-w-0 self-start border border-[#D1D5DB] bg-white lg:sticky lg:top-[89px] lg:col-start-2 lg:row-span-2 lg:row-start-1">
                        <div className="border-b border-[#E5E7EB] p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6B7280]">Purchase</p>
                                    <p className="mt-1 truncate text-sm font-extrabold text-[#111827]">{product.name}</p>
                                </div>
                                <span className={`shrink-0 border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${isInStock ? 'border-[#286c00] text-[#286c00]' : 'border-red-300 text-red-700'}`}>
                                    {isInStock ? 'Available' : 'Sold out'}
                                </span>
                            </div>
                            <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-[#E5E7EB] pt-3">
                                <span className="text-[10px] uppercase tracking-wider text-[#6B7280]">Unit price</span>
                                <span className="text-lg font-black text-[#286c00] tabular-nums">ETB {formatMoney(displayPrice)}</span>
                            </div>
                        </div>

                        <div className="p-5">
                            {/* Freshness Commitment */}
                            <div className="border border-[#E5E7EB] p-4">
                                <p className="flex items-center gap-2 text-xs font-bold text-[#286c00]">
                                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                                    Freshness Commitment
                                </p>
                                <div className="mt-3 space-y-3">
                                    <div className="flex gap-2.5">
                                        <span className="material-symbols-outlined mt-0.5 text-[16px] text-[#286c00]">local_shipping</span>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-[#111827]">Fast Delivery</p>
                                            <p className="mt-0.5 text-[10px] text-[#6B7280]">Direct from farm to your door</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2.5">
                                        <span className="material-symbols-outlined text-[16px] text-[#286c00]">replay</span>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-[#111827]">Quality Guarantee</p>
                                            <p className="mt-0.5 text-[10px] text-[#6B7280]">Checked before dispatch</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2.5">
                                        <span className="material-symbols-outlined mt-0.5 text-[16px] text-[#286c00]">verified_user</span>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-[#111827]">Secure Payments</p>
                                            <p className="mt-0.5 text-[10px] text-[#6B7280]">Encrypted processing.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="mt-5">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-bold text-[#111827]">Quantity</label>
                                    <span className="text-[10px] text-[#6B7280] tabular-nums">{stockValue.toLocaleString('en-US')} available</span>
                                </div>
                                <div className="mt-2 flex items-stretch border border-[#D1D5DB] bg-white">
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        disabled={quantity <= 1}
                                        aria-label="Decrease quantity"
                                        className="flex h-11 w-11 items-center justify-center border-r border-[#D1D5DB] bg-white text-[#4B5563] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:text-[#D1D5DB]"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">remove</span>
                                    </button>
                                    <input
                                        type="text"
                                        readOnly
                                        value={quantity}
                                        aria-label="Quantity"
                                        className="h-11 min-w-0 flex-1 rounded-none border-0 bg-white p-0 text-center text-sm font-bold text-[#111827] focus:ring-0 tabular-nums"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(Math.min(stockValue, quantity + 1))}
                                        disabled={quantity >= stockValue}
                                        aria-label="Increase quantity"
                                        className="flex h-11 w-11 items-center justify-center border-l border-[#D1D5DB] bg-white text-[#4B5563] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:text-[#D1D5DB]"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* Subtotal */}
                            <div className="mt-4 border border-[#D1D5DB] bg-white p-4">
                                <div className="flex items-baseline justify-between gap-2 text-sm">
                                    <span className="text-[#4B5563]">
                                        Subtotal <span className="text-[#6B7280] tabular-nums">({quantity} {quantity === 1 ? 'item' : 'items'})</span>
                                    </span>
                                    <span className="text-lg font-black text-[#111827] tabular-nums">ETB {formatMoney(displayPrice * quantity)}</span>
                                </div>
                                {hasDiscount && (
                                    <div className="mt-2 flex items-center justify-between border-t border-[#E5E7EB] pt-2 text-[11px]">
                                        <span className="font-medium text-[#286c00]">You save</span>
                                        <span className="font-bold text-[#286c00] tabular-nums">ETB {formatMoney((Number(product.price) - Number(product.discount_price!)) * quantity)}</span>
                                    </div>
                                )}
                                <p className="mt-2 text-[10px] text-[#6B7280]">Tax excluded. Delivery calculated at checkout.</p>
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddToCart}
                                    disabled={addingToCart || addedSuccess || !isInStock}
                                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-none text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${addedSuccess ? 'bg-[#1f5400]' : 'bg-[#286c00] hover:bg-[#1f5400]'}`}
                                >
                                    {addingToCart ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    ) : addedSuccess ? (
                                        <>
                                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                            Added to Cart
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                                            Add to Cart
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBuyNow}
                                    disabled={buyingNow || !isInStock}
                                    className="flex h-12 w-full items-center justify-center gap-2 rounded-none border border-[#286c00] bg-white text-sm font-bold text-[#286c00] transition-colors hover:bg-[#F0FDF4] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {buyingNow ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#286c00] border-t-transparent"></div>
                                    ) : (
                                        'Buy Now'
                                    )}
                                </button>
                            </div>

                            {/* Share / Save */}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="flex h-10 items-center justify-center gap-2 rounded-none border border-[#D1D5DB] bg-white text-xs font-bold text-[#4B5563] transition-colors hover:border-[#286c00] hover:text-[#286c00]"
                                >
                                    <span className="material-symbols-outlined text-[16px]">share</span>
                                    Share
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    aria-pressed={isSaved}
                                    className={`flex h-10 items-center justify-center gap-2 rounded-none border bg-white text-xs font-bold transition-colors ${isSaved ? 'border-[#286c00] text-[#286c00]' : 'border-[#D1D5DB] text-[#4B5563] hover:border-[#286c00] hover:text-[#286c00]'}`}
                                >
                                    <span
                                        className="material-symbols-outlined text-[16px]"
                                        style={{ fontVariationSettings: isSaved ? '"FILL" 1' : '"FILL" 0' }}
                                    >
                                        favorite
                                    </span>
                                    {isSaved ? 'Saved' : 'Save'}
                                </button>
                            </div>

                            <div className="mt-4 flex items-center justify-center gap-2 border-t border-[#E5E7EB] pt-3 text-[10px] text-[#6B7280]">
                                <span className="material-symbols-outlined text-[14px] text-[#286c00]">lock</span>
                                Secure checkout • Farm-direct delivery
                            </div>
                        </div>
                    </aside>

                    {/* Supporting content */}
                    <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
                        {/* Description */}
                        <section className="border border-[#D1D5DB] bg-white p-5 sm:p-6">
                            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#111827]">Product Description</h2>
                                <span className="material-symbols-outlined text-[18px] text-[#9CA3AF]">notes</span>
                            </div>
                            <p className="mt-4 text-[13px] leading-7 text-[#4B5563] [text-wrap:pretty]">
                                {product.description || 'No description provided for this product.'}
                            </p>
                        </section>

                        {/* Farmer profile card */}
                        <Link
                            href={`/buyer/farmer/${product.farmer_id}`}
                            className="group block border border-[#D1D5DB] bg-white p-5 transition-colors hover:border-[#286c00] sm:p-6"
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-[#286c00] bg-[#286c00] text-xl font-bold text-white">
                                    {(product.farmer_name || 'F').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="flex items-center gap-1.5 truncate text-base font-extrabold text-[#111827] transition-colors group-hover:text-[#286c00]">
                                        <span className="truncate">{product.farmer_name || 'Partner Farm'}</span>
                                        <span className="material-symbols-outlined shrink-0 text-[16px] text-[#286c00]">verified</span>
                                    </h2>
                                    <p className="mt-1 text-xs text-[#6B7280]">
                                        {product.farm_location || 'Local region'} • GreenHarvest Verified Farmer
                                    </p>
                                </div>
                                <span className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#D1D5DB] bg-white px-4 py-2 text-xs font-bold text-[#286c00] transition-colors group-hover:border-[#286c00]">
                                    Visit Store
                                    <span className="material-symbols-outlined text-[16px]">storefront</span>
                                </span>
                            </div>
                        </Link>

                        {/* Customer reviews */}
                        <section id="reviews" className="scroll-mt-24 border border-[#D1D5DB] bg-white p-5 sm:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
                                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[#111827]">
                                    <span className="material-symbols-outlined text-[18px] text-[#286c00]">reviews</span>
                                    Customer Reviews
                                </h2>
                                <span className="border border-[#D1D5DB] bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6B7280] tabular-nums">
                                    {totalReviews} {totalReviews === 1 ? 'Review' : 'Reviews'}
                                </span>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center gap-4 border border-[#E5E7EB] bg-white p-4">
                                <span className="text-4xl font-black leading-none text-[#111827] tabular-nums">{averageRating.toFixed(1)}</span>
                                <div>
                                    <div className="flex items-center text-[#286c00]" aria-hidden="true">
                                        {STAR_VALUES.map((star) => (
                                            <span
                                                key={star}
                                                className={`material-symbols-outlined text-[18px] ${star <= Math.round(averageRating) ? 'text-[#286c00]' : 'text-[#D1D5DB]'}`}
                                                style={{ fontVariationSettings: star <= Math.round(averageRating) ? '"FILL" 1' : '"FILL" 0' }}
                                            >
                                                star
                                            </span>
                                        ))}
                                    </div>
                                    <p className="mt-1 text-[10px] text-[#6B7280] tabular-nums">{totalReviews} customer {totalReviews === 1 ? 'rating' : 'ratings'}</p>
                                </div>
                                <a
                                    href="#write-review"
                                    className="ml-auto inline-flex items-center gap-1 border border-[#D1D5DB] bg-white px-3 py-2 text-[11px] font-bold text-[#286c00] transition-colors hover:border-[#286c00]"
                                >
                                    Write a review
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                </a>
                            </div>

                            <div className="mt-5 divide-y divide-[#E5E7EB]">
                                {!reviewsData?.reviews || reviewsData.reviews.length === 0 ? (
                                    <div className="border border-[#D1D5DB] bg-white p-6 text-center">
                                        <p className="text-sm font-bold text-[#111827]">No reviews yet</p>
                                        <p className="mt-1 text-xs text-[#6B7280]">Be the first to share your experience with this product.</p>
                                    </div>
                                ) : (
                                    reviewsData.reviews.map((review: ProductReview) => {
                                        const reviewName = review.user_name || review.name || 'Anonymous';
                                        const reviewRating = Number(review.rating) || 0;
                                        return (
                                            <div key={review.id || review.review_id} className="py-4 first:pt-0 last:pb-0">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#D1D5DB] bg-white text-xs font-bold uppercase text-[#111827]">
                                                        {reviewName.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center" aria-label={`${reviewRating} out of 5 stars`}>
                                                                {STAR_VALUES.map((star) => (
                                                                    <span
                                                                        key={star}
                                                                        className={`material-symbols-outlined text-[13px] ${star <= reviewRating ? 'text-[#286c00]' : 'text-[#D1D5DB]'}`}
                                                                        style={{ fontVariationSettings: star <= reviewRating ? '"FILL" 1' : '"FILL" 0' }}
                                                                    >
                                                                        star
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <span className="text-[10px] text-[#6B7280] tabular-nums">{formatDate(review.created_at)}</span>
                                                        </div>
                                                        <p className="mt-1.5 text-xs leading-relaxed text-[#374151]">{review.comment || 'No comment provided.'}</p>
                                                        <p className="mt-2 text-[10px] text-[#6B7280]">{reviewName.substring(0, 4)}***</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Review form */}
                            <div id="write-review" className="mt-6 scroll-mt-24 border-t border-[#E5E7EB] pt-5">
                                <h3 className="text-sm font-bold text-[#111827]">Write a Review</h3>
                                <p className="mt-1 text-[11px] text-[#6B7280]">Share your experience with this product.</p>

                                {reviewError && (
                                    <div role="alert" className="mt-3 border border-red-300 bg-white p-3 text-xs text-red-700">
                                        {reviewError}
                                    </div>
                                )}

                                <form onSubmit={handleSubmitReview} className="mt-4 space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#374151]">Your rating</label>
                                        <div className="mt-2 flex flex-wrap items-center gap-1">
                                            {STAR_VALUES.map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setRating(star)}
                                                    aria-label={`Rate ${star} out of 5`}
                                                    aria-pressed={rating === star}
                                                    className={`flex h-9 w-9 items-center justify-center border bg-white transition-colors ${star <= rating ? 'border-[#286c00] text-[#286c00]' : 'border-[#D1D5DB] text-[#9CA3AF] hover:border-[#286c00] hover:text-[#286c00]'}`}
                                                >
                                                    <span
                                                        className="material-symbols-outlined text-[20px]"
                                                        style={{ fontVariationSettings: star <= rating ? '"FILL" 1' : '"FILL" 0' }}
                                                    >
                                                        star
                                                    </span>
                                                </button>
                                            ))}
                                            <span className="ml-2 text-xs font-bold text-[#111827] tabular-nums">{rating}/5</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="review-comment" className="block text-[11px] font-bold uppercase tracking-wider text-[#374151]">
                                            Your review <span className="font-medium normal-case tracking-normal text-[#6B7280]">(optional)</span>
                                        </label>
                                        <textarea
                                            id="review-comment"
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            rows={4}
                                            placeholder="What did you think of this product?"
                                            className="mt-2 w-full resize-none rounded-none border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#286c00] focus:outline-none focus:ring-1 focus:ring-[#286c00]"
                                        ></textarea>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmittingReview}
                                        className="inline-flex items-center justify-center gap-2 rounded-none bg-[#286c00] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1f5400] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSubmittingReview ? (
                                            <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                                                Submitting...
                                            </>
                                        ) : (
                                            'Submit Review'
                                        )}
                                    </button>
                                </form>
                            </div>
                        </section>

                        {/* More from this farmer */}
                        {relatedProducts.length > 0 && (
                            <section className="space-y-3">
                                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#D1D5DB] pb-3">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#286c00]">From the same farm</p>
                                        <h2 className="mt-1 flex items-center gap-2 text-base font-extrabold text-[#111827]">
                                            <span className="material-symbols-outlined text-[20px] text-[#286c00]">storefront</span>
                                            More from {product.farmer_name || 'this Farmer'}
                                        </h2>
                                    </div>
                                    <Link
                                        href={`/buyer/farmer/${product.farmer_id}`}
                                        className="inline-flex items-center gap-1 border border-[#D1D5DB] bg-white px-3 py-2 text-[11px] font-bold text-[#286c00] transition-colors hover:border-[#286c00]"
                                    >
                                        View All
                                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                    </Link>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                                    {relatedProducts.map((rp: RelatedProduct) => {
                                        const rpHasDiscount = Boolean(rp.discount_price && Number(rp.discount_price) > 0 && Number(rp.discount_price) < Number(rp.price));
                                        const rpDiscountPercent = rpHasDiscount ? Math.round((1 - Number(rp.discount_price) / Number(rp.price)) * 100) : 0;
                                        const rpDisplayPrice = rpHasDiscount ? Number(rp.discount_price) : Number(rp.price);
                                        return (
                                            <Link
                                                key={rp.id}
                                                href={`/buyer/product/${rp.id}`}
                                                className="group flex flex-col border border-[#D1D5DB] bg-white transition-colors hover:border-[#286c00]"
                                            >
                                                <div className="relative aspect-square overflow-hidden border-b border-[#E5E7EB] bg-white">
                                                    {rp.image_url ? (
                                                        <img
                                                            src={rp.image_url}
                                                            alt={rp.name}
                                                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center bg-white">
                                                            <span className="material-symbols-outlined text-4xl text-[#D1D5DB]">image</span>
                                                        </div>
                                                    )}
                                                    {rpHasDiscount && (
                                                        <span className="absolute left-2 top-2 bg-[#286c00] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white tabular-nums">
                                                            -{rpDiscountPercent}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-1 flex-col p-3">
                                                    <p className="line-clamp-1 text-xs font-bold text-[#111827] transition-colors group-hover:text-[#286c00]">{rp.name}</p>
                                                    <p className="mt-1 line-clamp-1 text-[10px] text-[#6B7280]">{rp.category_name || 'Farm fresh'}</p>
                                                    <div className="mt-auto flex flex-wrap items-baseline gap-1.5 pt-2">
                                                        <span className="text-sm font-black text-[#286c00] tabular-nums">ETB {formatMoney(rpDisplayPrice)}</span>
                                                        {rpHasDiscount && (
                                                            <span className="text-[10px] text-[#9CA3AF] line-through tabular-nums">ETB {formatMoney(rp.price)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import Link from 'next/link';

export function CartDrawer() {
  const { cart, isCartOpen, closeCart, updateQuantity, cartSubtotal, deliveryFee, cartTotal } = useCart();
  const router = useRouter();

  if (!isCartOpen) return null;

  return (
    <>
      {/* Slide-out Cart Drawer Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300" 
        onClick={closeCart}
      ></div>

      {/* Cart Drawer */}
      <aside className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white border-l border-[#D1D5DB] z-[101] flex flex-col animate-in slide-in-from-right duration-300 ease-out">
        <div className="p-6 border-b border-[#E5E7EB] flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-[#111827] flex items-center gap-2 font-headline-md tracking-tight">
            <span className="material-symbols-outlined text-[#286c00]">shopping_bag</span>
            Your Cart
          </h2>
          <button
            type="button"
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center border border-[#D1D5DB] bg-white text-[#6B7280] transition-colors hover:border-[#286c00] hover:text-[#286c00]"
            onClick={closeCart}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white custom-scrollbar">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 py-24 flex flex-col items-center">
               <div className="w-20 h-20 bg-white flex items-center justify-center mb-4 border border-[#D1D5DB]">
                 <span className="material-symbols-outlined text-4xl text-[#286c00]">shopping_basket</span>
               </div>
               <p className="text-gray-900 font-bold mb-1">Your cart is empty.</p>
               <p className="text-xs">Time to add some fresh produce!</p>
               <button
                 type="button"
                 onClick={closeCart}
                 className="mt-6 px-6 py-2 bg-white border border-[#286c00] text-[#286c00] font-bold text-sm hover:bg-[#F0FDF4] transition-colors"
               >
                 Continue Shopping
               </button>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-4 items-center bg-white p-3 border border-[#D1D5DB] hover:border-[#286c00] transition-colors">
                <Link href={`/buyer/product/${item.product_id || item.product?.id}`} onClick={closeCart} className="w-20 h-24 bg-white overflow-hidden shrink-0 border border-[#E5E7EB] block">
                  {item.image_url || item.product?.image_url ? (
                    <img alt={item.product_name || item.product?.name || item.name} className="w-full h-full object-cover hover:scale-105 transition-transform" src={item.image_url || item.product?.image_url} />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-3xl">🥦</div>
                  )}
                </Link>
                <div className="flex-1 min-w-0 flex flex-col justify-between h-24 py-1">
                  <div>
                    <h4 className="text-sm font-bold text-[#111827] leading-snug mb-1 line-clamp-2 truncate">{item.product_name || item.product?.name || item.name}</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.farmer_name || item.product?.farmer?.name || 'Local Farm'}</p>
                  </div>
                  <div className="flex justify-between items-end mt-auto">
                    <span className="text-[15px] font-black text-[#286c00] tabular-nums">ETB {Number(item.product_price || item.product?.price || 0).toFixed(2)}</span>
                    <div className="flex items-center gap-2 bg-white border border-[#D1D5DB] p-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="text-gray-500 hover:text-[#286c00] hover:bg-[#F9FAFB] transition-colors w-6 h-6 flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[14px]">remove</span>
                      </button>
                      <span className="text-xs font-bold w-6 text-center tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="text-gray-500 hover:text-[#286c00] hover:bg-[#F9FAFB] transition-colors w-6 h-6 flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 bg-white border-t border-[#D1D5DB] z-10">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm text-gray-500 font-medium">
                <span>Subtotal</span>
                <span className="font-bold text-[#111827] tabular-nums">ETB {cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 font-medium">
                <span>Shipping</span>
                <span className="font-bold text-[#111827] tabular-nums">ETB {deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-end pt-4 border-t border-[#E5E7EB]">
                <span className="text-lg font-bold text-[#111827]">Total</span>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 mr-1">ETB</span>
                  <span className="text-2xl font-black text-[#286c00] tabular-nums">{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                closeCart();
                router.push('/buyer/checkout');
              }}
              className="w-full py-4 bg-[#286c00] text-white text-base font-bold flex items-center justify-center gap-2 hover:bg-[#1f5400] transition-colors"
            >
              Checkout Now <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

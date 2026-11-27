/**
 * Login Page
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import AuthAnimatedInput from '@/components/auth/AuthAnimatedInput';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [socialNotice, setSocialNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Recover leaked query params securely AND restore remembered email preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedEmail = localStorage.getItem('gh_remember_email');
    const savedKeepPref = localStorage.getItem('gh_keep_logged_in');
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: prev.email || savedEmail }));
      setRememberMe(true);
    } else if (savedKeepPref === 'false') {
      setRememberMe(false);
    }

    if (window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      const passParam = params.get('password');
      if (emailParam) {
        setFormData((prev) => ({
          ...prev,
          email: emailParam,
          password: passParam || prev.password,
        }));
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email.trim())) newErrors.email = 'Enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'At least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!validateForm()) return;
    setLoading(true);
    setErrors({});
    setSocialNotice('');
    try {
      const response = await api.login(formData.email.trim(), formData.password, rememberMe);
      const role = response.user?.role;
      const redirectMap: Record<string, string> = {
        admin: '/admin/dashboard',
        farmer: '/farmer/dashboard',
        delivery_partner: '/delivery/dashboard',
        buyer: '/buyer/dashboard',
      };
      const destination = redirectMap[role] ?? '/farmer/dashboard';
      window.location.href = destination;
    } catch (error: any) {
      console.error('Login failed:', error);
      const serverMsg = error.response?.data?.message;
      const networkMsg =
        error.message === 'Network Error'
          ? 'Cannot reach backend server. Please verify backend service is running on port 5000.'
          : 'Invalid email or password.';
      setErrors({ general: serverMsg || networkMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialClick = (provider: string) => {
    setSocialNotice(
      `${provider} sign-in will be available soon. Please sign in with email and password.`
    );
  };

  return (
    <div className="min-h-screen flex bg-surface-container-lowest font-body-md text-on-surface">
      {/* Left panel — matching typography & smooth animations */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden bg-primary text-on-primary">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 right-0 w-80 h-80 bg-primary-fixed/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0.32, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-container/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-10 left-10 text-secondary-container opacity-45"
        >
          <span className="material-symbols-outlined text-8xl">spark</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative text-center max-w-sm z-10"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 bg-surface-container-lowest rounded-[24px] flex items-center justify-center mx-auto mb-8 shadow-xl"
          >
            <span
              className="material-symbols-outlined text-5xl text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              eco
            </span>
          </motion.div>

          <h2 className="font-body-lg text-[40px] md:text-[46px] font-extrabold tracking-tight mb-4 leading-[1.12]">
            Welcome Back To <span className="text-secondary-container">GreenHarvest</span>
          </h2>
          <p className="font-body-md text-[17px] text-on-primary/80 leading-relaxed">
            Your trusted marketplace for fresh, sustainable produce straight from local farms.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            {[
              { emoji: '🌾', label: '500+ Farmers' },
              { emoji: '🥦', label: '2,000+ Products' },
              { emoji: '🚚', label: 'Fast Delivery' },
              { emoji: '💯', label: 'Verified Quality' },
            ].map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + idx * 0.08, duration: 0.4 }}
                whileHover={{ y: -3, scale: 1.02 }}
                className="flex items-center gap-3 bg-on-primary/10 backdrop-blur-sm border border-on-primary/20 rounded-[24px] px-5 py-4 transition-colors hover:bg-on-primary/15"
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="font-label-md text-label-md">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel — borderless UX form with bottom-curved underline inputs */}
      <div className="flex-1 flex items-center justify-center py-12 px-6 sm:px-10 bg-surface-container-lowest">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <span
              className="material-symbols-outlined text-primary text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              eco
            </span>
            <span className="font-body-lg text-2xl font-extrabold tracking-tight text-on-background">
              Green<span className="text-primary">Harvest</span>
            </span>
          </div>

          {/* Centered Header */}
          <div className="text-center mb-7">
            <h1 className="font-body-lg text-[30px] font-extrabold tracking-tight text-on-background">
              Welcome Back!
            </h1>
            <p className="text-sm text-on-surface-variant mt-1.5">
              Sign in to your GreenHarvest Marketplace
            </p>
          </div>

          {/* 3-Column Social Provider Row */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleSocialClick('Apple')}
              aria-label="Continue with Apple"
              className="h-12 bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/40 hover:bg-surface-container-low rounded-xl flex items-center justify-center transition-all cursor-pointer"
            >
              <svg className="w-5 h-5 text-on-background" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => handleSocialClick('Google')}
              aria-label="Continue with Google"
              className="h-12 bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/40 hover:bg-surface-container-low rounded-xl flex items-center justify-center transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => handleSocialClick('X')}
              aria-label="Continue with X"
              className="h-12 bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/40 hover:bg-surface-container-low rounded-xl flex items-center justify-center transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 text-on-background" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </button>
          </div>

          {socialNotice && (
            <div className="mt-4 px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/50 rounded-xl text-xs text-on-surface-variant text-center">
              {socialNotice}
            </div>
          )}

          {/* OR Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-outline-variant/50" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
              OR
            </span>
            <div className="flex-1 h-px bg-outline-variant/50" />
          </div>

          {errors.general && (
            <div className="flex items-start gap-2.5 bg-error-container border border-error/20 text-on-error-container rounded-xl px-4 py-3 mb-5">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <p className="text-xs font-medium leading-relaxed">{errors.general}</p>
            </div>
          )}

          {/* Login Form with Bottom-Border Curved Inputs */}
          <form onSubmit={handleSubmit} method="POST" action="#" className="space-y-5">
            <AuthAnimatedInput
              id="email"
              label="Email Address"
              icon="mail"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@greenharvest.com"
              autoComplete="email"
              error={errors.email}
              required
            />

            <AuthAnimatedInput
              id="password"
              label="Password"
              icon="lock"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              error={errors.password}
              isPasswordToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
              required
            />

            {/* Keep me logged in + Forgot password row */}
            <div className="flex items-center justify-between pt-1 pb-2">
              <label
                htmlFor="remember"
                className="inline-flex items-center gap-2 text-[13px] text-on-surface-variant cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant text-primary accent-primary focus:ring-primary/30 cursor-pointer"
                />
                <span>Keep me logged in</span>
              </label>

              <Link
                href="/forgot-password"
                className="text-[13px] font-medium text-on-background underline underline-offset-4 hover:text-primary transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-primary hover:bg-surface-tint text-on-primary font-semibold text-sm py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </motion.button>
          </form>

          {/* Footer Sign Up Link */}
          <p className="text-center text-[13px] text-on-surface-variant mt-6">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-bold text-primary hover:text-on-primary-container transition-colors"
            >
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

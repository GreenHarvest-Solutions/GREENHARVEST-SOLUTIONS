/**
 * Login Page
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import AuthAnimatedInput from '@/components/auth/AuthAnimatedInput';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

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
      const oauthErrorParam = params.get('oauth_error');
      if (oauthErrorParam) {
        setSocialNotice(oauthErrorParam);
      }
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

          {/* 3-Column Social Provider Row (Google, Facebook, GitHub) */}
          <SocialAuthButtons
            mode="login"
            rememberMe={rememberMe}
            initialNotice={socialNotice}
          />

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

/**
 * Registration Page
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import type { UserRole } from '@/types';
import AuthAnimatedInput from '@/components/auth/AuthAnimatedInput';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

const roles = [
  {
    value: 'buyer' as UserRole,
    title: 'Buyer',
    description: 'Shop for fresh farm produce',
    icon: 'shopping_basket',
  },
  {
    value: 'farmer' as UserRole,
    title: 'Farmer',
    description: 'Sell your agricultural harvest',
    icon: 'agriculture',
  },
  {
    value: 'delivery_partner' as UserRole,
    title: 'Delivery Partner',
    description: 'Deliver produce to buyers',
    icon: 'local_shipping',
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'role' | 'details'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [socialNotice, setSocialNotice] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Full name is required';
    if (!formData.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Enter a valid email';
    if (!formData.password) e.password = 'Password is required';
    else if (formData.password.length < 8) e.password = 'At least 8 characters';
    if (formData.password !== formData.confirmPassword)
      e.confirmPassword = 'Passwords do not match';
    if (!formData.phone) e.phone = 'Phone number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setErrors({});
    setSocialNotice('');
    try {
      await api.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: selectedRole,
        phone: formData.phone,
        address: formData.address || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setErrors({
        general: err.response?.data?.message || 'Registration failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest px-6 font-body-md text-on-surface">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-primary text-5xl">check_circle</span>
          </div>
          <h2 className="font-body-lg text-3xl font-extrabold tracking-tight text-on-background mb-2">
            Account Created!
          </h2>
          <p className="text-sm text-on-surface-variant">Redirecting you to sign in...</p>
          <div className="mt-8 w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.3, ease: 'linear' }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-surface-container-lowest font-body-md text-on-surface">
      {/* Left panel — matching typography & smooth animations */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 items-center justify-center p-12 relative overflow-hidden bg-primary text-on-primary">
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
            Join <span className="text-secondary-container">GreenHarvest</span> Today
          </h2>
          <p className="font-body-md text-[17px] text-on-primary/80 leading-relaxed">
            Connect directly with verified Ethiopian growers, buyers, and regional logistics partners.
          </p>

          {/* Compact Step Summary */}
          <div className="mt-10 space-y-3 text-left">
            {[
              { num: 1, title: 'Choose your role', done: step === 'details', active: step === 'role' },
              { num: 2, title: 'Complete your details', done: false, active: step === 'details' },
            ].map((item) => (
              <motion.div
                key={item.num}
                whileHover={{ x: 3 }}
                className={`flex items-center gap-3.5 rounded-2xl px-5 py-3.5 border backdrop-blur-sm transition-all ${
                  item.active
                    ? 'bg-on-primary/15 border-on-primary/35'
                    : item.done
                    ? 'bg-on-primary/10 border-on-primary/20'
                    : 'bg-on-primary/5 border-on-primary/10 opacity-75'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    item.done
                      ? 'bg-secondary-container text-on-secondary-fixed'
                      : item.active
                      ? 'bg-surface-container-lowest text-primary'
                      : 'bg-on-primary/20 text-on-primary'
                  }`}
                >
                  {item.done ? (
                    <span className="material-symbols-outlined text-[15px] font-bold">check</span>
                  ) : (
                    item.num
                  )}
                </div>
                <span className="text-sm font-semibold">{item.title}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel — borderless UX form with bottom-curved underline inputs */}
      <div className="flex-1 flex items-center justify-center py-10 px-6 sm:px-10 bg-surface-container-lowest overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[460px]"
        >
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-2 mb-7 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2">
              <span
                className="material-symbols-outlined text-primary text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                eco
              </span>
              <span className="font-body-lg text-2xl font-extrabold tracking-tight text-on-background">
                Green<span className="text-primary">Harvest</span>
              </span>
            </Link>
          </div>

          {/* Centered Heading */}
          <div className="text-center mb-7">
            <h1 className="font-body-lg text-[30px] font-extrabold tracking-tight text-on-background">
              Create Account
            </h1>
            <p className="text-sm text-on-surface-variant mt-1.5">
              {step === 'role'
                ? 'Choose how you want to use GreenHarvest'
                : 'Fill in your profile credentials to get started'}
            </p>
          </div>

          {/* Step 1 — Role Selection */}
          {step === 'role' && (
            <div className="space-y-5">
              {/* 3-Column Social Quick Row (Google, Facebook, GitHub) */}
              <SocialAuthButtons
                mode="register"
                role={selectedRole || 'buyer'}
                rememberMe
                initialNotice={socialNotice}
              />

              {/* SELECT ROLE Divider */}
              <div className="flex items-center gap-4 my-2">
                <div className="flex-1 h-px bg-outline-variant/50" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
                  SELECT ROLE
                </span>
                <div className="flex-1 h-px bg-outline-variant/50" />
              </div>

              <div className="space-y-3">
                {roles.map((role) => (
                  <motion.button
                    key={role.value}
                    type="button"
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setSelectedRole(role.value);
                      setStep('details');
                    }}
                    className={`w-full group flex items-center justify-between gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedRole === role.value
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                        : 'border-outline-variant/70 bg-surface-container-lowest hover:border-primary/50 hover:bg-surface-container-low/60'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined text-[22px]">{role.icon}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-on-background">{role.title}</h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">{role.description}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                      arrow_forward
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Account Details with Curved Bottom-Border Inputs */}
          {step === 'details' && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Role Pill Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 mb-5 bg-surface-container-low rounded-xl border border-outline-variant/50">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[19px]">
                    {roles.find((r) => r.value === selectedRole)?.icon}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Role:{' '}
                    <strong className="text-on-background capitalize font-bold">
                      {roles.find((r) => r.value === selectedRole)?.title || selectedRole}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('role')}
                  className="text-xs font-semibold text-primary hover:text-on-primary-container underline underline-offset-2 cursor-pointer"
                >
                  Change
                </button>
              </div>

              {errors.general && (
                <div className="flex items-start gap-2.5 bg-error-container border border-error/20 text-on-error-container rounded-xl px-4 py-3 mb-5">
                  <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                  <p className="text-xs font-medium leading-relaxed">{errors.general}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} method="POST" action="#" className="space-y-4">
                <AuthAnimatedInput
                  id="name"
                  label="Full Name"
                  icon="user"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Abebe Bikila"
                  error={errors.name}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AuthAnimatedInput
                    id="reg-email"
                    label="Email Address"
                    icon="mail"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    error={errors.email}
                    required
                  />

                  <AuthAnimatedInput
                    id="reg-phone"
                    label="Phone Number"
                    icon="phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+251 911 000 000"
                    error={errors.phone}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AuthAnimatedInput
                    id="reg-password"
                    label="Password"
                    icon="lock"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min. 8 chars"
                    error={errors.password}
                    isPasswordToggle
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    required
                  />

                  <AuthAnimatedInput
                    id="reg-confirm-password"
                    label="Confirm Password"
                    icon="lock_confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat password"
                    error={errors.confirmPassword}
                    isPasswordToggle
                    showPassword={showConfirmPassword}
                    onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                    required
                  />
                </div>

                <AuthAnimatedInput
                  id="reg-address"
                  label={
                    <>
                      Address{' '}
                      <span className="text-on-surface-variant/60 font-normal">(optional)</span>
                    </>
                  }
                  icon="location"
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="City, region or farm address"
                />

                <label
                  htmlFor="terms"
                  className="flex items-start gap-2.5 pt-1 text-xs text-on-surface-variant cursor-pointer leading-relaxed"
                >
                  <input
                    type="checkbox"
                    id="terms"
                    required
                    className="mt-0.5 w-4 h-4 rounded border-outline-variant text-primary accent-primary focus:ring-primary/30 cursor-pointer shrink-0"
                  />
                  <span>
                    I agree to the{' '}
                    <Link
                      href="/terms"
                      className="text-on-background underline underline-offset-2 font-semibold hover:text-primary"
                    >
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      className="text-on-background underline underline-offset-2 font-semibold hover:text-primary"
                    >
                      Privacy Policy
                    </Link>
                  </span>
                </label>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.99 }}
                  className="w-full bg-primary hover:bg-surface-tint text-on-primary font-semibold text-sm py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* Footer Sign In Link */}
          <p className="text-center text-[13px] text-on-surface-variant mt-6">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-bold text-primary hover:text-on-primary-container transition-colors"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type AuthIconName =
  | 'mail'
  | 'lock'
  | 'lock_confirm'
  | 'user'
  | 'phone'
  | 'location';

interface AuthAnimatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  icon: AuthIconName;
  error?: string;
  isPasswordToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}

function CrispAuthIcon({ name, focused }: { name: AuthIconName; focused: boolean }) {
  const strokeWidth = focused ? 2.1 : 1.75;

  switch (name) {
    case 'mail':
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="3" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'lock':
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2.5" ry="2.5" />
          <path d={focused ? 'M7 11V7a5 5 0 0 1 9.5-2' : 'M7 11V7a5 5 0 0 1 10 0v4'} />
        </svg>
      );
    case 'lock_confirm':
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'user':
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'phone':
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case 'location':
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
  }
}

export default function AuthAnimatedInput({
  label,
  icon,
  error,
  isPasswordToggle = false,
  showPassword = false,
  onTogglePassword,
  id,
  className = '',
  onFocus,
  onBlur,
  ...props
}: AuthAnimatedInputProps) {
  const [focused, setFocused] = useState(false);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={`block text-[13px] font-semibold mb-1.5 transition-colors duration-200 ${
          error
            ? 'text-error'
            : focused
            ? 'text-primary'
            : 'text-on-background'
        }`}
      >
        {label}
      </label>

      <div
        className={`relative flex items-center rounded-b-2xl border-0 border-b-2 transition-all duration-200 ${
          error
            ? 'border-error bg-error-container/15'
            : focused
            ? 'border-primary bg-surface-container-low/55'
            : 'border-outline-variant/80 hover:border-outline bg-transparent hover:bg-surface-container-low/30'
        }`}
      >
        {/* Left Animated Icon */}
        <motion.span
          animate={{
            scale: focused ? 1.15 : 1,
            y: focused ? -1 : 0,
            rotate: focused && (icon === 'phone' || icon === 'mail') ? -5 : 0,
          }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className={`absolute left-3 pointer-events-none flex items-center justify-center transition-colors duration-200 ${
            error
              ? 'text-error'
              : focused
              ? 'text-primary'
              : 'text-on-surface-variant/65'
          }`}
        >
          <CrispAuthIcon name={icon} focused={focused} />
        </motion.span>

        <input
          id={id}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
          className={`w-full bg-transparent border-0 rounded-b-2xl pl-10 ${
            isPasswordToggle ? 'pr-10' : 'pr-3.5'
          } py-3 text-sm text-on-background placeholder-on-surface-variant/45 focus:outline-none focus:ring-0`}
        />

        {/* Animated Password Visibility Eye */}
        {isPasswordToggle && onTogglePassword && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.08 }}
            onClick={onTogglePassword}
            className="absolute right-2.5 p-1 text-on-surface-variant/70 hover:text-primary transition-colors cursor-pointer"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {showPassword ? (
                <motion.svg
                  key="eye-off"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.14 }}
                  className="w-[18px] h-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" x2="22" y1="2" y2="22" />
                </motion.svg>
              ) : (
                <motion.svg
                  key="eye-on"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.14 }}
                  className="w-[18px] h-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </motion.svg>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-error text-xs mt-1.5"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

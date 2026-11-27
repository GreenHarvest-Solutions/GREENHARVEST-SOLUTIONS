'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

export default function OAuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('oauth_error');

    if (oauthError) {
      setStatus('error');
      setErrorMessage(oauthError);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('Missing authorization handoff code.');
      return;
    }

    // Immediately scrub sensitive handoff code from URL bar
    window.history.replaceState({}, document.title, window.location.pathname);

    (async () => {
      try {
        const res = await api.exchangeOAuthCode(code);
        const role = res.user?.role;
        const redirectMap: Record<string, string> = {
          admin: '/admin/dashboard',
          farmer: '/farmer/dashboard',
          delivery_partner: '/delivery/dashboard',
          buyer: '/buyer/dashboard',
        };
        window.location.href = redirectMap[role] ?? '/buyer/dashboard';
      } catch (err: any) {
        console.error('OAuth exchange failed:', err);
        setStatus('error');
        setErrorMessage(
          err?.response?.data?.message || err?.message || 'Could not complete social sign-in.'
        );
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest px-6 font-body-md text-on-surface">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        {status === 'loading' ? (
          <>
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="w-7 h-7 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
            </div>
            <h1 className="font-body-lg text-2xl font-extrabold tracking-tight text-on-background">
              Completing Sign-In...
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              Securing your GreenHarvest session and redirecting you to your dashboard.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-error-container text-on-error-container rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl">error</span>
            </div>
            <h1 className="font-body-lg text-2xl font-extrabold tracking-tight text-on-background">
              Sign-In Interrupted
            </h1>
            <p className="text-sm text-on-surface-variant mt-2 mb-6 leading-relaxed">
              {errorMessage}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary hover:bg-surface-tint text-on-primary text-sm font-semibold rounded-xl transition-colors"
            >
              Return to Login
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

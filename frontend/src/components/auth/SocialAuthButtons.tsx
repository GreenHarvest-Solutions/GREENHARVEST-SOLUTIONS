'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface OAuthProviderStatus {
  id: 'google' | 'facebook' | 'github';
  name: string;
  configured: boolean;
  env_keys?: string[];
}

interface SocialAuthButtonsProps {
  mode: 'login' | 'register';
  role?: string;
  rememberMe?: boolean;
  initialNotice?: string;
}

const DEFAULT_PROVIDERS: OAuthProviderStatus[] = [
  { id: 'google', name: 'Google', configured: true },
  { id: 'facebook', name: 'Facebook', configured: true },
  { id: 'github', name: 'GitHub', configured: true },
];

export default function SocialAuthButtons({
  mode,
  role = 'buyer',
  rememberMe = true,
  initialNotice = '',
}: SocialAuthButtonsProps) {
  const [providers, setProviders] = useState<OAuthProviderStatus[]>(DEFAULT_PROVIDERS);
  const [notice, setNotice] = useState(initialNotice);
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    if (initialNotice) setNotice(initialNotice);
  }, [initialNotice]);

  useEffect(() => {
    let active = true;
    api
      .getOAuthProviders()
      .then((res) => {
        if (active && Array.isArray(res?.providers) && res.providers.length > 0) {
          setProviders(res.providers as OAuthProviderStatus[]);
        }
      })
      .catch(() => {
        // Keep default clickable buttons if status probe fails transiently
      });
    return () => {
      active = false;
    };
  }, []);

  const handleProviderClick = (provider: OAuthProviderStatus) => {
    setNotice('');
    if (!provider.configured) {
      const keys = provider.env_keys?.join(' & ') || `${provider.id.toUpperCase()}_CLIENT_ID`;
      setNotice(
        `${provider.name} OAuth isn't configured in backend/.env yet. Add ${keys} (and callback URL /api/auth/oauth/${provider.id}/callback) to enable 1-click ${provider.name} ${mode === 'register' ? 'sign-up' : 'sign-in'}.`
      );
      return;
    }

    setLaunching(provider.id);
    window.location.href = api.getOAuthStartUrl(provider.id, {
      role: mode === 'register' ? role : 'buyer',
      rememberMe,
    });
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {/* Google */}
        <motion.button
          type="button"
          whileHover={{ y: -1.5 }}
          whileTap={{ scale: 0.98 }}
          disabled={launching !== null}
          onClick={() => handleProviderClick(providers.find((p) => p.id === 'google') || DEFAULT_PROVIDERS[0])}
          aria-label={`${mode === 'register' ? 'Sign up' : 'Continue'} with Google`}
          title="Google"
          className="h-12 bg-surface-container-lowest border border-outline-variant/65 hover:border-primary/45 hover:bg-surface-container-low rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
        >
          {launching === 'google' ? (
            <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : (
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
          )}
        </motion.button>

        {/* Facebook */}
        <motion.button
          type="button"
          whileHover={{ y: -1.5 }}
          whileTap={{ scale: 0.98 }}
          disabled={launching !== null}
          onClick={() => handleProviderClick(providers.find((p) => p.id === 'facebook') || DEFAULT_PROVIDERS[1])}
          aria-label={`${mode === 'register' ? 'Sign up' : 'Continue'} with Facebook`}
          title="Facebook"
          className="h-12 bg-surface-container-lowest border border-outline-variant/65 hover:border-primary/45 hover:bg-surface-container-low rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
        >
          {launching === 'facebook' ? (
            <span className="w-4 h-4 border-2 border-[#1877F2]/30 border-t-[#1877F2] rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )}
        </motion.button>

        {/* GitHub */}
        <motion.button
          type="button"
          whileHover={{ y: -1.5 }}
          whileTap={{ scale: 0.98 }}
          disabled={launching !== null}
          onClick={() => handleProviderClick(providers.find((p) => p.id === 'github') || DEFAULT_PROVIDERS[2])}
          aria-label={`${mode === 'register' ? 'Sign up' : 'Continue'} with GitHub`}
          title="GitHub"
          className="h-12 bg-surface-container-lowest border border-outline-variant/65 hover:border-primary/45 hover:bg-surface-container-low rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
        >
          {launching === 'github' ? (
            <span className="w-4 h-4 border-2 border-on-background/30 border-t-on-background rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-on-background" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          )}
        </motion.button>
      </div>

      {notice && (
        <div className="mt-4 px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/55 rounded-xl text-xs text-on-surface-variant text-center leading-relaxed">
          {notice}
        </div>
      )}
    </div>
  );
}

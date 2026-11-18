import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className = '', ...props }: GlassCardProps) {
  return (
    <div
      className={`backdrop-blur-xl bg-white/70 border border-white/60 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

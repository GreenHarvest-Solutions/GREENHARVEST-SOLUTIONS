import React from 'react';
import { FarmerProvider } from '@/contexts/FarmerContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import FarmerSidebar from '@/components/farmer/FarmerSidebar';

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return (
    <FarmerProvider>
      <ToastProvider>
        <div className="flex h-screen bg-[#f1f5f9] font-sans overflow-hidden text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
          <FarmerSidebar />
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8fafc]">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </div>
      </ToastProvider>
    </FarmerProvider>
  );
}

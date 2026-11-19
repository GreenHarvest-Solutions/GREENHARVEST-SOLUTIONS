import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const metadata = {
  title: 'Admin Dashboard | GreenHarvest',
  description: 'GreenHarvest Solutions Admin Dashboard',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div
        className="flex h-screen w-screen overflow-hidden text-gray-800 bg-[#FDFCFE]"
        style={{
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* Full-height Admin Sidebar */}
        <AdminSidebar />

        {/* Full-height Main View Container */}
        <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[#FDFCFE]">
          {children}
        </main>
      </div>
    </>
  );
}

import React from 'react';
import Script from 'next/script';

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
        className="h-screen overflow-hidden text-gray-800 p-4"
        style={{
          fontFamily: "'Poppins', sans-serif",
          background: 'linear-gradient(135deg, #F8F4FF 0%, #EFE7FF 100%)',
          zoom: '0.85',
        }}
      >
        {children}
      </div>
    </>
  );
}

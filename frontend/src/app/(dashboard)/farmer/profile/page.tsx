'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

type FarmerUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  is_verified: boolean;
  mfa_enabled: boolean;
  role: string;
  bio?: string | null;
  farm_name?: string | null;
  farm_type?: string | null;
  farm_location?: string | null;
  farm_size?: string | null;
  experience_years?: number | null;
};

const ETHIOPIAN_REGIONS = [
  'Oromia',
  'Amhara',
  'Sidama',
  'Central Ethiopia (SNNPR)',
  'South Ethiopia',
  'South West Ethiopia',
  'Tigray',
  'Somali',
  'Afar',
  'Benishangul-Gumuz',
  'Gambella',
  'Harari',
  'Addis Ababa',
  'Dire Dawa',
];

const FARM_TYPES = [
  'Cereal & Grain Farming (Teff, Wheat, Maize)',
  'Coffee & Tea Plantation',
  'Fresh Vegetables & Greens',
  'Fruit Orchard',
  'Pulses & Legumes',
  'Oilseeds & Spices',
  'Mixed Agro-Ecological Farming',
];

export default function FarmerProfilePage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [user, setUser] = useState<FarmerUser | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    bio: '',
    farm_name: '',
    farm_type: '',
    farm_location: '',
    farm_size: '',
    experience_years: '',
  });

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [userRes, dashRes] = await Promise.all([
        api.getUserProfile().catch(() => ({ user: null })),
        api.getFarmerDashboard().catch(() => ({})),
      ]);

      const currentUser = userRes.user;
      setUser(currentUser);
      setDashboardData(dashRes || null);

      if (currentUser) {
        setFormData({
          name: currentUser.name || '',
          phone: currentUser.phone || '',
          address: currentUser.address || '',
          bio: currentUser.bio || '',
          farm_name: currentUser.farm_name || '',
          farm_type: currentUser.farm_type || FARM_TYPES[0],
          farm_location: currentUser.farm_location || ETHIOPIAN_REGIONS[0],
          farm_size: currentUser.farm_size || '',
          experience_years: currentUser.experience_years ? String(currentUser.experience_years) : '',
        });
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateUserProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        bio: formData.bio.trim(),
        farm_name: formData.farm_name.trim(),
        farm_type: formData.farm_type,
        farm_location: formData.farm_location,
        farm_size: formData.farm_size.trim(),
        experience_years: formData.experience_years ? Number(formData.experience_years) : null,
      });

      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: formData.name,
              phone: formData.phone,
              address: formData.address,
              bio: formData.bio,
              farm_name: formData.farm_name,
              farm_type: formData.farm_type,
              farm_location: formData.farm_location,
              farm_size: formData.farm_size,
              experience_years: formData.experience_years ? Number(formData.experience_years) : null,
            }
          : null
      );
      setIsEditing(false);
      showSuccess('Farm and personal profile updated successfully!');
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      showError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    router.push('/login');
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'GH';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-gray-800">
      {/* Top Header */}
      <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/farmer/dashboard"
            className="flex items-center gap-2 text-[#16a34a] font-bold text-xl tracking-tight hover:opacity-85 transition-opacity"
          >
            <span className="material-symbols-outlined text-2xl">agriculture</span>
            GreenHarvest Producer Hub
          </Link>
          <span className="text-gray-300 hidden md:inline">|</span>
          <span className="text-gray-500 font-medium text-sm hidden md:inline">Farmer & Farm Profile</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/farmer/dashboard"
            className="text-xs md:text-sm font-semibold text-gray-700 hover:text-[#16a34a] bg-gray-100 hover:bg-gray-200/70 transition-colors px-4 py-2 rounded-xl flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            Dashboard
          </Link>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#16a34a] to-[#4ade80] p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-[#16a34a] text-sm">
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        {/* Left Column / Summary Card */}
        <aside className="w-full lg:w-[320px] shrink-0 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-[#16a34a] to-[#22c55e] opacity-10" />

            <div className="w-24 h-24 rounded-full bg-white shadow-md border-4 border-emerald-500/20 flex items-center justify-center text-[#16a34a] font-black text-3xl mb-3 relative z-10 mt-2">
              {initials}
            </div>

            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              {user?.farm_name || user?.name || 'Verified Farm'}
            </h2>
            <p className="text-xs text-gray-500 mt-1 mb-3">{user?.email}</p>

            {/* KYC Verification Badge */}
            <div className="mb-4">
              {user?.is_verified ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Verified Producer
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="material-symbols-outlined text-sm">pending</span>
                  KYC Verification Pending
                </span>
              )}
            </div>

            <div className="w-full border-t border-gray-100 my-2"></div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-4 w-full py-2">
              <div className="text-left bg-gray-50/80 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Revenue</span>
                <span className="font-bold text-gray-900 text-sm">
                  ETB {Number(dashboardData?.summary?.total_revenue || 0).toLocaleString()}
                </span>
              </div>
              <div className="text-left bg-gray-50/80 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Orders</span>
                <span className="font-bold text-gray-900 text-sm">
                  {dashboardData?.summary?.total_orders_received || 0}
                </span>
              </div>
            </div>

            <div className="w-full mt-4 flex flex-col gap-2">
              <Link
                href="/farmer/store"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">store</span>
                Customize Storefront
              </Link>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Right Column / Details Form */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Farm & Personal Information</h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Manage your farm's public identity, crop specialties, and official producer profile.
                </p>
              </div>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  Edit Details
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    if (user) {
                      setFormData({
                        name: user.name || '',
                        phone: user.phone || '',
                        address: user.address || '',
                        bio: user.bio || '',
                        farm_name: user.farm_name || '',
                        farm_type: user.farm_type || FARM_TYPES[0],
                        farm_location: user.farm_location || ETHIOPIAN_REGIONS[0],
                        farm_size: user.farm_size || '',
                        experience_years: user.experience_years ? String(user.experience_years) : '',
                      });
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="mt-8 space-y-8">
              {/* Section 1: Farm Information */}
              <div>
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-base">psychiatry</span>
                  Farm Profile & Agricultural Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Official Farm Name</label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={formData.farm_name}
                      onChange={(e) => setFormData({ ...formData, farm_name: e.target.value })}
                      placeholder="e.g. Oromia Highland Organic Teff Farm"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Primary Farm Type</label>
                    <select
                      disabled={!isEditing}
                      value={formData.farm_type}
                      onChange={(e) => setFormData({ ...formData, farm_type: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all bg-white"
                    >
                      {FARM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Region / Location in Ethiopia</label>
                    <select
                      disabled={!isEditing}
                      value={formData.farm_location}
                      onChange={(e) => setFormData({ ...formData, farm_location: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all bg-white"
                    >
                      {ETHIOPIAN_REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Farm Size (e.g. Hectares / Timad)</label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={formData.farm_size}
                      onChange={(e) => setFormData({ ...formData, farm_size: e.target.value })}
                      placeholder="e.g. 8 Hectares"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Years of Farming Experience</label>
                    <input
                      type="number"
                      min="0"
                      disabled={!isEditing}
                      value={formData.experience_years}
                      onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                      placeholder="e.g. 12"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Specific Woreda / Kebele Address</label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. Bishoftu Woreda, Kebele 04"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Farm Story & Agricultural Bio</label>
                    <textarea
                      rows={4}
                      disabled={!isEditing}
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Describe your soil, organic cultivation practices, harvest traditions, and what makes your farm produce unique for Ethiopian buyers."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Personal Contact Information */}
              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-base">person</span>
                  Primary Contact & Account Owner
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Farmer Full Name</label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Abebe Bekele"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Phone Number (SMS & Pickup Alerts)</label>
                    <input
                      type="tel"
                      disabled={!isEditing}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+251 91 234 5678"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 focus:border-[#16a34a] disabled:bg-gray-50 disabled:text-gray-700 font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Account Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Account Role</label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-600 font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-600 text-base">eco</span>
                      Certified Farmer / Producer
                    </div>
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving Profile...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">save</span>
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

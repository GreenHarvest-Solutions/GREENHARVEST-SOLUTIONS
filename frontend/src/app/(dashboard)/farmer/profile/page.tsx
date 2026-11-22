'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

type TabKey = 'personal' | 'location' | 'production' | 'payout';

export default function FarmerProfilePage() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [profileProgress, setProfileProgress] = useState<{
    score: number;
    sections: {
      personal: boolean;
      farm_info: boolean;
      location: boolean;
      crops: boolean;
      payout: boolean;
    };
    profile: any;
  } | null>(null);

  const [formData, setFormData] = useState({
    // Personal
    name: '',
    phone: '',
    address: '',
    // Location
    region: '',
    woreda: '',
    kebele: '',
    gps_coordinates: '',
    pickup_address: '',
    pickup_instructions: '',
    // Production
    farm_name: '',
    farm_size_hectares: '',
    farming_type: 'smallholder',
    primary_crops: [] as string[],
    crops_input: '',
    bio: '',
    // Payout
    bank_name: '',
    bank_account_number: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getFarmerProfileProgress();
      setProfileProgress(res);

      const p = res.profile || {};
      setFormData({
        name: p.name || '',
        phone: p.phone || '',
        address: p.address || '',
        region: p.region || '',
        woreda: p.woreda || '',
        kebele: p.kebele || '',
        gps_coordinates: p.gps_coordinates || '',
        pickup_address: p.pickup_address || '',
        pickup_instructions: p.pickup_instructions || '',
        farm_name: p.farm_name || '',
        farm_size_hectares: p.farm_size_hectares !== null && p.farm_size_hectares !== undefined ? String(p.farm_size_hectares) : '',
        farming_type: p.farming_type || 'smallholder',
        primary_crops: Array.isArray(p.primary_crops) ? p.primary_crops : [],
        crops_input: Array.isArray(p.primary_crops) ? p.primary_crops.join(', ') : '',
        bio: p.bio || '',
        bank_name: p.bank_name || '',
        bank_account_number: p.bank_account_number || '',
      });
    } catch (err: any) {
      console.error('Failed to load profile progress', err);
      showError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedCrops = formData.crops_input
        ? formData.crops_input.split(',').map((c) => c.trim()).filter(Boolean)
        : formData.primary_crops;

      const payload = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        region: formData.region,
        woreda: formData.woreda,
        kebele: formData.kebele,
        gps_coordinates: formData.gps_coordinates,
        pickup_address: formData.pickup_address,
        pickup_instructions: formData.pickup_instructions,
        farm_name: formData.farm_name,
        farm_size_hectares: formData.farm_size_hectares ? parseFloat(formData.farm_size_hectares) : null,
        farming_type: formData.farming_type,
        primary_crops: parsedCrops,
        bio: formData.bio,
        bank_name: formData.bank_name,
        bank_account_number: formData.bank_account_number,
      };

      const res = await api.updateFarmerProfileExtended(payload);
      showSuccess(res.message || 'Profile updated successfully.');
      setIsEditing(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save profile', err);
      showError(err.message || 'Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  const user = profileProgress?.profile;
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'GH';

  const score = profileProgress?.score || 0;
  const sections = profileProgress?.sections || {
    personal: false,
    farm_info: false,
    location: false,
    crops: false,
    payout: false,
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-800">
      {/* Header */}
      <header className="h-18 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/farmer/dashboard"
            className="flex items-center gap-2 text-[#2d9a33] font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined">agriculture</span>
            GreenHarvest Seller
          </Link>
          <span className="text-gray-300 hidden md:inline">|</span>
          <span className="text-gray-600 font-medium text-sm hidden md:inline">
            Farmer Profile & Onboarding
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/farmer/verification"
            className="text-xs font-semibold px-4 py-2 rounded-full bg-emerald-50 text-[#2d9a33] border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            Verification Center
          </Link>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2d9a33] to-[#74df41] p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-xs text-[#2d9a33]">
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full lg:w-72 shrink-0 space-y-6">
          {/* Avatar card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-[#2d9a33] flex items-center justify-center text-[#2d9a33] font-bold text-2xl mb-3">
              {initials}
            </div>
            <h2 className="text-base font-bold text-gray-900">{user?.name || 'Farmer'}</h2>
            <p className="text-xs text-gray-500 mb-2">{user?.email}</p>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                user?.is_verified
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {user?.is_verified ? 'Verified Producer' : 'Provisional Seller'}
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="bg-white rounded-2xl p-2 border border-gray-200 shadow-sm flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('personal')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-xs transition-colors text-left w-full border-l-4 ${
                activeTab === 'personal'
                  ? 'bg-emerald-50 text-[#2d9a33] border-[#2d9a33]'
                  : 'text-gray-600 border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">person</span>
                Personal Details
              </div>
              {sections.personal && (
                <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('location')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-xs transition-colors text-left w-full border-l-4 ${
                activeTab === 'location'
                  ? 'bg-emerald-50 text-[#2d9a33] border-[#2d9a33]'
                  : 'text-gray-600 border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                Farm Location
              </div>
              {sections.location && (
                <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('production')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-xs transition-colors text-left w-full border-l-4 ${
                activeTab === 'production'
                  ? 'bg-emerald-50 text-[#2d9a33] border-[#2d9a33]'
                  : 'text-gray-600 border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">agriculture</span>
                Production & Crops
              </div>
              {sections.farm_info && sections.crops && (
                <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('payout')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-xs transition-colors text-left w-full border-l-4 ${
                activeTab === 'payout'
                  ? 'bg-emerald-50 text-[#2d9a33] border-[#2d9a33]'
                  : 'text-gray-600 border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">account_balance</span>
                Banking & Payout
              </div>
              {sections.payout && (
                <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
              )}
            </button>

            <hr className="border-gray-100 my-1 mx-2" />

            <Link
              href="/farmer/verification"
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-[#2d9a33]">verified_user</span>
              KYC Verification Center
            </Link>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Progressive Completeness Progress Bar Card */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#2d9a33]">trending_up</span>
                  Profile Completeness
                </h3>
                <p className="text-xs text-gray-500">
                  Progressively complete your farm attributes to speed up KYC approval and unlock full selling privileges.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-[#2d9a33]">{score}%</span>
                <span className="text-xs text-gray-400 block">Completed</span>
              </div>
            </div>

            {/* Progress Track */}
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#2d9a33] to-teal-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${score}%` }}
              ></div>
            </div>

            {/* Section Badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  sections.personal
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {sections.personal ? 'check' : 'pending'}
                </span>
                Personal Info
              </span>

              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  sections.farm_info
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {sections.farm_info ? 'check' : 'pending'}
                </span>
                Farm Info
              </span>

              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  sections.location
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {sections.location ? 'check' : 'pending'}
                </span>
                Location
              </span>

              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  sections.crops
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {sections.crops ? 'check' : 'pending'}
                </span>
                Crops
              </span>

              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  sections.payout
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {sections.payout ? 'check' : 'pending'}
                </span>
                Banking
              </span>
            </div>
          </section>

          {/* Form Container */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 capitalize">
                  {activeTab === 'personal' && 'Personal & Account Details'}
                  {activeTab === 'location' && 'Farm Location & Pickup Coordinates'}
                  {activeTab === 'production' && 'Agricultural Production & Crops'}
                  {activeTab === 'payout' && 'Bank Account & Payout Setup'}
                </h2>
                <p className="text-xs text-gray-500">
                  {activeTab === 'personal' && 'Manage your legal name and direct mobile contact.'}
                  {activeTab === 'location' && 'Accurate location ensures seamless regional logistics and cold-chain routing.'}
                  {activeTab === 'production' && 'Highlight your farm size, farming model, and cultivated crops.'}
                  {activeTab === 'payout' && 'Provide your bank information to receive automated order payouts.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isEditing ? 'close' : 'edit'}
                </span>
                {isEditing ? 'Cancel' : 'Edit Information'}
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* TAB 1: PERSONAL */}
              {activeTab === 'personal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Full Legal Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="Abebe Bikila"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.name || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Address</label>
                    <div className="text-sm bg-gray-100 px-3.5 py-2.5 rounded-xl text-gray-500 flex items-center justify-between">
                      <span>{user?.email}</span>
                      <span className="material-symbols-outlined text-[16px] text-gray-400">lock</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Phone Number</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="+251 911 234567"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.phone || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Primary Postal / Contact Address</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="Addis Ababa, Bole Sub-city"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.address || 'Not provided'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: LOCATION */}
              {activeTab === 'location' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Region</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="e.g. Oromia, Sidama, Amhara"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.region || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Woreda / District</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.woreda}
                        onChange={(e) => setFormData({ ...formData, woreda: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="e.g. Bishoftu / Ada'a"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.woreda || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Kebele</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.kebele}
                        onChange={(e) => setFormData({ ...formData, kebele: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="e.g. Kebele 03"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.kebele || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">GPS Coordinates (Latitude, Longitude)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.gps_coordinates}
                        onChange={(e) => setFormData({ ...formData, gps_coordinates: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="e.g. 8.7523, 38.9812"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.gps_coordinates || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Farm Gate Pickup Address</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.pickup_address}
                        onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="Exact landmark or road junction for carrier truck arrival"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.pickup_address || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Pickup Instructions for Drivers</label>
                    {isEditing ? (
                      <textarea
                        rows={3}
                        value={formData.pickup_instructions}
                        onChange={(e) => setFormData({ ...formData, pickup_instructions: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all resize-none"
                        placeholder="e.g. Accessible via main asphalt road. Call upon reaching Kebele administration center."
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium whitespace-pre-wrap">
                        {formData.pickup_instructions || 'No instructions provided.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: PRODUCTION */}
              {activeTab === 'production' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Farm / Enterprise Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.farm_name}
                        onChange={(e) => setFormData({ ...formData, farm_name: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="e.g. Green Valley Agricultural Cooperative"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.farm_name || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Farming Model / Type</label>
                    {isEditing ? (
                      <select
                        value={formData.farming_type}
                        onChange={(e) => setFormData({ ...formData, farming_type: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                      >
                        <option value="smallholder">Smallholder Farmer</option>
                        <option value="commercial">Commercial Agriculture Enterprise</option>
                        <option value="cooperative">Farmers Cooperative Union</option>
                        <option value="greenhouse">High-Tech Greenhouse / Horticulture</option>
                      </select>
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium capitalize">
                        {formData.farming_type || 'smallholder'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Farm Size (Hectares)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={formData.farm_size_hectares}
                        onChange={(e) => setFormData({ ...formData, farm_size_hectares: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="e.g. 5.5"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.farm_size_hectares ? `${formData.farm_size_hectares} ha` : 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Primary Cultivated Crops (comma-separated)
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.crops_input}
                        onChange={(e) => setFormData({ ...formData, crops_input: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="e.g. White Teff, Red Onion, Carrots, Coffee"
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.primary_crops?.length > 0
                          ? formData.primary_crops.join(', ')
                          : 'None specified'}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Farm Bio / Story</label>
                    {isEditing ? (
                      <textarea
                        rows={4}
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all resize-none"
                        placeholder="Describe your agricultural background, organic methods, harvest cycles..."
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium whitespace-pre-wrap min-h-[80px]">
                        {formData.bio || 'No bio provided yet.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: PAYOUT */}
              {activeTab === 'payout' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Bank / Financial Institution</label>
                    {isEditing ? (
                      <select
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                      >
                        <option value="">Select Bank</option>
                        <option value="Commercial Bank of Ethiopia">Commercial Bank of Ethiopia (CBE)</option>
                        <option value="Awash Bank">Awash Bank</option>
                        <option value="Dashen Bank">Dashen Bank</option>
                        <option value="Bank of Abyssinia">Bank of Abyssinia</option>
                        <option value="Cooperative Bank of Oromia">Cooperative Bank of Oromia (Coop)</option>
                        <option value="Telebirr Merchant">Telebirr Merchant / Business Account</option>
                      </select>
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.bank_name || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Bank Account Number / Account ID</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.bank_account_number}
                        onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#2d9a33]/20 focus:border-[#2d9a33] outline-none transition-all"
                        placeholder="1000..."
                      />
                    ) : (
                      <div className="text-sm bg-gray-50 px-3.5 py-2.5 rounded-xl text-gray-900 font-medium">
                        {formData.bank_account_number || 'Not provided'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Save Buttons Footer */}
            {isEditing && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-[#2d9a33] hover:bg-[#257d2a] rounded-xl text-white text-xs font-bold transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">save</span>
                  )}
                  Save Profile Changes
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

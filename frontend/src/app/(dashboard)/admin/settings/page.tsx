'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function AdminSettingsPage() {
  const [commissionRate, setCommissionRate] = useState(5.0);
  const [escrowHoldHours, setEscrowHoldHours] = useState(48);
  const [autoVerifyFarmers, setAutoVerifyFarmers] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      {/* Top Header */}
      <header className="px-8 py-5 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Platform Global Settings</h1>
            <span className="text-xs font-bold text-[#286c00] bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full uppercase">
              Production Env
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            Configure marketplace commission rates, escrow windows, and governance policies
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            <span>Command Center</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <i className="fa-solid fa-circle-check text-sm" />
            Platform governance settings updated successfully.
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Marketplace Economics */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <i className="fa-solid fa-coins text-[#286c00]" />
              Marketplace Economics &amp; Escrow
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Platform Commission Fee (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#286c00] focus:ring-1 focus:ring-[#286c00]/20"
                />
                <p className="text-xs text-gray-600 mt-1 [text-wrap:pretty]">Deducted automatically upon buyer order completion via Chapa.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Escrow Hold Period (Hours)
                </label>
                <input
                  type="number"
                  min="12"
                  max="168"
                  value={escrowHoldHours}
                  onChange={(e) => setEscrowHoldHours(parseInt(e.target.value) || 48)}
                  className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1f5400] focus:ring-1 focus:ring-[#1f5400]/20"
                />
                <p className="text-xs text-gray-600 mt-1 [text-wrap:pretty]">Buyer dispute inspection window before automated farmer payout.</p>
              </div>
            </div>
          </div>

          {/* Governance Policies */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <i className="fa-solid fa-user-shield text-[#286c00]" />
              Producer Verification &amp; Security
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-[#FCF9F8] rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-900">Mandatory Administrator KYC Audit</p>
                  <p className="text-xs text-gray-600">Requires manual admin sign-off before farmer produce can be listed.</p>
                </div>
                <input
                  type="checkbox"
                  checked={!autoVerifyFarmers}
                  onChange={() => setAutoVerifyFarmers(!autoVerifyFarmers)}
                  className="w-4 h-4 text-[#286c00] rounded focus:ring-[#286c00]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#FCF9F8] rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-900">Platform Maintenance Mode</p>
                  <p className="text-xs text-gray-600">Restrict marketplace checkouts during scheduled database maintenance.</p>
                </div>
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={() => setMaintenanceMode(!maintenanceMode)}
                  className="w-4 h-4 text-[#286c00] rounded focus:ring-[#286c00]"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1f5400] hover:bg-[#163c00] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


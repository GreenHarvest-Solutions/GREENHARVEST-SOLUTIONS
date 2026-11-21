'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/ui';
import { BaseCard } from '@/components/admin/cards';

interface SettingsHistoryItem {
  id: number | string;
  key: string;
  old_value: unknown;
  new_value: unknown;
  changed_by_name: string | null;
  changed_by_email: string | null;
  created_at: string;
}

export default function AdminSettingsPage() {
  const [commissionRate, setCommissionRate] = useState<number>(5.0);
  const [escrowHoldHours, setEscrowHoldHours] = useState<number>(48);
  const [autoVerifyFarmers, setAutoVerifyFarmers] = useState<boolean>(false);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [tempMin, setTempMin] = useState<number>(2.0);
  const [tempMax, setTempMax] = useState<number>(6.0);

  const [history, setHistory] = useState<SettingsHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([api.getAdminSettings(), api.getSettingsHistory(20)])
      .then(([settingsRes, historyRes]) => {
        if (!isMounted) return;
        if (settingsRes?.settings) {
          const s = settingsRes.settings;
          if (s.commission_rate?.value !== undefined) setCommissionRate(Number(s.commission_rate.value));
          if (s.escrow_hold_hours?.value !== undefined) setEscrowHoldHours(Number(s.escrow_hold_hours.value));
          if (s.auto_verify_farmers?.value !== undefined) setAutoVerifyFarmers(Boolean(s.auto_verify_farmers.value));
          if (s.maintenance_mode?.value !== undefined) setMaintenanceMode(Boolean(s.maintenance_mode.value));
          if (s.cold_chain_temp_min?.value !== undefined) setTempMin(Number(s.cold_chain_temp_min.value));
          if (s.cold_chain_temp_max?.value !== undefined) setTempMax(Number(s.cold_chain_temp_max.value));
        }
        if (Array.isArray(historyRes?.history)) {
          setHistory(historyRes.history);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to load settings:', err);
        setNotice({ message: 'Failed to load settings from server.', type: 'error' });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (commissionRate < 0 || commissionRate > 30) {
      setNotice({ message: 'Commission fee must be between 0% and 30%.', type: 'error' });
      return;
    }
    if (escrowHoldHours < 1 || escrowHoldHours > 336) {
      setNotice({ message: 'Escrow window must be between 1 and 336 hours (14 days).', type: 'error' });
      return;
    }
    if (tempMin >= tempMax) {
      setNotice({ message: 'Minimum cold-chain temperature must be less than maximum.', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        commission_rate: { value: commissionRate, unit: '%', description: 'Platform transaction fee' },
        escrow_hold_hours: { value: escrowHoldHours, unit: 'hours', description: 'Inspection window before payout' },
        auto_verify_farmers: { value: autoVerifyFarmers, description: 'Automated verification for provisional accounts' },
        maintenance_mode: { value: maintenanceMode, description: 'Platform global maintenance switch' },
        cold_chain_temp_min: { value: tempMin, unit: 'celsius', description: 'Reefer lower thermal threshold' },
        cold_chain_temp_max: { value: tempMax, unit: 'celsius', description: 'Reefer upper thermal threshold' },
      };

      await api.updateAdminSettings(payload);
      setNotice({ message: 'Platform governance parameters persisted and audited successfully.', type: 'success' });
      setTimeout(() => setNotice(null), 4000);
      // Refresh history log
      const hist = await api.getSettingsHistory(20);
      if (Array.isArray(hist?.history)) setHistory(hist.history);
    } catch (err: unknown) {
      let msg = 'Failed to persist settings.';
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: { message?: string } } }).response;
        if (resp?.data?.message) msg = resp.data.message;
      }
      setNotice({ message: msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FCF9F8]">
      <AdminPageHeader
        title="Platform Global Settings"
        description="Configure marketplace economics, escrow release policies, cold-chain bounds, and platform controls"
        icon="fa-sliders"
        badge="PostgreSQL Backed"
        actions={
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            <span>Command Center</span>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 max-w-5xl space-y-6">
        {notice && (
          <div
            className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              notice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <i className={`fa-solid ${notice.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-red-600'} text-sm`} />
            <span>{notice.message}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs font-semibold text-gray-500 flex items-center justify-center gap-2">
            <i className="fa-solid fa-spinner animate-spin text-[#1f5400] text-sm" />
            <span>Loading verified governance configuration...</span>
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* 1. Marketplace Economics & Settlement */}
            <BaseCard
              title="Marketplace Economics & Escrow"
              subtitle="Transaction fees, dispute hold periods, and clearinghouse rules"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Platform Commission Fee (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1f5400] focus:ring-1 focus:ring-[#1f5400]/20 tabular-nums"
                  />
                  <p className="text-xs text-gray-600 mt-1 [text-wrap:pretty]">
                    Automatically deducted on completed orders during transaction clearing.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Escrow Inspection Window (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="336"
                    value={escrowHoldHours}
                    onChange={(e) => setEscrowHoldHours(parseInt(e.target.value, 10) || 48)}
                    className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1f5400] focus:ring-1 focus:ring-[#1f5400]/20 tabular-nums"
                  />
                  <p className="text-xs text-gray-600 mt-1 [text-wrap:pretty]">
                    Commercial buyer inspection period before automated funds release to the farmer.
                  </p>
                </div>
              </div>
            </BaseCard>

            {/* 2. Cold-Chain Thermal Tolerances */}
            <BaseCard
              title="Cold-Chain Thermal Boundaries"
              subtitle="Refrigerated reefer telemetry limits for automated breach detection"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Target Minimum Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={tempMin}
                    onChange={(e) => setTempMin(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1f5400] focus:ring-1 focus:ring-[#1f5400]/20 tabular-nums"
                  />
                  <p className="text-xs text-gray-600 mt-1 [text-wrap:pretty]">
                    Readings below this value trigger chilling risk alerts on driver terminals.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Target Maximum Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={tempMax}
                    onChange={(e) => setTempMax(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1f5400] focus:ring-1 focus:ring-[#1f5400]/20 tabular-nums"
                  />
                  <p className="text-xs text-gray-600 mt-1 [text-wrap:pretty]">
                    Readings above this threshold automatically log a cold-chain telemetry breach.
                  </p>
                </div>
              </div>
            </BaseCard>

            {/* 3. Security & Governance Policies */}
            <BaseCard
              title="Producer Verification & System Controls"
              subtitle="Platform governance access flags and operational mode"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-[#FCF9F8] rounded-xl border border-gray-200">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Auto-Accreditation for Smallholders</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Enable automated tier-1 issuance without manual field visit requirement.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoVerifyFarmers}
                    onChange={(e) => setAutoVerifyFarmers(e.target.checked)}
                    className="w-4 h-4 text-[#1f5400] accent-[#1f5400] rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#FCF9F8] rounded-xl border border-gray-200">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Platform Maintenance Mode</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Temporarily pause checkout transactions during scheduled schema maintenance.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="w-4 h-4 text-red-600 accent-red-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </BaseCard>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#1f5400] hover:bg-[#173e00] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <i className="fa-solid fa-spinner animate-spin text-xs" />}
                <span>Save Platform Configuration</span>
              </button>
            </div>
          </form>
        )}

        {/* 4. Settings Change History Log */}
        <BaseCard
          title="Settings Audit History"
          subtitle="Immutable ledger of all governance configuration mutations"
          noPadding
        >
          {history.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500 font-medium">
              No previous configuration adjustments logged.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FCF9F8] border-b border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="py-3 px-4">Setting Key</th>
                    <th className="py-3 px-4">New Value</th>
                    <th className="py-3 px-4">Modified By</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {history.map((h) => {
                    const val = h.new_value as { value?: unknown; unit?: string } | null;
                    return (
                      <tr key={h.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                          {h.key}
                        </td>
                        <td className="py-3.5 px-4 text-gray-800 tabular-nums font-semibold">
                          {typeof val === 'object' && val !== null
                            ? `${val.value ?? JSON.stringify(val)} ${val.unit || ''}`
                            : String(h.new_value)}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">
                          {h.changed_by_name || h.changed_by_email || 'System'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 tabular-nums">
                          {new Date(h.created_at).toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </BaseCard>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

export default function AdminPricingAndZonesPage() {
  const { showSuccess, showError } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [strategyInfo, setStrategyInfo] = useState<{ value: string; allowed: string[] }>({ value: 'optimized', allowed: [] });

  const [newRule, setNewRule] = useState({
    rule_name: '',
    delivery_method: 'delivery_partner',
    zone_type: 'urban',
    base_fee: '45',
    per_km_rate: '2.2',
    min_fee: '65',
    max_fee: '4500',
    free_weight_kg: '20',
    per_kg_rate: '0.9',
    driver_base_payout: '35',
    driver_per_km_payout: '1.6',
    driver_per_kg_payout: '0.6',
    disclosure_note: '',
  });

  const loadAll = useCallback(async () => {
    try {
      const [rRes, zRes, sRes, eRes, fRes] = await Promise.all([
        api.adminGetPricingRules(),
        api.getDeliveryZones(true),
        api.adminGetAllocationStrategy(),
        api.adminListExceptions().catch(() => ({ exceptions: [] })),
        api.getFinancialReconciliation().catch(() => null),
      ]);
      setRules(rRes.rules || []);
      setZones(zRes.zones || []);
      setStrategyInfo(sRes);
      setExceptions(eRes.exceptions || []);
      setReconciliation(fRes);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load pricing configuration');
    }
  }, [showError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminCreatePricingRule({
        ...newRule,
        zone_type: newRule.zone_type || null,
        base_fee: Number(newRule.base_fee),
        per_km_rate: Number(newRule.per_km_rate),
        min_fee: Number(newRule.min_fee),
        max_fee: Number(newRule.max_fee),
        free_weight_kg: Number(newRule.free_weight_kg),
        per_kg_rate: Number(newRule.per_kg_rate),
        driver_base_payout: Number(newRule.driver_base_payout),
        driver_per_km_payout: Number(newRule.driver_per_km_payout),
        driver_per_kg_payout: Number(newRule.driver_per_kg_payout),
      });
      showSuccess('New versioned pricing rule published (previous accepted quotes stay frozen).');
      loadAll();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to create pricing rule');
    }
  };

  const handleStrategyChange = async (val: string) => {
    try {
      const res = await api.adminSetAllocationStrategy(val);
      setStrategyInfo(res);
      showSuccess(`Marketplace branch allocation strategy set to "${val}".`);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update allocation strategy');
    }
  };

  const handleScanSla = async () => {
    try {
      const res = await api.adminScanSla();
      showSuccess(`SLA Scan complete: ${res.scanned_overdue_count} overdue shipment(s) escalated.`);
      loadAll();
    } catch (err: any) {
      showError('Failed to run SLA scan');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurable Delivery Pricing, Zones &amp; Allocation Rules</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Versioned pricing rules (with independent driver payout formulas), geographic delivery zones, and SLA monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs">
            <span className="text-gray-500 font-semibold mr-2">Branch Allocation Strategy:</span>
            <select
              value={strategyInfo.value}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg font-bold bg-white"
            >
              {(strategyInfo.allowed.length ? strategyInfo.allowed : ['optimized', 'nearest', 'lowest_cost', 'fastest', 'best_inventory', 'farmer_preferred']).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <button onClick={handleScanSla} className="px-3.5 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg cursor-pointer">
            Run SLA Scan
          </button>
        </div>
      </div>

      {/* Financial & Driver Compensation Summary */}
      {reconciliation?.driver_compensation_summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <span className="text-gray-400 uppercase font-bold text-[10px]">Buyer Paid Courier Charges</span>
            <p className="text-lg font-bold text-gray-900 tabular-nums mt-1">
              {Number(reconciliation.driver_compensation_summary.total_buyer_delivery_fees || 0).toFixed(2)} ETB
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <span className="text-gray-400 uppercase font-bold text-[10px]">Independent Driver Earnings</span>
            <p className="text-lg font-bold text-emerald-700 tabular-nums mt-1">
              {Number(reconciliation.driver_compensation_summary.total_driver_earnings || 0).toFixed(2)} ETB
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <span className="text-gray-400 uppercase font-bold text-[10px]">Platform Logistics Margin</span>
            <p className="text-lg font-bold text-blue-700 tabular-nums mt-1">
              {Number(reconciliation.driver_compensation_summary.total_platform_logistics_revenue || 0).toFixed(2)} ETB
            </p>
          </div>
        </div>
      )}

      {/* Create New Pricing Rule Version */}
      <form onSubmit={handleSaveRule} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Publish New Versioned Pricing Rule</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <input required placeholder="Rule Name" value={newRule.rule_name} onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })} className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg" />
          <select value={newRule.delivery_method} onChange={(e) => setNewRule({ ...newRule, delivery_method: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <option value="delivery_partner">Courier Fleet</option>
            <option value="farmer_delivery">Farmer Direct</option>
            <option value="farmer_pickup">Farm Pickup</option>
          </select>
          <select value={newRule.zone_type} onChange={(e) => setNewRule({ ...newRule, zone_type: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <option value="">All Zones</option>
            <option value="urban">Urban</option>
            <option value="suburban">Suburban</option>
            <option value="rural">Rural</option>
            <option value="remote">Remote</option>
          </select>
          <input type="number" step="0.5" placeholder="Base Fee (ETB)" value={newRule.base_fee} onChange={(e) => setNewRule({ ...newRule, base_fee: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
          <input type="number" step="0.1" placeholder="Rate / km (ETB)" value={newRule.per_km_rate} onChange={(e) => setNewRule({ ...newRule, per_km_rate: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
          <input type="number" step="0.1" placeholder="Rate / kg > free" value={newRule.per_kg_rate} onChange={(e) => setNewRule({ ...newRule, per_kg_rate: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
          <input type="number" step="0.5" placeholder="Driver Base" value={newRule.driver_base_payout} onChange={(e) => setNewRule({ ...newRule, driver_base_payout: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
          <input type="number" step="0.1" placeholder="Driver / km" value={newRule.driver_per_km_payout} onChange={(e) => setNewRule({ ...newRule, driver_per_km_payout: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
          <input placeholder="Customer Disclosure Note" value={newRule.disclosure_note} onChange={(e) => setNewRule({ ...newRule, disclosure_note: e.target.value })} className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg" />
          <button type="submit" className="px-3 py-2 bg-[#286c00] text-white font-bold rounded-lg cursor-pointer">Publish Rule Version</button>
        </div>
      </form>

      {/* Active Rules Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="p-4 border-b border-gray-200"><h2 className="text-sm font-bold text-gray-900">Pricing Rule Versions ({rules.length})</h2></div>
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
            <tr>
              <th className="p-3">Rule / Version</th>
              <th className="p-3">Method &amp; Zone</th>
              <th className="p-3">Buyer Formula</th>
              <th className="p-3">Driver Formula</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums">
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-bold text-gray-900">{r.rule_name} <span className="text-gray-400">v{r.version}</span></td>
                <td className="p-3">{r.delivery_method} · {r.zone_name || r.zone_type || 'Default Global'}</td>
                <td className="p-3">{r.base_fee} + {r.per_km_rate}/km + {r.per_kg_rate}/kg (&gt;{r.free_weight_kg}kg)</td>
                <td className="p-3 text-emerald-700">{r.driver_base_payout} + {r.driver_per_km_payout}/km + {r.driver_per_kg_payout}/kg</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded font-bold text-[10px] ${r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{r.is_active ? 'ACTIVE' : 'ARCHIVED'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Geographic Delivery Zones & SLA Exceptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h2 className="text-sm font-bold text-gray-900">Geographic Delivery Zones ({zones.length})</h2>
          {zones.map((z) => (
            <div key={z.id} className="p-2.5 border border-gray-100 rounded-lg flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-gray-900">{z.name} <span className="text-[10px] font-mono text-gray-400">{z.code}</span></p>
                <p className="text-gray-500">Type: {z.zone_type} · Radius: {z.radius_km} km · Surcharge: {z.remote_surcharge} ETB</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase">{z.operational_status}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h2 className="text-sm font-bold text-gray-900">Operational &amp; SLA Exceptions ({exceptions.length})</h2>
          {exceptions.map((ex) => (
            <div key={ex.id} className="p-2.5 border border-amber-200 bg-amber-50/40 rounded-lg text-xs">
              <div className="flex justify-between font-bold text-gray-900">
                <span>{ex.exception_type?.replace(/_/g, ' ')}</span>
                <span className="uppercase text-[10px] text-amber-800">{ex.status}</span>
              </div>
              <p className="text-gray-600 mt-1">{ex.description}</p>
            </div>
          ))}
          {exceptions.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No open operational exceptions.</p>}
        </div>
      </div>
    </div>
  );
}
